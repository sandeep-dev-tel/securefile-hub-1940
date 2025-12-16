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
        </div>
        <div className="topnav-actions">
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
    </>
  );
}
