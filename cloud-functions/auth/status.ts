import { accountsStore } from '../../shared/blob.ts'
import { envString, json, sessionFrom } from '../../shared/http.ts'
import { hasAdmin } from '../../shared/users.ts'

/**
 * The first call the browser makes. It decides which of three things the
 * visitor sees: first-run setup, a login form, or the app itself.
 *
 * `hasAdmin` is not a secret — the setup form has to be reachable by whoever
 * arrives first, so hiding it would only break the flow.
 */
export async function onRequest(context: any): Promise<Response> {
  const secret = envString(context, 'JWT_SECRET')
  if (secret.length < 16) {
    return json({
      hasAdmin: false,
      authenticated: false,
      error: 'server-misconfigured',
      message: 'JWT_SECRET is missing or shorter than 16 characters.',
    }, 503)
  }

  let adminExists: boolean
  try {
    adminExists = await hasAdmin(accountsStore())
  } catch (error) {
    return json({
      hasAdmin: false,
      authenticated: false,
      error: 'storage-unavailable',
      message: error instanceof Error ? error.message : String(error),
    }, 503)
  }

  const claims = sessionFrom(context, secret)
  if (claims === undefined) return json({ hasAdmin: adminExists, authenticated: false })
  return json({
    hasAdmin: adminExists,
    authenticated: true,
    username: claims.username,
    role: claims.role,
  })
}
