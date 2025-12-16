import React from "react";
import { getApiBaseUrl, getFrontendUrl, getWsUrl } from "../utils/env";
import { useApp } from "../context/AppContext";

// PUBLIC_INTERFACE
export default function SettingsPanel({ onClose }) {
  /** Small settings panel to view environment info and Offline Mode status, with ability to clear local data. */
  const { actions } = useApp();
  const apiBase = getApiBaseUrl() || "(unused in Offline Mode)";
  const ws = getWsUrl() || "(unused)";
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
      <div className="card" style={{ maxWidth: 560, width: "92%" }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <div className="badge" title="The app uses local IndexedDB for files and localStorage for session" style={{ marginBottom: 12 }}>
          Offline Mode: Enabled (IndexedDB)
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <div className="helper">API Base URL (not used in Offline Mode)</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {apiBase}
            </div>
          </div>
          <div>
            <div className="helper">WebSocket URL</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {ws}
            </div>
          </div>
          <div>
            <div className="helper">Frontend URL</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
              {fe}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button
            className="btn"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className="btn"
            onClick={async () => {
              await actions.refresh("/");
            }}
            title="Re-scan and reload current directory view"
          >
            🔄 Rescan
          </button>
          <button
            className="btn secondary"
            onClick={async () => {
              if (window.confirm("This will clear your local files and session. Continue?")) {
                await actions.clearLocalData();
                onClose?.();
              }
            }}
            title="Clear IndexedDB and local session"
          >
            🧹 Clear Local Data
          </button>
        </div>
      </div>
    </div>
  );
}
