import { accountsStore } from '../../shared/blob.ts'
import { json, methodNotAllowed, readBody, requestMethod, requireAdmin } from '../../shared/http.ts'
import { normalizeQuota, readSettings, writeSettings } from '../../shared/users.ts'

/** Deployment-wide defaults. `GET` reads, `POST` replaces. */
export async function onRequest(context: any): Promise<Response> {
  const auth = requireAdmin(context)
  if (!auth.ok) return auth.response

  const store = accountsStore()
  const method = requestMethod(context)

  if (method === 'GET') return json(await readSettings(store))
  if (method !== 'POST') return methodNotAllowed('GET, POST')

  const body = await readBody(context)
  const quota = normalizeQuota(body.defaultQuotaTokens)
  if (quota === undefined) return json({ ok: false, error: 'invalid-quota' }, 400)

  await writeSettings(store, { defaultQuotaTokens: quota })
  return json({ ok: true })
}
