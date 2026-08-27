import { accountsStore } from '../../shared/blob.ts'
import { json, requireAuth } from '../../shared/http.ts'
import { clearedSessionCookie } from '../../shared/jwt.ts'
import { conversationIdFor, readUser, usedTokens } from '../../shared/users.ts'

/**
 * Who the caller is, and what they have spent. The user record is re-read
 * rather than trusted from the token, because a quota change, a disable, or a
 * deletion must take effect without waiting for the session to expire.
 */
export async function onRequest(context: any): Promise<Response> {
  const auth = requireAuth(context)
  if (!auth.ok) return auth.response

  const store = accountsStore()
  const user = await readUser(store, auth.claims.sub)
  if (user === undefined || user.disabled) {
    // The session is valid but the account behind it is gone or switched off;
    // clearing the cookie sends the browser back to the login card.
    return json({ ok: false, error: user === undefined ? 'not-found' : 'disabled' }, 401, {
      'set-cookie': clearedSessionCookie(),
      'x-dsh-auth': 'required',
    })
  }

  return json({
    username: user.username,
    role: user.role,
    conversationId: conversationIdFor(user.id),
    quotaTokens: user.quotaTokens,
    usedTokens: await usedTokens(store, user.id),
    hasPrivateKey: user.privateKeySealed !== undefined,
    privateBaseUrl: user.privateBaseUrl ?? null,
  })
}
