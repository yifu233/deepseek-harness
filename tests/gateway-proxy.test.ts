import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeGatewayRequest } from '../agents/_gateway-proxy.ts'

test('Gateway adapter normalizes developer messages without mutating other fields', () => {
  const input = {
    model: 'test-model',
    messages: [
      { role: 'developer', content: 'system instructions' },
      { role: 'user', content: 'hello' },
    ],
    stream: true,
  }
  assert.deepEqual(normalizeGatewayRequest(input), {
    model: 'test-model',
    messages: [
      { role: 'system', content: 'system instructions' },
      { role: 'user', content: 'hello' },
    ],
    stream: true,
    // Without this a streamed completion reports no token counts, and
    // unreported tokens would silently defeat every per-user quota.
    stream_options: { include_usage: true },
  })
})

test('usage reporting is only requested for streamed calls', () => {
  const result = normalizeGatewayRequest({
    model: 'test-model',
    messages: [{ role: 'user', content: 'hello' }],
  })
  assert.equal('stream_options' in result, false)
})

test('a caller-supplied stream_options keeps its other fields', () => {
  const result = normalizeGatewayRequest({
    model: 'test-model',
    messages: [{ role: 'user', content: 'hello' }],
    stream: true,
    stream_options: { some_other_flag: true },
  })
  assert.deepEqual(result.stream_options, { some_other_flag: true, include_usage: true })
})
