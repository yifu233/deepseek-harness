import { accountsStore } from '../../shared/blob.ts'
import { json, methodNotAllowed, readBody, requestMethod, requireSecret } from '../../shared/http.ts'
import { sessionCookie, signSession } from '../../shared/jwt.ts'
import { authenticate, conversationIdFor } from '../../shared/users.ts'

/**
 * Slow down repeated wrong guesses. The counter lives in one function
 * instance, so it is best-effort rather than a distributed limiter: it raises
 * the cost of online guessing and nothing more. Password strength is what
 * actually protects an account here.
 */
let recentFailures = 0
let lastFailureAt = 0

async function throttle(): Promise<void> {
  const now = Date.now()
  if (now - lastFailureAt > 60_000) recentFailures = 0
  recentFailures += 1
  lastFailureAt = now
  await new Promise(resolve => setTimeout(resolve, Math.min(2_000, 150 * recentFailures)))
}

export async function onRequest(context: any): Promise<Response> {
  if (requestMethod(context) !== 'POST') return methodNotAllowed('POST')

  const secretResult = requireSecret(context)
  if (!secretResult.ok) return secretResult.response

  const body = await readBody(context)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const result = await authenticate(accountsStore(), username, password)
  if (!result.ok) {
    await throttle()
    return json({ ok: false, error: result.error }, result.error === 'disabled' ? 403 : 401)
  }

  const token = signSession(secretResult.secret, {
    sub: result.user.id,
    username: result.user.username,
    role: result.user.role,
  })
  return json({
    ok: true,
    conversationId: conversationIdFor(result.user.id),
    role: result.user.role,
  }, 200, { 'set-cookie': sessionCookie(token) })
}
