/**
 * Password hashing and at-rest sealing for user-supplied provider keys.
 *
 * Passwords are stored as scrypt hashes with a per-user salt, so the stored
 * form is useless to anyone who reads the namespace and two users who pick the
 * same password still get different hashes.
 *
 * Provider keys are sealed with AES-256-GCM under a key derived from
 * `JWT_SECRET`. Be clear about what this does and does not buy: it stops the
 * raw key from sitting in plaintext storage, and it stops one user from
 * reading another's. It does not hide anything from whoever controls the
 * deployment, because the unsealing key is on the same server. Anything that
 * claimed otherwise would be a lie — the server has to unseal the key to spend
 * it upstream.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_KEYLEN = 32
const SALT_BYTES = 16

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (error, derived) => {
      if (error) reject(error)
      else resolve(derived)
    })
  })
}

/** `scrypt$N$r$p$<saltB64>$<hashB64>` — self-describing so parameters can change later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN)
  return [
    'scrypt',
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) return false
  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(parts[4] ?? '', 'base64')
    expected = Buffer.from(parts[5] ?? '', 'base64')
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length === 0) return false
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, expected.length, { N, r, p }, (error, value) => {
      if (error) reject(error)
      else resolve(value)
    })
  }).catch(() => undefined)
  if (derived === undefined || derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

/** Compare two secrets of any length without leaking their contents by timing. */
export function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(left).digest(),
    createHash('sha256').update(right).digest(),
  )
}

function sealingKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'dsh-apikey-salt-v1', 'dsh-apikey-v1', 32))
}

/** `<ivB64>.<tagB64>.<cipherB64>` */
export function sealSecret(secret: string, plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', sealingKey(secret), iv)
  const sealed = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    sealed.toString('base64'),
  ].join('.')
}

/** `undefined` when the payload was truncated, tampered with, or sealed under another secret. */
export function openSecret(secret: string, sealed: string): string | undefined {
  const parts = sealed.split('.')
  if (parts.length !== 3) return undefined
  try {
    const decipher = createDecipheriv('aes-256-gcm', sealingKey(secret), Buffer.from(parts[0] ?? '', 'base64'))
    decipher.setAuthTag(Buffer.from(parts[1] ?? '', 'base64'))
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2] ?? '', 'base64')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return undefined
  }
}
