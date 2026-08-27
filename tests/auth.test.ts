import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, openSecret, sealSecret, verifyPassword } from '../shared/crypto.ts'
import { clearedSessionCookie, sessionCookie, signSession, verifySession } from '../shared/jwt.ts'
import { conversationIdFor, normalizeQuota, userIdFromConversationId, validatePassword, validateUsername } from '../shared/users.ts'

const SECRET = 'test-secret-at-least-16-chars-long'

test('a password verifies against its own hash and nothing else', async () => {
  const stored = await hashPassword('correct horse battery')
  assert.equal(await verifyPassword('correct horse battery', stored), true)
  assert.equal(await verifyPassword('correct horse batterz', stored), false)
  assert.equal(await verifyPassword('', stored), false)
})

test('the same password hashes differently every time', async () => {
  const first = await hashPassword('same-password-here')
  const second = await hashPassword('same-password-here')
  assert.notEqual(first, second)
  assert.equal(await verifyPassword('same-password-here', first), true)
  assert.equal(await verifyPassword('same-password-here', second), true)
})

test('a malformed hash is rejected rather than throwing', async () => {
  for (const bad of ['', 'nonsense', 'scrypt$1$2$3', 'bcrypt$1$2$3$aa$bb']) {
    assert.equal(await verifyPassword('whatever', bad), false)
  }
})

test('a sealed provider key round-trips only under the same secret', () => {
  const sealed = sealSecret(SECRET, 'sk-provider-key')
  assert.doesNotMatch(sealed, /sk-provider-key/)
  assert.equal(openSecret(SECRET, sealed), 'sk-provider-key')
  assert.equal(openSecret('another-secret-at-least-16-chars', sealed), undefined)
})

test('a tampered sealed key is refused, not silently mangled', () => {
  const sealed = sealSecret(SECRET, 'sk-provider-key')
  const parts = sealed.split('.')
  const flipped = `${parts[0]}.${parts[1]}.${Buffer.from('tampered').toString('base64')}`
  assert.equal(openSecret(SECRET, flipped), undefined)
  assert.equal(openSecret(SECRET, 'garbage'), undefined)
})

test('a signed session verifies and carries its claims', () => {
  const token = signSession(SECRET, { sub: 'user-1', username: 'alice', role: 'admin' })
  const claims = verifySession(SECRET, token)
  assert.equal(claims?.sub, 'user-1')
  assert.equal(claims?.username, 'alice')
  assert.equal(claims?.role, 'admin')
})

test('a session signed with another secret is refused', () => {
  const token = signSession('a-different-secret-16-chars-min', { sub: 'u', username: 'a', role: 'user' })
  assert.equal(verifySession(SECRET, token), undefined)
})

test('an expired session is refused', () => {
  const issuedLongAgo = Math.floor(Date.now() / 1000) - (8 * 24 * 60 * 60)
  const token = signSession(SECRET, { sub: 'u', username: 'a', role: 'user' }, issuedLongAgo)
  assert.equal(verifySession(SECRET, token), undefined)
})

test('an unsigned alg:none token is refused', () => {
  // The classic JWT forgery: claim no algorithm and supply no signature.
  const b64 = (value: string): string => Buffer.from(value, 'utf8').toString('base64url')
  const header = b64(JSON.stringify({ alg: 'none', typ: 'JWT' }))
  const body = b64(JSON.stringify({
    sub: 'attacker',
    username: 'attacker',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }))
  assert.equal(verifySession(SECRET, `${header}.${body}.`), undefined)
})

test('a tampered payload invalidates the signature', () => {
  const token = signSession(SECRET, { sub: 'user-1', username: 'alice', role: 'user' })
  const [header, , signature] = token.split('.')
  const forged = Buffer.from(JSON.stringify({
    sub: 'user-1',
    username: 'alice',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }), 'utf8').toString('base64url')
  assert.equal(verifySession(SECRET, `${header}.${forged}.${signature}`), undefined)
})

test('malformed tokens are refused rather than throwing', () => {
  for (const bad of ['', 'a', 'a.b', 'a.b.c.d', '...', 'not-base64.$$$.%%%']) {
    assert.equal(verifySession(SECRET, bad), undefined)
  }
})

test('the session cookie is HttpOnly, Secure and same-site', () => {
  const cookie = sessionCookie(signSession(SECRET, { sub: 'u', username: 'a', role: 'user' }))
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Secure/)
  assert.match(cookie, /SameSite=Lax/)
  assert.match(clearedSessionCookie(), /Max-Age=0/)
})

test('a workspace id round-trips to its user id', () => {
  assert.equal(conversationIdFor('abc'), 'u-abc')
  assert.equal(userIdFromConversationId('u-abc'), 'abc')
  // A workspace not minted by this system has no owner, so metering and quota
  // enforcement must refuse it rather than guess.
  assert.equal(userIdFromConversationId('abc'), undefined)
})

test('usernames are constrained and passwords have a floor', () => {
  assert.equal(validateUsername('alice'), true)
  assert.equal(validateUsername('a.b_c-d'), true)
  assert.equal(validateUsername('ab'), false)
  assert.equal(validateUsername('has space'), false)
  assert.equal(validateUsername('semi;colon'), false)
  assert.equal(validateUsername('a'.repeat(33)), false)

  assert.equal(validatePassword('a-decent-password'), true)
  assert.equal(validatePassword('short'), false)
  assert.equal(validatePassword('password'), false)
  assert.equal(validatePassword('PASSWORD123'), false)
})

test('quotas accept null for unlimited and reject nonsense', () => {
  assert.equal(normalizeQuota(null), null)
  assert.equal(normalizeQuota(0), 0)
  assert.equal(normalizeQuota(500_000), 500_000)
  assert.equal(normalizeQuota(-1), undefined)
  assert.equal(normalizeQuota(1.5), undefined)
  assert.equal(normalizeQuota('100'), undefined)
  assert.equal(normalizeQuota(undefined), undefined)
})
