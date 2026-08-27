import { accountsStore } from '../../shared/blob.ts'
import { envString, json, methodNotAllowed, readBody, requestMethod, requireSecret } from '../../shared/http.ts'
import { sessionCookie, signSession } from '../../shared/jwt.ts'
import { claimAdmin, conversationIdFor } from '../../shared/users.ts'

/**
 * Take the administrator seat on a fresh deployment. Genuinely
 * first-come-first-served: the site is reachable the moment it deploys, so
 * whoever opens it first becomes the administrator. Do this immediately after
 * deploying.
 *
 * `DSH_ADMIN_RESET` is the way back if someone else got there first. Setting it
 * to any non-empty value clears the latch so the next claim wins; the previous
 * administrator's account still exists and can be removed from the panel
 * afterwards. Unset the variable once you have recovered the seat, or the latch
 * stays clearable by the next visitor.
 */
export async function onRequest(context: any): Promise<Response> {
  if (requestMethod(context) !== 'POST') return methodNotAllowed('POST')

  const secretResult = requireSecret(context)
  if (!secretResult.ok) return secretResult.response

  const body = await readBody(context)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const store = accountsStore()
  if (envString(context, 'DSH_ADMIN_RESET').length > 0) {
    await store.delete('admin/claimed')
  }

  const result = await claimAdmin(store, { username, password })
  if (!result.ok) {
    return json({ ok: false, error: result.error }, result.error === 'already-claimed' ? 409 : 400)
  }

  const token = signSession(secretResult.secret, {
    sub: result.user.id,
    username: result.user.username,
    role: 'admin',
  })
  return json({
    ok: true,
    conversationId: conversationIdFor(result.user.id),
    role: 'admin',
  }, 200, { 'set-cookie': sessionCookie(token) })
}
