//
// IndexedDB helper utilities for SuperDrive Offline Mode
//
// Provides a simple wrapper for opening a DB, running transactions, and basic helpers.
// Stores:
// - entries: { id, type: 'file'|'dir', name, path, parentPath, size, modifiedAt }
// - files: { id, blob }
//
const DB_NAME = "superdrive_offline";
const DB_VERSION = 1;
const ENTRIES = "entries";
const FILES = "files";

// PUBLIC_INTERFACE
export async function openDB() {
  /** Open the IndexedDB database and create object stores/indexes if needed. */
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ENTRIES)) {
        const store = db.createObjectStore(ENTRIES, { keyPath: "id" });
        store.createIndex("by_parent", "parentPath", { unique: false });
        store.createIndex("by_path", "path", { unique: true });
      }
      if (!db.objectStoreNames.contains(FILES)) {
        db.createObjectStore(FILES, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// PUBLIC_INTERFACE
export async function withTx(mode, names, fn) {
  /** Run a function within a transaction over the specified store names. */
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode);
    const stores = names.map((n) => tx.objectStore(n));
    let done = false;
    const finish = (res) => {
      if (done) return;
      done = true;
      resolve(res);
    };
    const fail = (err) => {
      if (done) return;
      done = true;
      reject(err);
    };
    tx.oncomplete = () => finish(undefined);
    tx.onerror = () => fail(tx.error);
    tx.onabort = () => fail(tx.error || new Error("Transaction aborted"));
    Promise.resolve(fn(...stores))
      .then((res) => {
        // If user code resolved already, we still wait for tx completion event for durability.
        // res will be returned once tx completes.
        tx.addEventListener("complete", () => finish(res));
      })
      .catch((e) => {
        try {
          tx.abort();
        } catch {}
        fail(e);
      });
  });
}

// PUBLIC_INTERFACE
export async function resetDB() {
  /** Delete the entire IndexedDB database for a clean reset. */
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // best effort
  });
}

// Helpers
function normalizePath(p) {
  const v = (p || "/").trim();
  if (!v || v === "/") return "/";
  const cleaned = ("/" + v).replace(/\/+/g, "/");
  return cleaned.endsWith("/") && cleaned !== "/" ? cleaned.slice(0, -1) : cleaned;
}
function parentOf(p) {
  const n = normalizePath(p);
  if (n === "/") return null;
  const idx = n.lastIndexOf("/");
  return idx <= 0 ? "/" : n.slice(0, idx);
}

// PUBLIC_INTERFACE
export async function seedIfEmpty() {
  /** Initialize the DB with root and an optional sample folder/file on first run. */
  await withTx("readwrite", [ENTRIES, FILES], async (entries, files) => {
    const countReq = entries.count();
    const count = await new Promise((r, j) => {
      countReq.onsuccess = () => r(countReq.result || 0);
      countReq.onerror = () => j(countReq.error);
    });
    if (count > 0) return;

    const now = Date.now();
    const root = {
      id: "/",
      type: "dir",
      name: "/",
      path: "/",
      parentPath: null,
      size: undefined,
      modifiedAt: now,
    };
    entries.put(root);

    const sampleDir = {
      id: "/Sample",
      type: "dir",
      name: "Sample",
      path: "/Sample",
      parentPath: "/",
      size: undefined,
      modifiedAt: now,
    };
    entries.put(sampleDir);

    const sampleFilePath = "/Sample/Hello.txt";
    const sampleBlob = new Blob(
      [
        "Welcome to SuperDrive Offline!\n\n",
        "This is a sample file stored in your browser using IndexedDB.\n",
      ],
      { type: "text/plain" }
    );
    const fileEntry = {
      id: sampleFilePath,
      type: "file",
      name: "Hello.txt",
      path: sampleFilePath,
      parentPath: "/Sample",
      size: sampleBlob.size,
      modifiedAt: now,
    };
    entries.put(fileEntry);
    files.put({ id: sampleFilePath, blob: sampleBlob });
  });
}

// PUBLIC_INTERFACE
export async function listByParentPath(dirPath) {
  /** Return entries whose parentPath equals the given path, sorted: dirs first then by name. */
  const p = normalizePath(dirPath);
  return withTx("readonly", [ENTRIES], async (entries) => {
    const idx = entries.index("by_parent");
    const req = idx.getAll(p);
    const results = await new Promise((r, j) => {
      req.onsuccess = () => r(req.result || []);
      req.onerror = () => j(req.error);
    });
    results.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return results;
  });
}

// PUBLIC_INTERFACE
export async function getEntry(path) {
  /** Get a single entry by its path (id). Returns null if not found. */
  const p = normalizePath(path);
  return withTx("readonly", [ENTRIES], async (entries) => {
    const req = entries.get(p);
    return new Promise((r, j) => {
      req.onsuccess = () => r(req.result || null);
      req.onerror = () => j(req.error);
    });
  });
}

// PUBLIC_INTERFACE
export async function putEntry(entry) {
  /** Insert or update an entry in the entries store. */
  return withTx("readwrite", [ENTRIES], async (entries) => {
    entries.put(entry);
  });
}

// PUBLIC_INTERFACE
export async function deleteEntry(path) {
  /** Delete an entry by path (id). */
  const p = (path || "").trim();
  return withTx("readwrite", [ENTRIES], async (entries) => {
    entries.delete(p);
  });
}

// PUBLIC_INTERFACE
export async function getFileBlob(path) {
  /** Retrieve associated file blob for a file path. Returns null if not found. */
  const p = (path || "").trim();
  return withTx("readonly", [FILES], async (files) => {
    const req = files.get(p);
    return new Promise((r, j) => {
      req.onsuccess = () => r(req.result ? req.result.blob : null);
      req.onerror = () => j(req.error);
    });
  });
}

// PUBLIC_INTERFACE
export async function putFileBlob(path, blob) {
  /** Store blob under a file path. */
  const p = (path || "").trim();
  return withTx("readwrite", [FILES], async (files) => {
    files.put({ id: p, blob });
  });
}

// PUBLIC_INTERFACE
export async function deleteFileBlob(path) {
  /** Remove file blob associated with a path (if exists). */
  const p = (path || "").trim();
  return withTx("readwrite", [FILES], async (files) => {
    files.delete(p);
  });
}

// PUBLIC_INTERFACE
export async function listAllDirs(depthLimit = 3) {
  /** Build a small directory tree from root with limited depth for sidebar. */
  const build = async (startPath, depth) => {
    if (depth < 0) return [];
    const children = await listByParentPath(startPath);
    const dirs = children.filter((e) => e.type === "dir");
    const result = [];
    for (const d of dirs) {
      const kids = await build(d.path, depth - 1);
      result.push({ name: d.name, path: d.path, type: "dir", children: kids });
    }
    return result;
  };
  return build("/", depthLimit);
}

// PUBLIC_INTERFACE
export function pathHelpers() {
  /** Small helper utility for path normalization and parent determination. */
  return { normalizePath, parentOf };
}

