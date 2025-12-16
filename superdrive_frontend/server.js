#!/usr/bin/env node
/**
 * SuperDrive Monolithic Server
 * - Serves React build statically in production mode
 * - Exposes local file APIs for auth and file management
 *
 * Configuration (via environment variables):
 * - PORT or REACT_APP_PORT: Port to listen on (default 3000)
 * - ROOT_DIR: Absolute path for storage root (default: <project>/data)
 * - SUPERDRIVE_USERS: JSON array of users [{ "username":"admin","password":"admin" }]
 * - USERS_JSON: Alternative to SUPERDRIVE_USERS; path to a JSON file with the same format
 * - REACT_APP_TRUST_PROXY: "true" to trust proxy headers (e.g., when deployed behind a proxy)
 * - REACT_APP_LOG_LEVEL: debug|info|warn|error
 *
 * Security basics:
 * - All file operations are restricted under ROOT_DIR
 * - Prevents directory traversal by resolving and checking target paths
 * - Sanitizes file/folder names
 * - Limits upload size
 */
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs/promises");

const express = require("express");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const cors = require("cors");

// Configuration
const PORT = parseInt(process.env.PORT || process.env.REACT_APP_PORT || "3000", 10);
const LOG_LEVEL = (process.env.REACT_APP_LOG_LEVEL || "info").toLowerCase();
const TRUST_PROXY = String(process.env.REACT_APP_TRUST_PROXY || "").toLowerCase() === "true";
const PROJECT_ROOT = path.resolve(__dirname);
const DEFAULT_DATA_DIR = path.join(PROJECT_ROOT, "data");
const ROOT_DIR = path.resolve(process.env.ROOT_DIR || DEFAULT_DATA_DIR);

// Ensure root dir exists
fs.mkdirSync(ROOT_DIR, { recursive: true });

// Users configuration
function loadUsers() {
  // format: [{ username, password }]
  if (process.env.SUPERDRIVE_USERS) {
    try {
      const arr = JSON.parse(process.env.SUPERDRIVE_USERS);
      if (Array.isArray(arr)) return arr;
    } catch {
      // ignore parse error
    }
  }
  if (process.env.USERS_JSON) {
    try {
      const raw = fs.readFileSync(path.resolve(process.env.USERS_JSON), "utf8");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    } catch {
      // ignore read error
    }
  }
  // default seed
  return [{ username: "admin", password: "admin" }];
}
const USERS = loadUsers();

// Simple logger
function log(level, ...args) {
  const levels = ["debug", "info", "warn", "error"];
  if (levels.indexOf(level) >= levels.indexOf(LOG_LEVEL)) {
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](`[${new Date().toISOString()}] [${level}]`, ...args);
  }
}

// Express app
const app = express();
if (TRUST_PROXY) app.set("trust proxy", 1);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS (optional, but in monolith same-origin; allow same-origin requests)
app.use(cors({ origin: true, credentials: true }));

// Auth handling using a signed cookie-less simple cookie
const SESSION_COOKIE = "sd_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// In-memory session store (simple)
const sessions = new Map();

function createSession(username) {
  const token = Buffer.from(`${username}:${Date.now()}:${Math.random()}`).toString("base64url");
  const expires = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { username, expires });
  return { token, expires };
}
function getSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const data = sessions.get(token);
  if (!data) return null;
  if (data.expires < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...data };
}
function destroySession(token) {
  sessions.delete(token);
}
function requireAuth(req, res, next) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ message: "Unauthorized" });
  req.user = { username: s.username };
  return next();
}

// Helpers: path validation and sanitization
function sanitizeName(name) {
  // remove illegal path characters and trim
  // disallow path separators and control chars
  return String(name).replace(/[\\\/\0\r\n\t]/g, "").trim();
}
function resolveUnderRoot(targetPath) {
  // allow absolute or relative path, normalize to ROOT_DIR
  const normalized = path.normalize(targetPath || "/");
  const rel = normalized.startsWith("/") ? normalized : `/${normalized}`;
  const full = path.resolve(ROOT_DIR, "." + rel);
  if (!full.startsWith(ROOT_DIR)) {
    throw Object.assign(new Error("Path outside ROOT"), { status: 400 });
  }
  return full;
}
async function ensureParentDir(p) {
  await fsPromises.mkdir(path.dirname(p), { recursive: true });
}

// Multer for uploads with size limit
const upload = multer({
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      try {
        const basePath = req.body?.path || "/";
        const targetDir = resolveUnderRoot(basePath);
        await fsPromises.mkdir(targetDir, { recursive: true });
        cb(null, targetDir);
      } catch (e) {
        cb(e);
      }
    },
    filename: function (req, file, cb) {
      const safe = sanitizeName(file.originalname || "upload");
      cb(null, safe || "upload");
    },
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 20,
  },
});

/**
 * Healthcheck
 * GET /api/health
 */
app.get("/api/health", (_req, res) => res.json({ ok: true, root: ROOT_DIR }));

// Routes: Auth
/**
 * POST /api/auth/login
 * body: { username, password }
 */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  const u = USERS.find((x) => x.username === username && x.password === password);
  if (!u) return res.status(401).json({ message: "Invalid credentials" });

  const session = createSession(u.username);
  res.cookie(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
  return res.json({ username: u.username });
});

/**
 * POST /api/auth/logout
 */
app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) destroySession(token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  return res.json({ ok: true });
});

/**
 * GET /api/auth/me
 */
app.get("/api/auth/me", (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ message: "Unauthorized" });
  return res.json({ username: s.username });
});

// Helpers: build tree and list entries
async function statEntry(fullPath, name) {
  const st = await fsPromises.stat(fullPath);
  return {
    name,
    type: st.isDirectory() ? "dir" : "file",
    size: st.isDirectory() ? undefined : st.size,
    modified: st.mtimeMs,
  };
}

async function listDirectory(targetPath) {
  const dirents = await fsPromises.readdir(targetPath, { withFileTypes: true });
  const entries = await Promise.all(
    dirents.map(async (d) => {
      const entryPath = path.join(targetPath, d.name);
      const st = await fsPromises.stat(entryPath);
      return {
        name: d.name,
        type: d.isDirectory() ? "dir" : "file",
        size: d.isDirectory() ? undefined : st.size,
        modified: st.mtimeMs,
      };
    })
  );
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

async function buildTree(startPath, depth = 2, relBase = "/") {
  // Limit depth for performance
  if (depth < 0) return [];
  let list = [];
  try {
    const dirents = await fsPromises.readdir(startPath, { withFileTypes: true });
    for (const d of dirents) {
      if (!d.isDirectory()) continue;
      const name = d.name;
      const childFull = path.join(startPath, name);
      const childRel = path.join(relBase, name).replace(/\\/g, "/");
      const children = await buildTree(childFull, depth - 1, childRel);
      list.push({ name, path: childRel.startsWith("/") ? childRel : "/" + childRel, type: "dir", children });
    }
  } catch (e) {
    // ignore tree build errors
  }
  return list;
}

// Routes: Files
/**
 * GET /api/files?path=/sub/dir
 * Response: { entries:[...], tree:[...] }
 */
app.get("/api/files", requireAuth, async (req, res) => {
  try {
    const reqPath = req.query.path || "/";
    const full = resolveUnderRoot(reqPath);
    const st = await fsPromises.stat(full).catch(() => null);
    if (!st) return res.status(404).json({ message: "Not found" });
    if (!st.isDirectory()) return res.status(400).json({ message: "Path is not a directory" });

    const [entries, tree] = await Promise.all([
      listDirectory(full),
      buildTree(ROOT_DIR, 2, "/"),
    ]);
    return res.json({ entries, tree });
  } catch (e) {
    log("error", "GET /files error", e.message);
    return res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

/**
 * POST /api/dirs { path, name }
 * Creates a directory under given path
 */
app.post("/api/dirs", requireAuth, async (req, res) => {
  try {
    const { path: basePath = "/", name } = req.body || {};
    const safe = sanitizeName(name);
    if (!safe) return res.status(400).json({ message: "Invalid folder name" });

    const parent = resolveUnderRoot(basePath);
    const target = path.join(parent, safe);
    await fsPromises.mkdir(target, { recursive: true });
    return res.json({ ok: true });
  } catch (e) {
    log("error", "POST /dirs error", e.message);
    return res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

/**
 * POST /api/files/upload multipart form: fields { path }, files "files"
 */
app.post("/api/files/upload", requireAuth, upload.array("files"), async (req, res) => {
  // multer already wrote files within ROOT_DIR
  return res.json({ ok: true, uploaded: (req.files || []).map((f) => ({ name: f.originalname, size: f.size })) });
});

/**
 * GET /api/files/download?path=/a/b.txt
 * Streams the file to client
 */
app.get("/api/files/download", requireAuth, async (req, res) => {
  try {
    const reqPath = req.query.path || "/";
    const full = resolveUnderRoot(reqPath);
    const st = await fsPromises.stat(full).catch(() => null);
    if (!st || !st.isFile()) return res.status(404).json({ message: "File not found" });

    res.setHeader("Content-Length", st.size);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(full)}"`);
    const stream = fs.createReadStream(full);
    stream.pipe(res);
  } catch (e) {
    log("error", "GET /files/download error", e.message);
    return res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

/**
 * POST /api/files/rename { path, newName }
 */
app.post("/api/files/rename", requireAuth, async (req, res) => {
  try {
    const { path: targetPath, newName } = req.body || {};
    if (!targetPath) return res.status(400).json({ message: "Missing path" });
    const safe = sanitizeName(newName);
    if (!safe) return res.status(400).json({ message: "Invalid new name" });

    const full = resolveUnderRoot(targetPath);
    const parent = path.dirname(full);
    const next = path.join(parent, safe);
    if (!next.startsWith(ROOT_DIR)) return res.status(400).json({ message: "Invalid target" });

    await fsPromises.rename(full, next);
    return res.json({ ok: true });
  } catch (e) {
    log("error", "POST /files/rename error", e.message);
    return res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

/**
 * POST /api/files/move { from, to }
 * 'to' is a directory path under root to move into (keeps original name)
 */
app.post("/api/files/move", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.body || {};
    if (!from || !to) return res.status(400).json({ message: "Missing from/to" });
    const src = resolveUnderRoot(from);
    const dstDir = resolveUnderRoot(to);

    const st = await fsPromises.stat(dstDir).catch(() => null);
    if (!st || !st.isDirectory()) return res.status(400).json({ message: "Destination is not a directory" });

    const base = path.basename(src);
    const dst = path.join(dstDir, base);
    await ensureParentDir(dst);
    await fsPromises.rename(src, dst);
    return res.json({ ok: true });
  } catch (e) {
    log("error", "POST /files/move error", e.message);
    return res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

/**
 * POST /api/files/delete { path }
 */
app.post("/api/files/delete", requireAuth, async (req, res) => {
  try {
    const { path: targetPath } = req.body || {};
    if (!targetPath) return res.status(400).json({ message: "Missing path" });
    const full = resolveUnderRoot(targetPath);
    const st = await fsPromises.stat(full).catch(() => null);
    if (!st) return res.status(404).json({ message: "Not found" });

    if (st.isDirectory()) {
      await fsPromises.rm(full, { recursive: true, force: true });
    } else {
      await fsPromises.unlink(full);
    }
    return res.json({ ok: true });
  } catch (e) {
    log("error", "POST /files/delete error", e.message);
    return res.status(e.status || 500).json({ message: e.message || "Server error" });
  }
});

/**
 * Legacy healthcheck compatibility: keep old path if provided
 */
app.get(process.env.REACT_APP_HEALTHCHECK_PATH || "/health", (_req, res) => res.json({ ok: true, root: ROOT_DIR }));

// Static serving: in production, serve build
const buildDir = path.join(__dirname, "build");
if (fs.existsSync(buildDir)) {
  // Serve static assets first
  app.use(express.static(buildDir, { index: false, maxAge: "1h", setHeaders: (res) => res.setHeader("Cache-Control", "public, max-age=3600") }));
  // SPA fallback - ensure API routes (/api) are not shadowed
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(buildDir, "index.html"));
  });
}

// Startup
app.listen(PORT, () => {
  log("info", `SuperDrive server listening on :${PORT}`);
  log("info", `ROOT_DIR = ${ROOT_DIR}`);
  log("info", `Users configured: ${USERS.map((u) => u.username).join(", ")}`);
  if (!fs.existsSync(buildDir)) {
    log("warn", "Build folder not found. In dev, React dev server may run separately; in production run `npm run build` first.");
  }
});
