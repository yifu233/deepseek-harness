/**
 * Edge gate. Rejects unauthenticated calls to the Host API before the Agent
 * runtime is woken at all, which is the point: starting a `dsh web` sidecar
 * costs a process, a gateway proxy, and an MCP bridge, and a stranger should
 * not be able to make the deployment pay that.
 *
 * This is early rejection, not the security boundary. `agents/api/_proxy.ts`
 * verifies the same cookie again and derives the caller's workspace from it,
 * because the middleware only proves a request is *from someone*, and the proxy
 * needs to know *who*.
 *
 * Runs in an edge V8 isolate: Web Crypto only, no `node:` imports, no npm
 * dependencies. The Node-side twin lives in `shared/jwt.ts`; the two must agree
 * on `JWT_SECRET` and on HS256.
 */

export const config = {
  matcher: [
    '/api/:path*',
    '/stop/:path*',
    '/stop',
  ],
}

const SESSION_COOKIE = 'dsh_session'

function unauthorized(reason) {
  return new Response(JSON.stringify({ error: 'unauthorized', message: reason }), {
    status: 401,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-dsh-auth': 'required',
    },
  })
}

function readCookie(headers, name) {
  const raw = headers.get('cookie') || ''
  for (const part of raw.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    if (part.slice(0, index).trim() !== name) continue
    return part.slice(index + 1).trim()
  }
  return ''
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(padded.length + (4 - padded.length % 4) % 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function utf8ToBytes(value) {
  return new TextEncoder().encode(value)
}

async function verifyJwt(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('malformed token')
  const [header, body, signature] = parts

  let alg
  try {
    alg = JSON.parse(new TextDecoder().decode(base64UrlToBytes(header))).alg
  } catch {
    throw new Error('malformed header')
  }
  // Pinned rather than read-and-trusted: this is what refuses `alg: none` and
  // algorithm-confusion tokens.
  if (alg !== 'HS256') throw new Error('unexpected alg')

  const key = await crypto.subtle.importKey(
    'raw',
    utf8ToBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(signature),
    utf8ToBytes(`${header}.${body}`),
  )
  if (!valid) throw new Error('bad signature')

  let claims
  try {
    claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)))
  } catch {
    throw new Error('malformed payload')
  }
  if (typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('expired')
  }
  return claims
}

export async function middleware(context) {
  const { request, next, env } = context

  const secret = typeof env?.JWT_SECRET === 'string' ? env.JWT_SECRET.trim() : ''
  if (secret.length < 16) {
    // Fail closed. A deployment without a signing secret cannot authenticate
    // anyone, and serving the Host API unguarded would be worse than an error.
    return new Response(JSON.stringify({
      error: 'server-misconfigured',
      message: 'JWT_SECRET is missing or shorter than 16 characters.',
    }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  const token = readCookie(request.headers, SESSION_COOKIE)
  if (!token) return unauthorized('no session cookie')

  try {
    await verifyJwt(token, secret)
  } catch (error) {
    return unauthorized(error?.message || 'verification failed')
  }

  return next()
}
