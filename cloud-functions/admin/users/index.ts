import { accountsStore } from '../../../shared/blob.ts'
import { json, methodNotAllowed, readBody, requestMethod, requireAdmin } from '../../../shared/http.ts'
import { createUser, listUsers, normalizeQuota, readSettings, usedTokens } from '../../../shared/users.ts'

/**
 * `GET /admin/users` lists every account with its usage.
 * `POST /admin/users` creates one.
 *
 * Password hashes never leave this function, so the listing projects each
 * record field by field rather than spreading it.
 */
export async function onRequest(context: any): Promise<Response> {
  const auth = requireAdmin(context)
  if (!auth.ok) return auth.response

  const store = accountsStore()
  const method = requestMethod(context)

  if (method === 'GET') {
    const users = await listUsers(store)
    const rows = []
    for (const user of users) {
      rows.push({
        id: user.id,
        username: user.username,
        role: user.role,
        disabled: user.disabled,
        quotaTokens: user.quotaTokens,
        usedTokens: await usedTokens(store, user.id),
        createdAt: user.createdAt,
      })
    }
    return json({ users: rows })
  }

  if (method !== 'POST') return methodNotAllowed('GET, POST')

  const body = await readBody(context)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  // An absent quota field falls back to the deployment default; an explicit
  // null means unlimited.
  let quota: number | null
  if (body.quotaTokens === undefined) {
    quota = (await readSettings(store)).defaultQuotaTokens
  } else {
    const normalized = normalizeQuota(body.quotaTokens)
    if (normalized === undefined) return json({ ok: false, error: 'invalid-quota' }, 400)
    quota = normalized
  }

  const result = await createUser(store, { username, password, role: 'user', quotaTokens: quota })
  if (!result.ok) return json({ ok: false, error: result.error }, result.error === 'duplicate' ? 409 : 400)
  return json({ ok: true })
}
