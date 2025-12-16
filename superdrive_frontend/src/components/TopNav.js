import React from "react";
import { useApp } from "../context/AppContext";

// PUBLIC_INTERFACE
export default function TopNav() {
  /** Top navigation bar with brand, current user and logout button. */
  const { state, actions } = useApp();
  const userLabel = state.user?.username || state.user?.name || "Guest";

  return (
    <div className="topnav">
      <div className="brand">
        <div className="logo">SD</div>
        <div>SuperDrive</div>
        <span className="badge" style={{ marginLeft: 8 }}>Ocean Professional</span>
      </div>
      <div className="topnav-actions">
        <span className="helper">Signed in as</span>
        <strong>{userLabel}</strong>
        {state.user && (
          <button className="btn" onClick={() => actions.logout()} aria-label="Logout">
            Logout
          </button>
        )}
      </div>
    </div>
  );
}
