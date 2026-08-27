import { json, methodNotAllowed, requestMethod } from '../../shared/http.ts'
import { clearedSessionCookie } from '../../shared/jwt.ts'

/** Drop the session cookie. An unauthenticated caller is a no-op, not an error. */
export function onRequest(context: any): Response {
  if (requestMethod(context) !== 'POST') return methodNotAllowed('POST')
  return json({ ok: true }, 200, { 'set-cookie': clearedSessionCookie() })
}
