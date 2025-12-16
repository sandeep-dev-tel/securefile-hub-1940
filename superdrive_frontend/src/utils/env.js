const get = (key, fallback = undefined) => {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
};

// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  /**
   * Resolve API base URL.
   * In monolith mode (node server.js), default is same-origin "" and the client
   * will automatically append "/api" when building request URLs.
   *
   * Override with:
   * - REACT_APP_API_BASE (e.g., "https://example.com/api") used as-is by client
   * - REACT_APP_BACKEND_URL (e.g., "https://example.com") and the client will append "/api"
   *
   * Note: User list is provided to the server (SUPERDRIVE_USERS/USERS_JSON). Frontend counterpart
   * variable name listed in deployment manifests may be REACT_APP_SUPERDRIVE_USERS, but the Node server
   * reads SUPERDRIVE_USERS. Ensure proper environment wiring when deploying monolith.
   */
  const base = get("REACT_APP_API_BASE") || get("REACT_APP_BACKEND_URL") || "";
  return (base || "").replace(/\/*$/, "");
}

// PUBLIC_INTERFACE
export function getFrontendUrl() {
  /** Return configured frontend URL if available. */
  return (get("REACT_APP_FRONTEND_URL") || "").replace(/\/*$/, "");
}

// PUBLIC_INTERFACE
export function getWsUrl() {
  /** Return configured websocket URL if available. */
  return (get("REACT_APP_WS_URL") || "").replace(/\/*$/, "");
}

// PUBLIC_INTERFACE
export function getLogLevel() {
  /** Return log level from env or default info. */
  return get("REACT_APP_LOG_LEVEL", "info");
}
