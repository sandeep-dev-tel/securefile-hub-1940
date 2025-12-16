import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import SettingsPanel from "./SettingsPanel";

// PUBLIC_INTERFACE
export default function TopNav() {
  /** Top navigation bar with brand, current user, settings, and logout button. */
  const { state, actions } = useApp();
  const isGuest = !!state.user?.isGuest;
  const userLabel = state.user?.username || state.user?.name || (isGuest ? "Guest" : "Guest");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="topnav" role="navigation" aria-label="Top Navigation">
        <div className="brand">
          <div className="logo" aria-hidden>SD</div>
          <div>SuperDrive</div>
          <span className="badge" style={{ marginLeft: 8 }}>Ocean Professional</span>
          <span className="badge" style={{ marginLeft: 8 }} title="Files are stored locally in your browser">Offline</span>
        </div>
        <div className="topnav-actions">
          {state.loading && (
            <span className="helper" aria-live="polite" title="Background work in progress">
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  marginRight: 6,
                  background:
                    "radial-gradient(circle at 30% 30%, #93C5FD, #2563EB)",
                  animation: "sd-pulse 1s ease-in-out infinite"
                }}
              />
              Working...
            </span>
          )}
          <button
            className="btn ghost"
            onClick={() => setShowSettings(true)}
            aria-label="Open settings"
            title="Settings"
          >
            ⚙ Settings
          </button>
          <span className="helper">Signed in as</span>
          <strong>{userLabel}</strong>
          {state.user && (
            <button className="btn" onClick={() => actions.logout()} aria-label="Logout">
              Logout
            </button>
          )}
        </div>
      </div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <style>{`
        @keyframes sd-pulse {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
      `}</style>
    </>
  );
}
