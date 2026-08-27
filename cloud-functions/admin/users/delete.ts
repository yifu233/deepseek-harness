import { accountsStore } from '../../../shared/blob.ts'
import { json, methodNotAllowed, readBody, requestMethod, requireAdmin } from '../../../shared/http.ts'
import { deleteUser, readUser } from '../../../shared/users.ts'

/**
 * Remove an account, its username reservation, and its usage ledger.
 *
 * The user's sandbox workspace is not deleted here: it lives in the Agent
 * runtime's own storage keyed by conversation id, which this function cannot
 * reach. It becomes orphaned rather than removed — worth knowing before
 * deleting someone whose files matter.
 */
export async function onRequest(context: any): Promise<Response> {
  if (requestMethod(context) !== 'POST') return methodNotAllowed('POST')

  const auth = requireAdmin(context)
  if (!auth.ok) return auth.response

  const body = await readBody(context)
  const id = typeof body.id === 'string' ? body.id : ''
  if (id.length === 0) return json({ ok: false, error: 'not-found' }, 400)
  if (id === auth.claims.sub) return json({ ok: false, error: 'cannot-delete-self' }, 400)

  const store = accountsStore()
  const user = await readUser(store, id)
  if (user === undefined) return json({ ok: false, error: 'not-found' }, 404)

  await deleteUser(store, user)
  return json({ ok: true })
}
