/*
 * Copies of media files kept in this browser (IndexedDB), so the editor's preview plays from disk
 * instead of streaming the ImageKit original: every cut in a video is a seek, and over the network
 * each seek has to buffer again. Export never reads these; it renders from ImageKit.
 *
 * Two stores: the files themselves, and a small entry per file (size, last used), so eviction
 * reads the entries without touching the files.
 */

const DB_NAME = "motion-local-media"
const FILES = "files"
const ENTRIES = "entries"

/** Least recently used copies go once the total passes this. */
export const LOCAL_MEDIA_CAP_BYTES = 2 * 1024 * 1024 * 1024

export type LocalEntry = { id: string; size: number; usedAt: number }

/** The ids to delete, oldest use first, until the total fits under the cap. Ids in `keep` stay. */
export function pickEvictions(entries: LocalEntry[], capBytes: number, keep: ReadonlySet<string>) {
  let total = 0
  for (const entry of entries) total += entry.size

  const oldestFirst = [...entries].sort((a, b) => a.usedAt - b.usedAt)
  const evict: string[] = []
  for (const entry of oldestFirst) {
    if (total <= capBytes) break
    if (keep.has(entry.id)) continue
    evict.push(entry.id)
    total -= entry.size
  }
  return evict
}

let database: Promise<IDBDatabase> | null = null

function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => {
      open.result.createObjectStore(FILES)
      open.result.createObjectStore(ENTRIES, { keyPath: "id" })
    }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
  return database
}

function settled<T>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function committed(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new DOMException("The transaction was aborted.", "AbortError"))
  })
}

/** The stored copy, or null when there isn't one. Reading it counts as a use. */
export async function readLocalMedia(id: string) {
  const db = await openDatabase()
  const transaction = db.transaction([FILES, ENTRIES], "readwrite")
  const done = committed(transaction)
  const file = settled<Blob | undefined>(transaction.objectStore(FILES).get(id))

  const entries = transaction.objectStore(ENTRIES)
  const entry = entries.get(id)
  entry.onsuccess = () => {
    const found: LocalEntry | undefined = entry.result
    if (found) entries.put({ ...found, usedAt: Date.now() } satisfies LocalEntry)
  }

  const [blob] = await Promise.all([file, done])
  return blob ?? null
}

/**
 * Stores a copy, first evicting the least recently used ones (never those in `keep`) to stay under
 * the cap. Rejects when the browser refuses the space (QuotaExceededError).
 */
export async function saveLocalMedia(id: string, blob: Blob, keep: ReadonlySet<string>) {
  const db = await openDatabase()

  const read = db.transaction(ENTRIES, "readonly")
  const existing = await settled<LocalEntry[]>(read.objectStore(ENTRIES).getAll())
  const next: LocalEntry = { id, size: blob.size, usedAt: Date.now() }
  const evict = pickEvictions([...existing.filter((entry) => entry.id !== id), next], LOCAL_MEDIA_CAP_BYTES, new Set([...keep, id]))

  const write = db.transaction([FILES, ENTRIES], "readwrite")
  const done = committed(write)
  for (const old of evict) {
    write.objectStore(FILES).delete(old)
    write.objectStore(ENTRIES).delete(old)
  }
  write.objectStore(FILES).put(blob, id)
  write.objectStore(ENTRIES).put(next)
  await done
}
