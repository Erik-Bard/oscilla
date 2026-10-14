const DATABASE = "oscilla-cache";
const STORED_SHAPE_VERSION = 2;
const STORE = "entries";

export function libraryKey(listenerId: string) {
  return `library:${listenerId}`;
}

export type Cached<T> = { key: string; value: T; openedAt: number };

let opening: Promise<IDBDatabase> | undefined;

function database() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, STORED_SHAPE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of Array.from(db.objectStoreNames))
        db.deleteObjectStore(name);
      db.createObjectStore(STORE, { keyPath: "key" }).createIndex(
        "openedAt",
        "openedAt",
      );
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opening;
}

async function inStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  try {
    const db = await database();
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    return await new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}

export function readCached<T>(key: string) {
  return inStore<Cached<T> | undefined>("readonly", (store) => store.get(key));
}

export async function writeCached<T>(key: string, value: T) {
  const entry: Cached<T> = { key, value, openedAt: Date.now() };
  await inStore("readwrite", (store) => store.put(entry));
}

export async function forgetCached(key: string) {
  await inStore("readwrite", (store) => store.delete(key));
}

export async function wipeCache() {
  await inStore("readwrite", (store) => store.clear());
}

export async function forgetCachedNotOpenedSince(cutoff: number) {
  try {
    const store = (await database())
      .transaction(STORE, "readwrite")
      .objectStore(STORE);
    const walk = store
      .index("openedAt")
      .openKeyCursor(IDBKeyRange.upperBound(cutoff));
    walk.onsuccess = () => {
      const cursor = walk.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
  } catch {
    return;
  }
}
