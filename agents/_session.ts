/**
 * Who is calling, on the Agent side.
 *
 * This is the file that makes per-user workspaces real. Upstream, the workspace
 * key was `makers-conversation-id`, a value the browser generated and stored in
 * `localStorage` — so anyone who edited that header walked straight into
 * someone else's workspace, and the server had no way to object because it had
 * no notion of a user.
 *
 * Here the workspace key is derived from the signed session instead, and the
 * header is only accepted when it matches what the session implies. The header
 * still has to be present and correct because the platform routes requests to a
 * sticky instance by it before any of this code runs; what changes is that a
 * mismatched one is refused rather than honoured.
 */
import { verifySession, SESSION_COOKIE, readCookie, type SessionClaims } from '../shared/jwt.ts'

export interface CallerIdentity {
  claims: SessionClaims
  /** The only conversation id this caller may use. */
  conversationId: string
}

function headerValue(context: any, name: string): string {
  const headers = context?.request?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') return String(headers.get(name) ?? '')
  const record = headers as Record<string, unknown>
  const direct = record[name] ?? record[name.toLowerCase()]
  return typeof direct === 'string' ? direct : ''
}

function deny(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, {
    status,
    headers: { 'x-dsh-auth': 'required', 'cache-control': 'no-store' },
  })
}

export function conversationIdFor(userId: string): string {
  return `u-${userId}`
}

/**
 * Verify the session and confirm the routing header belongs to it.
 *
 * The edge middleware has already checked the signature, but it is a separate
 * process that can be bypassed if a route is ever left out of its matcher, and
 * it does not tell us *who* called. Both questions are answered again here.
 */
export function identify(context: any): { ok: true; identity: CallerIdentity } | { ok: false; response: Response } {
  const secret = typeof context?.env?.JWT_SECRET === 'string' ? context.env.JWT_SECRET.trim() : ''
  if (secret.length < 16) {
    return {
      ok: false,
      response: deny(
        'server-misconfigured',
        'JWT_SECRET is missing or shorter than 16 characters.',
        503,
      ),
    }
  }

  const token = readCookie(headerValue(context, 'cookie'), SESSION_COOKIE)
  if (token.length === 0) return { ok: false, response: deny('unauthorized', 'Sign in required.', 401) }

  const claims = verifySession(secret, token)
  if (claims === undefined) return { ok: false, response: deny('unauthorized', 'Session invalid or expired.', 401) }

  const expected = conversationIdFor(claims.sub)
  const presented = String(context?.conversation_id || '').trim()
  if (presented.length > 0 && presented !== expected) {
    // Someone is asking to be routed into a workspace that is not theirs.
    return {
      ok: false,
      response: deny(
        'workspace-mismatch',
        'This session does not own the requested workspace.',
        403,
      ),
    }
  }

  return { ok: true, identity: { claims, conversationId: expected } }
}
