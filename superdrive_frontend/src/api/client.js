/**
 * Simple API client using fetch with JSON parsing and error handling.
 * All methods read base URL from env using utils/env.js.
 * In monolith mode, base URL is same-origin (empty string) so paths hit local Node server.
 */
import { getApiBaseUrl, getLogLevel } from "../utils/env";

// Default to same-origin API base. Ensure it includes /api prefix for all API calls.
const BASE = () => {
  const base = getApiBaseUrl();
  // If base explicitly includes /api or is absolute, use as-is; otherwise append /api
  if (!base) return "/api";
  return base.endsWith("/api") ? base : `${base}/api`;
};
const JSON_HEADERS = { "Content-Type": "application/json" };

function log(...args) {
  if (["debug", "info"].includes(getLogLevel())) {
    // eslint-disable-next-line no-console
    console.log("[api]", ...args);
  }
}

async function request(path, { method = "GET", headers = {}, body, raw = false } = {}) {
  const base = BASE();
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const options = {
    method,
    headers: {
      ...headers,
      ...(body && !(body instanceof FormData) ? JSON_HEADERS : {}),
      // credentials handled by cookies or token if needed
      // For guest mode we do not add any auth header, backend uses cookie session only.
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    credentials: "include",
  };
  log(method, url);

  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    const err = new Error(
      `Network error contacting API at ${url}. Check REACT_APP_API_BASE/REACT_APP_BACKEND_URL and server availability.`
    );
    err.cause = networkErr;
    err.status = 0;
    throw err;
  }

  const contentType = res?.headers?.get?.("content-type") || "";

  if (!res || !res.ok) {
    let detail = "";
    try {
      if (contentType.includes("application/json")) {
        const j = await res.json();
        detail = j?.message || j?.detail || j?.error || (typeof j === "string" ? j : JSON.stringify(j));
      } else if (res) {
        detail = await res.text();
      }
    } catch {
      // ignore parse errors
    }
    const status = res?.status ?? 0;
    if (!detail) detail = status ? `HTTP ${status}` : "Request failed";
    const err = new Error(detail);
    err.status = status;
    throw err;
  }

  if (raw) return res;

  if (contentType.includes("application/json")) return res.json();
  if (contentType.includes("text/")) return res.text();
  return res.blob();
}

// PUBLIC_INTERFACE
export const AuthAPI = {
  /**
   * Login with username and password.
   */
  async login({ username, password }) {
    return request("/auth/login", { method: "POST", body: { username, password } });
  },
  /**
   * Logout current session.
   */
  async logout() {
    return request("/auth/logout", { method: "POST" });
  },
  /**
   * Get current user info.
   */
  async me() {
    return request("/auth/me", { method: "GET" });
  },
};

// PUBLIC_INTERFACE
export const FilesAPI = {
  /**
   * List files and directories under a path.
   */
  async list(path = "/") {
    const q = new URLSearchParams({ path });
    return request(`/files?${q.toString()}`, { method: "GET" });
  },
  /**
   * Create a directory.
   */
  async createDir(path, name) {
    return request("/dirs", { method: "POST", body: { path, name } });
  },
  /**
   * Rename a file or directory.
   */
  async rename(path, newName) {
    return request("/files/rename", { method: "POST", body: { path, newName } });
  },
  /**
   * Move a file or directory.
   */
  async move(from, to) {
    return request("/files/move", { method: "POST", body: { from, to } });
  },
  /**
   * Delete a file or directory.
   */
  async remove(path) {
    return request("/files/delete", { method: "POST", body: { path } });
  },
  /**
   * Upload one or more files using multipart/form-data.
   */
  async upload(path, files) {
    const form = new FormData();
    form.append("path", path);
    for (const file of files) form.append("files", file);
    return request("/files/upload", { method: "POST", body: form });
  },
  /**
   * Download a file as a blob.
   */
  async download(path) {
    const q = new URLSearchParams({ path });
    return request(`/files/download?${q.toString()}`, { method: "GET", raw: true });
  },
};

// PUBLIC_INTERFACE
export function isGuestLoginEnabled() {
  /** Helper to check guest login feature flag. */
  const flags = process.env.REACT_APP_FEATURE_FLAGS || "";
  if (!flags) return true;
  return flags.split(",").map((s) => s.trim()).includes("guest-login");
}
