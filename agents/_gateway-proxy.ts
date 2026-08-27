import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { accountsStore } from '../shared/blob.ts'
import { openSecret } from '../shared/crypto.ts'
import { checkQuota, readUser, recordUsage, userIdFromConversationId, type UserRecord } from '../shared/users.ts'

export interface LocalGatewayProxy {
  baseUrl: string
  close(): Promise<void>
}

function envValue(context: any, key: string): string {
  const value = context.env?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) as Record<string, unknown> : {}
}

/**
 * `developer` is rewritten to `system` because not every OpenAI-compatible
 * backend understands the newer role, and `stream_options.include_usage` is
 * requested because without it a streaming completion never reports token
 * counts — and unreported tokens are unbilled tokens, which would silently
 * disable every quota.
 */
export function normalizeGatewayRequest(body: Record<string, unknown>): Record<string, unknown> {
  const messages = Array.isArray(body.messages)
    ? body.messages.map(message => {
        if (!message || typeof message !== 'object') return message
        const record = message as Record<string, unknown>
        return record.role === 'developer' ? { ...record, role: 'system' } : record
      })
    : body.messages
  const streaming = body.stream === true
  const existingOptions = body.stream_options !== null && typeof body.stream_options === 'object'
    ? body.stream_options as Record<string, unknown>
    : {}
  return {
    ...body,
    ...(messages === undefined ? {} : { messages }),
    ...(streaming ? { stream_options: { ...existingOptions, include_usage: true } } : {}),
  }
}

/**
 * Total tokens reported by the response, or `undefined` when it said nothing.
 *
 * Both shapes are handled: a streamed body ends with a `data:` frame carrying
 * `usage`, and a non-streamed body is a single JSON object with the same field.
 * Rather than parse every frame, this scans the tail for the last `usage` block,
 * which is where both shapes put it.
 */
function extractTotalTokens(tail: string): number | undefined {
  const totals = [...tail.matchAll(/"total_tokens"\s*:\s*(\d+)/g)]
  if (totals.length > 0) {
    const value = Number(totals[totals.length - 1]?.[1])
    if (Number.isSafeInteger(value) && value > 0) return value
  }
  // Some backends omit `total_tokens` and report only the two halves.
  const prompt = [...tail.matchAll(/"prompt_tokens"\s*:\s*(\d+)/g)].pop()?.[1]
  const completion = [...tail.matchAll(/"completion_tokens"\s*:\s*(\d+)/g)].pop()?.[1]
  const sum = Number(prompt ?? 0) + Number(completion ?? 0)
  return Number.isSafeInteger(sum) && sum > 0 ? sum : undefined
}

function refuse(response: ServerResponse, status: number, error: string, message: string): void {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  response.end(JSON.stringify({ error: { message, type: error, code: error } }))
}

interface KeyChoice {
  apiKey: string
  baseUrl: string
  /** Whether this spend counts against the shared pool and the user's quota. */
  metered: boolean
}

/**
 * Which credential pays for this call.
 *
 * A user's own key spends their own money, so it is not metered against the
 * deployment's quota — usage is still recorded so the administrator can see
 * activity. Everyone else spends the shared key, and that path is metered.
 */
function chooseKey(context: any, secret: string, user: UserRecord): KeyChoice | undefined {
  const sharedBase = envValue(context, 'AI_GATEWAY_BASE_URL').replace(/\/+$/, '')
  const sharedKey = envValue(context, 'AI_GATEWAY_API_KEY')

  if (user.privateKeySealed !== undefined && secret.length >= 16) {
    const opened = openSecret(secret, user.privateKeySealed)
    if (opened !== undefined && opened.length > 0) {
      return {
        apiKey: opened,
        baseUrl: (user.privateBaseUrl ?? sharedBase).replace(/\/+$/, ''),
        metered: false,
      }
    }
  }
  if (!sharedBase || !sharedKey) return undefined
  return { apiKey: sharedKey, baseUrl: sharedBase, metered: true }
}

async function proxyGatewayRequest(
  context: any,
  conversationId: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
    response.writeHead(404).end('not found')
    return
  }

  const userId = userIdFromConversationId(conversationId)
  if (userId === undefined) {
    refuse(response, 403, 'no-identity', 'This workspace is not bound to a user account.')
    return
  }

  const secret = envValue(context, 'JWT_SECRET')
  const store = accountsStore()

  // A failure to read the account fails closed. Allowing the call through would
  // mean spending the shared key with no quota check at all, which is the one
  // outcome worth avoiding more than an outage — and the app is unusable
  // without this storage anyway, since signing in needs it.
  let user: UserRecord | undefined
  try {
    user = await readUser(store, userId)
  } catch (error) {
    refuse(response, 503, 'storage-unavailable',
      `Cannot verify your account right now: ${error instanceof Error ? error.message : String(error)}`)
    return
  }
  if (user === undefined) {
    refuse(response, 403, 'no-account', 'This account no longer exists.')
    return
  }
  if (user.disabled) {
    refuse(response, 403, 'account-disabled', 'This account is disabled. Contact the administrator.')
    return
  }

  const choice = chooseKey(context, secret, user)
  if (choice === undefined) {
    refuse(response, 500, 'gateway-unconfigured',
      'No usable model credential: set AI_GATEWAY_BASE_URL and AI_GATEWAY_API_KEY, or add your own key.')
    return
  }

  if (choice.metered) {
    const quota = await checkQuota(store, user)
    if (!quota.withinQuota) {
      refuse(response, 429, 'quota-exceeded',
        `Token quota reached (${String(quota.used)} of ${String(quota.quota)}). Ask the administrator to raise it, or add your own API key.`)
      return
    }
  }

  const controller = new AbortController()
  response.on('close', () => {
    if (!response.writableEnded) controller.abort()
  })

  const body = normalizeGatewayRequest(await readJsonBody(request))
  if (typeof body.model !== 'string' || !body.model.trim()) {
    body.model = envValue(context, 'AI_GATEWAY_MODEL') || '@makers/deepseek-v4-flash'
  }

  const upstream = await fetch(`${choice.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${choice.apiKey}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
      // Makers-specific hints belong only on the Makers gateway; a user's own
      // endpoint should receive a plain OpenAI-compatible request.
      ...(choice.metered
        ? {
            'x-gateway-quota-bypass': 'true',
            'x-prompt-log': 'true',
            'makers-conversation-id': conversationId,
          }
        : {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })

  const headers = Object.fromEntries(
    [...upstream.headers.entries()].filter(([name]) =>
      name.toLowerCase() !== 'content-length' && name.toLowerCase() !== 'transfer-encoding'),
  )
  response.writeHead(upstream.status, headers)
  if (!upstream.body) {
    response.end()
    return
  }

  // Forward every chunk immediately — nothing is buffered for the client — while
  // keeping a rolling tail to read the usage block out of afterwards.
  const decoder = new TextDecoder()
  let tail = ''
  for await (const chunk of upstream.body) {
    tail = `${tail}${decoder.decode(chunk as Uint8Array, { stream: true })}`.slice(-8_000)
    if (!response.write(chunk)) {
      await new Promise<void>(resolve => response.once('drain', resolve))
    }
  }
  response.end()

  const tokens = extractTotalTokens(tail)
  if (tokens === undefined) {
    // Loud on purpose. Silence here means quotas quietly stop counting, which
    // looks like "the limit does not work" rather than "the upstream withheld
    // its usage block".
    console.warn(
      '[gateway] upstream reported no token usage; this call is unmetered. ' +
      'Check that the provider honours stream_options.include_usage.',
    )
    return
  }
  try {
    await recordUsage(store, userId, tokens)
  } catch (error) {
    console.warn('[gateway] usage accounting failed:', error)
  }
}

export async function startLocalGatewayProxy(context: any, conversationId: string): Promise<LocalGatewayProxy> {
  const server = createServer((request, response) => {
    void proxyGatewayRequest(context, conversationId, request, response).catch(error => {
      if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Gateway proxy did not receive a TCP address')
  }

  return {
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}/v1`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
      server.closeAllConnections?.()
    }),
  }
}
