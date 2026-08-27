import { accountsStore } from '../../shared/blob.ts'
import { sealSecret } from '../../shared/crypto.ts'
import { json, methodNotAllowed, readBody, requestMethod, requireAuth } from '../../shared/http.ts'
import { readUser, writeUser, type UserRecord } from '../../shared/users.ts'

/**
 * Whether a user-supplied base URL is safe for the server to call.
 *
 * This matters more than it looks. The gateway proxy will issue a request to
 * whatever is stored here, from inside the platform's network, so an
 * unvalidated value turns every account into a server-side request forgery
 * primitive: `169.254.169.254` is the cloud metadata service, and private
 * ranges reach neighbours. Only public https origins are accepted.
 */
function safeBaseUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost')) return false
  if (host.endsWith('.internal') || host.endsWith('.local')) return false
  if (host === '0.0.0.0' || host === '::1') return false
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 10 || a === 127) return false
    if (a === 169 && b === 254) return false           // link-local / metadata
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 100 && b >= 64 && b <= 127) return false // carrier-grade NAT
  }
  return true
}

/**
 * Store, replace, or clear this user's own provider key.
 *
 * `apiKey: null` clears it. `apiKey` absent leaves the stored key untouched and
 * only updates the base URL, which is what lets the UI show a masked field
 * without ever round-tripping the secret back to the browser.
 */
export async function onRequest(context: any): Promise<Response> {
  if (requestMethod(context) !== 'POST') return methodNotAllowed('POST')

  const auth = requireAuth(context)
  if (!auth.ok) return auth.response

  const store = accountsStore()
  const user = await readUser(store, auth.claims.sub)
  if (user === undefined) return json({ ok: false, error: 'not-found' }, 401)

  const body = await readBody(context)
  const rawKey = body.apiKey
  const rawBase = body.baseUrl

  let baseUrl: string | undefined
  if (typeof rawBase === 'string' && rawBase.trim().length > 0) {
    if (!safeBaseUrl(rawBase.trim())) {
      return json({
        ok: false,
        error: 'invalid-base-url',
        message: 'Base URL must be a public https address.',
      }, 400)
    }
    baseUrl = rawBase.trim()
  }

  const next: UserRecord = { ...user }

  if (rawKey === null) {
    delete next.privateKeySealed
    delete next.privateBaseUrl
  } else if (rawKey === undefined) {
    if (user.privateKeySealed === undefined) {
      return json({ ok: false, error: 'invalid-credentials' }, 400)
    }
    if (baseUrl === undefined) delete next.privateBaseUrl
    else next.privateBaseUrl = baseUrl
  } else {
    if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
      return json({ ok: false, error: 'invalid-credentials' }, 400)
    }
    next.privateKeySealed = sealSecret(auth.secret, rawKey.trim())
    if (baseUrl === undefined) delete next.privateBaseUrl
    else next.privateBaseUrl = baseUrl
  }

  await writeUser(store, next)
  return json({ ok: true })
}
