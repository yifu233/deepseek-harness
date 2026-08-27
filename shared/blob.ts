/**
 * The one Blob namespace this deployment stores accounts in.
 *
 * Reads pass `consistency: 'strong'` individually rather than relying on a
 * store-level default, because the store-level option is only accepted in the
 * external token mode; inside a Pages Function `getStore(name)` is
 * auto-authenticated and takes no options.
 *
 * Strong consistency is not optional for this data. Blob defaults to reading
 * through a CDN cache, which is wrong here in two ways: a user created a moment
 * ago must be able to sign in immediately, and a quota check that reads a stale
 * ledger hands out tokens that were already spent. This is admin-scale traffic,
 * so the extra latency costs nothing next to being wrong.
 *
 * Key layout, all under one namespace:
 *
 *   admin/claimed                                  the first-admin latch
 *   index/username/<lowercased>                    username uniqueness latch
 *   users/<userId>                                 the user record
 *   usage/<userId>/<YYYYMM>/<ts>-<rand>-<tokens>   append-only usage ledger
 *   settings/global                                deployment-wide settings
 *
 * Ledger entries carry their token count in the key name, so summing a month is
 * one `list` call instead of one read per entry.
 */
import { getStore, PreconditionFailedError, type Store } from '@edgeone/pages-blob'

const STORE_NAME = 'dsh-accounts'

export type BlobStore = Store

export function accountsStore(): BlobStore {
  return getStore(STORE_NAME)
}

/** Read one JSON record, or `undefined` when the key does not exist. */
export async function readJson<T>(store: BlobStore, key: string): Promise<T | undefined> {
  const value = await store.get(key, { type: 'json', consistency: 'strong' })
  return value === null || value === undefined ? undefined : value as T
}

/**
 * Claim a key exactly once.
 *
 * `onlyIfNew` is the only mutual-exclusion primitive Blob offers, and it is
 * what turns "the first person to arrive wins" into a real guarantee rather
 * than a race: concurrent callers all attempt the same write and exactly one
 * finds the key absent. Losing is an expected outcome, so it is reported as
 * `false` rather than thrown.
 */
export async function claimOnce(store: BlobStore, key: string, value: unknown): Promise<boolean> {
  try {
    await store.setJSON(key, value, { onlyIfNew: true })
    return true
  } catch (error) {
    if (error instanceof PreconditionFailedError) return false
    // An unfamiliar failure must not be reported as a lost race: that would
    // silently skip the caller's setup step. Confirm against what is stored.
    const stored = await readJson<unknown>(store, key)
    if (stored === undefined) throw error
    return JSON.stringify(stored) === JSON.stringify(value)
  }
}

/** Every key under a prefix. `list` aggregates pages itself by default. */
export async function listAll(store: BlobStore, prefix: string): Promise<string[]> {
  const page = await store.list({ prefix, consistency: 'strong' })
  return (page.blobs ?? []).map(blob => blob.key)
}
