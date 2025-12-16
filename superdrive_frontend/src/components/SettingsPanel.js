import React from "react";
import { getApiBaseUrl, getFrontendUrl, getWsUrl } from "../utils/env";

// PUBLIC_INTERFACE
export default function SettingsPanel({ onClose }) {
  /** Small settings panel to view current API base URLs and env-driven config. */
  const apiBase = getApiBaseUrl() || "(same-origin)";
  const ws = getWsUrl() || "(unset)";
  const fe = getFrontendUrl() || "(unset)";

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.25)",
      display: "grid",
      placeItems: "center",
      zIndex: 50
    }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="card" style={{ maxWidth: 520, width: "92%" }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <div className="helper" style={{ marginBottom: 12 }}>
          These values are read from environment variables when the app builds/runs.
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <div className="helper">API Base URL (REACT_APP_API_BASE or REACT_APP_BACKEND_URL)</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {apiBase}
            </div>
          </div>
          <div>
            <div className="helper">WebSocket URL (REACT_APP_WS_URL)</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {ws}
            </div>
          </div>
          <div>
            <div className="helper">Frontend URL (REACT_APP_FRONTEND_URL)</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {fe}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
