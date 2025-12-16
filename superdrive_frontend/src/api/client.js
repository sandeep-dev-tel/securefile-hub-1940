/**
 * Simple API client using fetch with JSON parsing and error handling.
 * All methods read base URL from env using utils/env.js.
 * In monolith mode, base URL is same-origin (empty string) so paths hit local Node server.
 */
import { getApiBaseUrl, getLogLevel } from "../utils/env";

const BASE = () => getApiBaseUrl();
const JSON_HEADERS = { "Content-Type": "application/json" };

function log(...args) {
  if (["debug", "info"].includes(getLogLevel())) {
    // eslint-disable-next-line no-console
    console.log("[api]", ...args);
  }
}

async function request(path, { method = "GET", headers = {}, body, raw = false } = {}) {
  const url = `${BASE()}${path.startsWith("/") ? "" : "/"}${path}`;
  const options = {
    method,
    headers: {
      ...headers,
      ...(body && !(body instanceof FormData) ? JSON_HEADERS : {}),
      // credentials handled by cookies or token if needed
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    credentials: "include",
  };
  log(method, url);

  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    let detail = "";
    try {
      if (contentType.includes("application/json")) {
        const j = await res.json();
        detail = j?.message || j?.detail || JSON.stringify(j);
      } else {
        detail = await res.text();
      }
    } catch {
      detail = `HTTP ${res.status}`;
    }
    const err = new Error(detail || `Request failed: ${res.status}`);
    err.status = res.status;
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
   * TODO: Confirm backend path and payload shape; assumed /auth/login.
   */
  async login({ username, password }) {
    return request("/auth/login", { method: "POST", body: { username, password } });
  },
  /**
   * Logout current session.
   * TODO: Confirm backend path.
   */
  async logout() {
    return request("/auth/logout", { method: "POST" });
  },
  /**
   * Get current user info.
   * TODO: Confirm backend path/response.
   */
  async me() {
    return request("/auth/me", { method: "GET" });
  },
};

// PUBLIC_INTERFACE
export const FilesAPI = {
  /**
   * List files and directories under a path.
   * TODO: Confirm backend path and response. Assumed: GET /files?path=/a/b
   */
  async list(path = "/") {
    const q = new URLSearchParams({ path });
    return request(`/files?${q.toString()}`, { method: "GET" });
  },
  /**
   * Create a directory.
   * TODO: Confirm backend path. Assumed: POST /dirs with { path, name }
   */
  async createDir(path, name) {
    return request("/dirs", { method: "POST", body: { path, name } });
  },
  /**
   * Rename a file or directory.
   * TODO: Confirm backend path. Assumed: POST /files/rename { path, newName }
   */
  async rename(path, newName) {
    return request("/files/rename", { method: "POST", body: { path, newName } });
  },
  /**
   * Move a file or directory.
   * TODO: Confirm backend path. Assumed: POST /files/move { from, to }
   */
  async move(from, to) {
    return request("/files/move", { method: "POST", body: { from, to } });
  },
  /**
   * Delete a file or directory.
   * TODO: Confirm backend path. Assumed: POST /files/delete { path }
   */
  async remove(path) {
    return request("/files/delete", { method: "POST", body: { path } });
  },
  /**
   * Upload one or more files using multipart/form-data.
   * TODO: Confirm backend path. Assumed: POST /files/upload with form fields: path, files[]
   */
  async upload(path, files) {
    const form = new FormData();
    form.append("path", path);
    for (const file of files) form.append("files", file);
    return request("/files/upload", { method: "POST", body: form });
  },
  /**
   * Download a file as a blob.
   * TODO: Confirm backend path. Assumed: GET /files/download?path=/a.txt
   */
  async download(path) {
    const q = new URLSearchParams({ path });
    return request(`/files/download?${q.toString()}`, { method: "GET", raw: true });
  },
};
