//
// Files Adapter Interface and Offline IndexedDB Implementation
//
import {
  seedIfEmpty,
  listByParentPath,
  getEntry,
  putEntry,
  deleteEntry,
  getFileBlob,
  putFileBlob,
  deleteFileBlob,
  listAllDirs,
  pathHelpers,
} from "./indexeddb";

// PUBLIC_INTERFACE
export class FilesAdapter {
  /** Abstract files adapter. */
  // PUBLIC_INTERFACE
  async init() {
    /** Initialize storage (e.g., open DB / seed). */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async list(path = "/") {
    /** Return { entries, tree } under the path. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async createFolder(path, name) {
    /** Create directory with given name under path. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async rename(path, newName) {
    /** Rename entry path to same parent with newName. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async move(from, to) {
    /** Move entry from path to directory path 'to'. Keeps original name. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async remove(path) {
    /** Remove file or directory recursively. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async upload(path, files) {
    /** Upload one or more files to the directory path. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async download(path) {
    /** Return Blob for a file. */
    throw new Error("Not implemented");
  }
}

function assertValidName(name) {
  const n = String(name || "").trim();
  if (!n) throw new Error("Invalid name");
  if (/[\\/]/.test(n)) throw new Error("Name cannot contain path separators");
  return n;
}

async function entryExistsAt(parentPath, name) {
  const { normalizePath } = pathHelpers();
  const p = normalizePath(parentPath);
  const safeName = String(name || "").trim();
  const targetPath = (p === "/" ? "" : p) + "/" + safeName;
  const existing = await getEntry(targetPath.replace(/\/+/g, "/"));
  return !!existing;
}

async function updateChildrenPaths(oldBase, newBase) {
  // Move all descendants paths to new base; used for renames and moves
  const queue = [oldBase];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const children = await listByParentPath(current);
    for (const ch of children) {
      const subOld = ch.path;
      const relative = subOld.slice(oldBase.length);
      const subNew = (newBase + relative).replace(/\/+/g, "/");
      await deleteEntry(subOld);
      await putEntry({ ...ch, id: subNew, path: subNew, parentPath: ch.parentPath.replace(oldBase, newBase) });
      if (ch.type === "dir") {
        queue.push(subNew);
      } else {
        // move file blob
        const b = await getFileBlob(subOld);
        if (b) {
          await deleteFileBlob(subOld);
          await putFileBlob(subNew, b);
        }
      }
    }
  }
}

// PUBLIC_INTERFACE
export class OfflineFilesAdapter extends FilesAdapter {
  /** IndexedDB-backed implementation for all file and directory operations. */
  async init() {
    await seedIfEmpty();
    return true;
  }

  async list(path = "/") {
    const { normalizePath } = pathHelpers();
    const p = normalizePath(path);
    const dir = await getEntry(p);
    if (!dir) {
      if (p !== "/") throw new Error("Path not found");
    } else if (dir.type !== "dir") {
      throw new Error("Path is not a directory");
    }
    const entries = await listByParentPath(p);
    const safeEntries = Array.isArray(entries) ? entries : [];
    // map modifiedAt to modified for UI table compatibility
    const mapped = safeEntries.map((e) => ({
      ...e,
      modified: e.modifiedAt != null ? e.modifiedAt : e.modified,
    }));
    const tree = await listAllDirs(3);
    const safeTree = Array.isArray(tree) ? tree : [];
    return { entries: mapped, tree: safeTree };
  }

  async createFolder(path, name) {
    const { normalizePath } = pathHelpers();
    const p = normalizePath(path);
    const safe = assertValidName(name);
    if (await entryExistsAt(p, safe)) {
      const err = new Error("A file or folder with that name already exists");
      err.code = "EEXIST";
      throw err;
    }
    const now = Date.now();
    const newPath = (p === "/" ? "" : p) + "/" + safe;
    const entry = {
      id: newPath,
      type: "dir",
      name: safe,
      path: newPath,
      parentPath: p,
      size: undefined,
      modifiedAt: now,
    };
    await putEntry(entry);
    return { created: true, entry };
  }

  async rename(path, newName) {
    const { normalizePath, parentOf } = pathHelpers();
    const target = normalizePath(path);
    const safe = assertValidName(newName);
    const entry = await getEntry(target);
    if (!entry) throw new Error("Not found");
    const parent = parentOf(target);
    if (await entryExistsAt(parent, safe)) throw new Error("A file or folder with that name already exists");

    const newPath = (parent === "/" ? "" : parent) + "/" + safe;
    // move entry
    await deleteEntry(entry.path);
    const updated = { ...entry, id: newPath, name: safe, path: newPath, parentPath: parent, modifiedAt: Date.now() };
    await putEntry(updated);
    if (entry.type === "dir") {
      // cascade update of children paths
      await updateChildrenPaths(target, newPath);
    } else {
      // move blob
      const b = await getFileBlob(target);
      if (b) {
        await deleteFileBlob(target);
        await putFileBlob(newPath, b);
      }
    }
    return true;
  }

  async move(from, to) {
    const { normalizePath, parentOf } = pathHelpers();
    const src = normalizePath(from);
    const dstDir = normalizePath(to);
    const entry = await getEntry(src);
    if (!entry) throw new Error("Not found");
    const dir = await getEntry(dstDir);
    if (!dir || dir.type !== "dir") throw new Error("Destination is not a directory");
    if (await entryExistsAt(dstDir, entry.name)) throw new Error("A file or folder with that name already exists");

    const newPath = (dstDir === "/" ? "" : dstDir) + "/" + entry.name;
    await deleteEntry(entry.path);
    const updated = { ...entry, id: newPath, path: newPath, parentPath: dstDir, modifiedAt: Date.now() };
    await putEntry(updated);
    if (entry.type === "dir") {
      await updateChildrenPaths(src, newPath);
    } else {
      const b = await getFileBlob(src);
      if (b) {
        await deleteFileBlob(src);
        await putFileBlob(newPath, b);
      }
    }
    return true;
  }

  async remove(path) {
    const entry = await getEntry(path);
    if (!entry) return true;
    if (entry.type === "dir") {
      // delete recursively: BFS
      const queue = [entry.path];
      const toDeleteFiles = [];
      const toDeleteEntries = [];
      while (queue.length) {
        const current = queue.shift();
        const kids = await listByParentPath(current);
        for (const k of kids) {
          if (k.type === "dir") queue.push(k.path);
          else toDeleteFiles.push(k.path);
          toDeleteEntries.push(k.path);
        }
      }
      // delete children first
      for (const f of toDeleteFiles) await deleteFileBlob(f);
      for (const e of toDeleteEntries) await deleteEntry(e);
      await deleteEntry(entry.path);
    } else {
      await deleteFileBlob(entry.path);
      await deleteEntry(entry.path);
    }
    return true;
  }

  async upload(path, files) {
    // Normalize inputs early to avoid inconsistent keys and ensure parent path correctness.
    const { normalizePath } = pathHelpers();
    const dirPath = normalizePath(path);
    const dir = await getEntry(dirPath);
    if (!dir || dir.type !== "dir") throw new Error("Destination is not a directory");

    // Pre-validate names to fail fast before any writes.
    for (const f of files) {
      const name = assertValidName(f.name || "upload");
      if (await entryExistsAt(dirPath, name)) {
        throw new Error(`Name conflict: ${name} already exists`);
      }
    }

    const now = Date.now();
    // Sequentially store entries and blobs to keep transactions brief and avoid open handles.
    for (const f of files) {
      const name = assertValidName(f.name || "upload");
      const full = (dirPath === "/" ? "" : dirPath) + "/" + name;
      const blob = f instanceof Blob ? f : new Blob([f], { type: f.type || "application/octet-stream" });
      const entry = {
        id: full,
        type: "file",
        name,
        path: full,
        parentPath: dirPath,
        size: blob.size,
        modifiedAt: now,
      };
      await putEntry(entry);      // separate short tx
      await putFileBlob(full, blob); // separate short tx
    }

    // Allow UI to yield before refresh to avoid any potential re-render lockups in some browsers
    await Promise.resolve();

    return true;
  }

  async download(path) {
    const e = await getEntry(path);
    if (!e || e.type !== "file") throw new Error("File not found");
    const blob = await getFileBlob(path);
    if (!blob) throw new Error("File content missing");
    return blob;
  }
}

