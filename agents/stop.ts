import { stopDshWebSidecar } from './_dsh-web-sidecar.ts'
import { identify } from './_session.ts'

/**
 * Abort this caller's own run.
 *
 * The conversation id comes from the verified session, not from the request
 * body. Taking it from the body would let any signed-in user kill anyone
 * else's sidecar mid-run just by naming it.
 */
export async function onRequestPost(context: any): Promise<Response> {
  const gate = identify(context)
  if (!gate.ok) return gate.response

  const conversationId = gate.identity.conversationId
  const webAborted = await stopDshWebSidecar(conversationId)
  const platformResult = await context.utils?.abortActiveRun?.(conversationId)
  return Response.json({
    ok: true,
    conversation_id: conversationId,
    web_aborted: webAborted,
    aborted: platformResult?.aborted === true,
  }, {
    headers: { 'cache-control': 'no-store' },
  })
}
