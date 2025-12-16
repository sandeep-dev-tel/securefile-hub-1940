const get = (key, fallback = undefined) => {
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
};

// PUBLIC_INTERFACE
export function getApiBaseUrl() {
  /**
   * Resolve API base URL. In monolith mode, default is same-origin "".
   * You can still override with REACT_APP_API_BASE or REACT_APP_BACKEND_URL if needed.
   */
  const base = get("REACT_APP_API_BASE") || get("REACT_APP_BACKEND_URL") || "";
  return (base || "").replace(/\/+$/, "");
}

// PUBLIC_INTERFACE
export function getFrontendUrl() {
  /** Return configured frontend URL if available. */
  return (get("REACT_APP_FRONTEND_URL") || "").replace(/\/+$/, "");
}

// PUBLIC_INTERFACE
export function getWsUrl() {
  /** Return configured websocket URL if available. */
  return (get("REACT_APP_WS_URL") || "").replace(/\/+$/, "");
}

// PUBLIC_INTERFACE
export function getLogLevel() {
  /** Return log level from env or default info. */
  return get("REACT_APP_LOG_LEVEL", "info");
}
