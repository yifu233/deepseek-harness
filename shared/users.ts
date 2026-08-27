/**
 * The account model: users, the first-admin latch, quotas, and the usage
 * ledger. Everything lives in one Blob namespace (see `blob.ts` for the key
 * layout).
 *
 * Two design notes worth knowing before changing anything here:
 *
 * Usernames are claimed through a separate latch key rather than by scanning
 * the user list, because two simultaneous creations of the same name would
 * both find the list clean and both write. The latch makes the winner
 * unambiguous.
 *
 * Usage is an append-only ledger instead of a counter, because Blob has no
 * atomic increment. Read-modify-write on a counter loses concurrent spends
 * silently; appending a uniquely-named entry per spend cannot lose one. The
 * cost is that a quota check sums a list, which is why entries carry their
 * token count in the key name and why a month gets compacted once it grows
 * past `COMPACT_THRESHOLD`.
 */
import { accountsStore, claimOnce, listAll, readJson, type BlobStore } from './blob.ts'
import { hashPassword, sealSecret, openSecret, verifyPassword } from './crypto.ts'

export interface UserRecord {
  id: string
  username: string
  role: 'admin' | 'user'
  passwordHash: string
  /** `null` means unlimited. */
  quotaTokens: number | null
  disabled: boolean
  createdAt: number
  /** AES-GCM sealed provider key; absent when the user uses the shared key. */
  privateKeySealed?: string
  privateBaseUrl?: string
}

export interface GlobalSettings {
  defaultQuotaTokens: number | null
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/
const MIN_PASSWORD_LENGTH = 8
const COMPACT_THRESHOLD = 200

/** Rejected outright; a shared deployment is exactly where these get tried. */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwertyui', 'qwerty123', 'iloveyou', 'admin123', 'administrator', 'letmein1',
  'welcome1', 'welcome123', 'abc12345', 'football', 'baseball', 'dragon123',
  'sunshine', 'princess', 'passw0rd', 'p@ssw0rd', 'changeme', 'deepseek',
])

export function validateUsername(username: unknown): boolean {
  return typeof username === 'string' && USERNAME_PATTERN.test(username)
}

export function validatePassword(password: unknown): boolean {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return false
  return !COMMON_PASSWORDS.has(password.toLowerCase())
}

/** `null` clears a quota (unlimited); anything not a non-negative integer is invalid. */
export function normalizeQuota(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return undefined
  return value
}

const userKey = (id: string): string => `users/${id}`
const usernameKey = (username: string): string => `index/username/${username.toLowerCase()}`
const usageMonthPrefix = (id: string, month: string): string => `usage/${id}/${month}/`
const usageUserPrefix = (id: string): string => `usage/${id}/`

/** The workspace identity. Derived from the user id, never from the browser. */
export function conversationIdFor(userId: string): string {
  return `u-${userId}`
}

export function userIdFromConversationId(conversationId: string): string | undefined {
  return conversationId.startsWith('u-') ? conversationId.slice(2) : undefined
}

function currentMonth(now: number = Date.now()): string {
  const date = new Date(now)
  return `${String(date.getUTCFullYear())}${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function readUser(store: BlobStore, id: string): Promise<UserRecord | undefined> {
  return readJson<UserRecord>(store, userKey(id))
}

export async function writeUser(store: BlobStore, user: UserRecord): Promise<void> {
  await store.setJSON(userKey(user.id), user)
}

export async function findUserByUsername(store: BlobStore, username: string): Promise<UserRecord | undefined> {
  const pointer = await readJson<{ id: string }>(store, usernameKey(username))
  if (pointer?.id === undefined) return undefined
  return readUser(store, pointer.id)
}

export async function listUsers(store: BlobStore): Promise<UserRecord[]> {
  const keys = await listAll(store, 'users/')
  const users: UserRecord[] = []
  for (const key of keys) {
    const user = await readJson<UserRecord>(store, key)
    if (user !== undefined) users.push(user)
  }
  return users.sort((left, right) => left.createdAt - right.createdAt)
}

export async function hasAdmin(store: BlobStore): Promise<boolean> {
  return (await readJson<{ claimed: boolean }>(store, 'admin/claimed')) !== undefined
}

export type CreateUserFailure = 'duplicate' | 'invalid-username' | 'weak-password'

/**
 * Create a user, reserving the username first. The reservation is what makes
 * concurrent creation of the same name safe; if it loses, nothing else is
 * written.
 */
export async function createUser(
  store: BlobStore,
  input: { username: string; password: string; role: 'admin' | 'user'; quotaTokens: number | null },
): Promise<{ ok: true; user: UserRecord } | { ok: false; error: CreateUserFailure }> {
  if (!validateUsername(input.username)) return { ok: false, error: 'invalid-username' }
  if (!validatePassword(input.password)) return { ok: false, error: 'weak-password' }

  const id = crypto.randomUUID()
  if (!await claimOnce(store, usernameKey(input.username), { id })) {
    return { ok: false, error: 'duplicate' }
  }

  const user: UserRecord = {
    id,
    username: input.username,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    quotaTokens: input.quotaTokens,
    disabled: false,
    createdAt: Date.now(),
  }
  await writeUser(store, user)
  return { ok: true, user }
}

/**
 * Take the administrator seat. The latch is claimed before the user is
 * created, so of several simultaneous claims exactly one proceeds and the rest
 * are told the seat is taken.
 *
 * This is genuinely first-come-first-served, which is what was asked for: the
 * deployment is reachable the moment it goes live, so whoever opens it first
 * becomes the administrator. `DSH_ADMIN_RESET` exists for the case where that
 * was not you.
 */
export async function claimAdmin(
  store: BlobStore,
  input: { username: string; password: string },
): Promise<{ ok: true; user: UserRecord } | { ok: false; error: CreateUserFailure | 'already-claimed' }> {
  if (!validateUsername(input.username)) return { ok: false, error: 'invalid-username' }
  if (!validatePassword(input.password)) return { ok: false, error: 'weak-password' }
  if (!await claimOnce(store, 'admin/claimed', { claimed: true, at: Date.now() })) {
    return { ok: false, error: 'already-claimed' }
  }
  const created = await createUser(store, { ...input, role: 'admin', quotaTokens: null })
  if (!created.ok) {
    // The latch is intentionally left set. Releasing it here would reopen the
    // seat to whoever is watching, and the operator can clear it deliberately
    // with DSH_ADMIN_RESET.
    return created
  }
  return created
}

export async function authenticate(
  store: BlobStore,
  username: string,
  password: string,
): Promise<{ ok: true; user: UserRecord } | { ok: false; error: 'invalid-credentials' | 'disabled' }> {
  const user = await findUserByUsername(store, username)
  if (user === undefined) {
    // Spend comparable work on an unknown username so the response time does
    // not reveal which half failed.
    await hashPassword(password)
    return { ok: false, error: 'invalid-credentials' }
  }
  if (!await verifyPassword(password, user.passwordHash)) return { ok: false, error: 'invalid-credentials' }
  if (user.disabled) return { ok: false, error: 'disabled' }
  return { ok: true, user }
}

export async function deleteUser(store: BlobStore, user: UserRecord): Promise<void> {
  await store.delete(usernameKey(user.username))
  await store.delete(userKey(user.id))
  for (const key of await listAll(store, usageUserPrefix(user.id))) await store.delete(key)
}

/** Tokens spent, ever, across every month bucket. */
export async function usedTokens(store: BlobStore, userId: string): Promise<number> {
  return (await listAll(store, usageUserPrefix(userId))).reduce(
    (total, key) => total + tokensInLedgerKey(key),
    0,
  )
}

/** The trailing `-<tokens>` of a ledger key; 0 for anything unparseable. */
function tokensInLedgerKey(key: string): number {
  const last = key.slice(key.lastIndexOf('/') + 1)
  const tokens = Number(last.slice(last.lastIndexOf('-') + 1))
  return Number.isSafeInteger(tokens) && tokens > 0 ? tokens : 0
}

/**
 * Append one spend. The key is unique per call, so no concurrent write is ever
 * lost — which is the whole reason usage is a ledger and not a counter.
 */
export async function recordUsage(store: BlobStore, userId: string, tokens: number): Promise<void> {
  if (!Number.isSafeInteger(tokens) || tokens <= 0) return
  const month = currentMonth()
  const stamp = `${String(Date.now())}-${crypto.randomUUID().slice(0, 8)}-${String(tokens)}`
  await store.set(`${usageMonthPrefix(userId, month)}${stamp}`, '1')
  await compactIfNeeded(store, userId, month)
}

/**
 * Fold a month's entries into one rollup once the list grows long enough,
 * under a lock so two compactors cannot both fold the same entries.
 *
 * The rollup is written *before* the originals are deleted. A crash in between
 * therefore over-counts rather than under-counts: the user is billed twice for
 * a slice of usage instead of getting it free. For a quota that is the safe
 * direction to fail in.
 */
async function compactIfNeeded(store: BlobStore, userId: string, month: string): Promise<void> {
  const prefix = usageMonthPrefix(userId, month)
  const keys = await listAll(store, prefix)
  if (keys.length <= COMPACT_THRESHOLD) return

  const lockKey = `usage-lock/${userId}/${month}`
  if (!await claimOnce(store, lockKey, { at: Date.now() })) return
  try {
    const total = keys.reduce((sum, key) => sum + tokensInLedgerKey(key), 0)
    if (total <= 0) return
    // `0-rollup-` sorts ahead of the millisecond stamps it replaces.
    await store.set(`${prefix}0-rollup-${crypto.randomUUID().slice(0, 8)}-${String(total)}`, '1')
    for (const key of keys) await store.delete(key)
  } finally {
    await store.delete(lockKey)
  }
}

export async function readSettings(store: BlobStore): Promise<GlobalSettings> {
  return await readJson<GlobalSettings>(store, 'settings/global') ?? { defaultQuotaTokens: null }
}

export async function writeSettings(store: BlobStore, settings: GlobalSettings): Promise<void> {
  await store.setJSON('settings/global', settings)
}

/** Seal a provider key for storage, or clear it. */
export async function setPrivateKey(
  store: BlobStore,
  secret: string,
  user: UserRecord,
  apiKey: string | null,
  baseUrl: string | null,
): Promise<void> {
  const next: UserRecord = { ...user }
  if (apiKey === null || apiKey.trim().length === 0) {
    delete next.privateKeySealed
    delete next.privateBaseUrl
  } else {
    next.privateKeySealed = sealSecret(secret, apiKey.trim())
    if (baseUrl !== null && baseUrl.trim().length > 0) next.privateBaseUrl = baseUrl.trim()
    else delete next.privateBaseUrl
  }
  await writeUser(store, next)
}

/** The plaintext provider key, or `undefined` when the user has none stored. */
export function privateKeyOf(secret: string, user: UserRecord): string | undefined {
  return user.privateKeySealed === undefined ? undefined : openSecret(secret, user.privateKeySealed)
}

/**
 * Whether this user may spend more. `withinQuota` is false only for a user
 * with a quota who has already reached it.
 *
 * Concurrent requests can each pass this check before any of their spends are
 * recorded, so a burst may overshoot by roughly one request's worth per
 * in-flight call. Blob offers no atomic compare-and-increment, so a hard cap is
 * not available; the ledger guarantees nothing is *lost*, not that nothing
 * overshoots.
 */
export async function checkQuota(
  store: BlobStore,
  user: UserRecord,
): Promise<{ withinQuota: boolean; used: number; quota: number | null }> {
  if (user.quotaTokens === null) return { withinQuota: true, used: await usedTokens(store, user.id), quota: null }
  const used = await usedTokens(store, user.id)
  return { withinQuota: used < user.quotaTokens, used, quota: user.quotaTokens }
}

export { accountsStore }
