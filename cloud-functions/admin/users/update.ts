import { accountsStore } from '../../../shared/blob.ts'
import { hashPassword } from '../../../shared/crypto.ts'
import { json, methodNotAllowed, readBody, requestMethod, requireAdmin } from '../../../shared/http.ts'
import { normalizeQuota, readUser, validatePassword, writeUser, type UserRecord } from '../../../shared/users.ts'

/** Change a quota, switch an account off, or set a new password. */
export async function onRequest(context: any): Promise<Response> {
  if (requestMethod(context) !== 'POST') return methodNotAllowed('POST')

  const auth = requireAdmin(context)
  if (!auth.ok) return auth.response

  const body = await readBody(context)
  const id = typeof body.id === 'string' ? body.id : ''
  if (id.length === 0) return json({ ok: false, error: 'not-found' }, 400)

  const store = accountsStore()
  const user = await readUser(store, id)
  if (user === undefined) return json({ ok: false, error: 'not-found' }, 404)

  const next: UserRecord = { ...user }

  if (body.quotaTokens !== undefined) {
    const quota = normalizeQuota(body.quotaTokens)
    if (quota === undefined) return json({ ok: false, error: 'invalid-quota' }, 400)
    next.quotaTokens = quota
  }

  if (body.disabled !== undefined) {
    if (typeof body.disabled !== 'boolean') return json({ ok: false, error: 'invalid-quota' }, 400)
    // Locking yourself out would leave the deployment with no reachable
    // administrator, so this one is refused outright.
    if (body.disabled && user.id === auth.claims.sub) {
      return json({ ok: false, error: 'cannot-delete-self' }, 400)
    }
    next.disabled = body.disabled
  }

  if (body.password !== undefined) {
    if (!validatePassword(body.password)) return json({ ok: false, error: 'weak-password' }, 400)
    next.passwordHash = await hashPassword(body.password as string)
  }

  await writeUser(store, next)
  return json({ ok: true })
}
