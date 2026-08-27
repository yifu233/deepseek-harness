/**
 * HS256 tokens over `node:crypto`, for the Node runtimes (Cloud Functions and
 * the Agent side). The edge middleware verifies the same tokens with Web
 * Crypto in `middleware.js`; that duplication is deliberate and matches the
 * platform's own auth example, because the two runtimes do not share a crypto
 * API and the middleware must stay dependency-free.
 *
 * Both halves must read the same `JWT_SECRET`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'dsh_session'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

export interface SessionClaims {
  sub: string
  username: string
  role: 'admin' | 'user'
  iat: number
  exp: number
}

function base64UrlEncode(value: Buffer | string): string {
  return (typeof value === 'string' ? Buffer.from(value, 'utf8') : value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded.padEnd(padded.length + (4 - padded.length % 4) % 4, '='), 'base64')
}

function signature(secret: string, payload: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(payload).digest())
}

export function signSession(
  secret: string,
  claims: { sub: string; username: string; role: 'admin' | 'user' },
  now: number = Math.floor(Date.now() / 1000),
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify({
    sub: claims.sub,
    username: claims.username,
    role: claims.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }))
  const payload = `${header}.${body}`
  return `${payload}.${signature(secret, payload)}`
}

/**
 * `undefined` for anything that is not a currently valid token. The algorithm
 * is pinned to HS256 rather than read from the header, which is what stops the
 * `alg: none` substitution and HMAC/RSA confusion families.
 */
export function verifySession(
  secret: string,
  token: string,
  now: number = Math.floor(Date.now() / 1000),
): SessionClaims | undefined {
  const parts = token.split('.')
  if (parts.length !== 3) return undefined
  const [header, body, provided] = parts as [string, string, string]

  let algorithm: unknown
  try {
    algorithm = (JSON.parse(base64UrlDecode(header).toString('utf8')) as { alg?: unknown }).alg
  } catch {
    return undefined
  }
  if (algorithm !== 'HS256') return undefined

  const expected = signature(secret, `${header}.${body}`)
  if (provided.length !== expected.length) return undefined
  if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return undefined

  let claims: SessionClaims
  try {
    claims = JSON.parse(base64UrlDecode(body).toString('utf8')) as SessionClaims
  } catch {
    return undefined
  }
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) return undefined
  if (claims.role !== 'admin' && claims.role !== 'user') return undefined
  if (!Number.isSafeInteger(claims.exp) || claims.exp <= now) return undefined
  return claims
}

/**
 * `Secure` is unconditional: browsers treat localhost as a trustworthy origin
 * so local development still receives the cookie, while a deployment reached
 * over plain http never leaks a usable session. `SameSite=Lax` rather than
 * `Strict` so following a link into the app keeps you signed in.
 */
export function sessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${String(SESSION_TTL_SECONDS)}`,
  ].join('; ')
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export function readCookie(headerValue: string, name: string): string {
  for (const part of headerValue.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() !== name) continue
    return part.slice(index + 1).trim()
  }
  return ''
}
