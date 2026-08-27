/**
 * Request/response plumbing shared by the Cloud Function routes.
 *
 * Every handler here is written against a loose `context` because the two
 * runtimes hand over slightly different shapes: Cloud Functions receive a
 * standard Web `Request` (headers are a `Headers`, the body must be awaited),
 * while the Agent runtime pre-parses the body and may pass headers as a plain
 * object. The readers below accept both rather than assuming one.
 */
import { SESSION_COOKIE, readCookie, verifySession, type SessionClaims } from './jwt.ts'

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store', ...extraHeaders },
  })
}

export function envString(context: any, key: string): string {
  const value = context?.env?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function headerValue(context: any, name: string): string {
  const headers = context?.request?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') return String(headers.get(name) ?? '')
  const record = headers as Record<string, unknown>
  const direct = record[name] ?? record[name.toLowerCase()]
  return typeof direct === 'string' ? direct : ''
}

export function requestMethod(context: any): string {
  return String(context?.request?.method || 'GET').toUpperCase()
}

/** Parsed JSON body, tolerating both a pre-parsed body and a raw Request. */
export async function readBody(context: any): Promise<Record<string, unknown>> {
  const existing = context?.request?.body
  if (existing !== null && typeof existing === 'object' && !('getReader' in existing)) {
    return existing as Record<string, unknown>
  }
  try {
    const parsed = await context.request.json() as unknown
    return parsed !== null && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/**
 * `JWT_SECRET` is required and has no default. A generated-on-boot fallback
 * would silently invalidate every session on each cold start and would differ
 * between the edge middleware and the functions, so absence is a hard failure.
 */
export function requireSecret(context: any): { ok: true; secret: string } | { ok: false; response: Response } {
  const secret = envString(context, 'JWT_SECRET')
  if (secret.length < 16) {
    return {
      ok: false,
      response: json({
        ok: false,
        error: 'server-misconfigured',
        message: 'JWT_SECRET is missing or shorter than 16 characters. Set it in the Makers environment variables.',
      }, 503),
    }
  }
  return { ok: true, secret }
}

export function sessionFrom(context: any, secret: string): SessionClaims | undefined {
  const token = readCookie(headerValue(context, 'cookie'), SESSION_COOKIE)
  return token.length === 0 ? undefined : verifySession(secret, token)
}

export function requireAuth(
  context: any,
): { ok: true; secret: string; claims: SessionClaims } | { ok: false; response: Response } {
  const secretResult = requireSecret(context)
  if (!secretResult.ok) return secretResult
  const claims = sessionFrom(context, secretResult.secret)
  if (claims === undefined) {
    return { ok: false, response: json({ ok: false, error: 'unauthorized' }, 401, { 'x-dsh-auth': 'required' }) }
  }
  return { ok: true, secret: secretResult.secret, claims }
}

export function requireAdmin(
  context: any,
): { ok: true; secret: string; claims: SessionClaims } | { ok: false; response: Response } {
  const auth = requireAuth(context)
  if (!auth.ok) return auth
  if (auth.claims.role !== 'admin') {
    return { ok: false, response: json({ ok: false, error: 'forbidden' }, 403) }
  }
  return auth
}

export function methodNotAllowed(allow: string): Response {
  return json({ ok: false, error: 'method-not-allowed' }, 405, { allow })
}
