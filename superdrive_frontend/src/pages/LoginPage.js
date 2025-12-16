import React, { useMemo, useState } from "react";
import { useApp } from "../context/AppContext";

// PUBLIC_INTERFACE
export default function LoginPage() {
  /** Basic authentication page with username/password login and guest mode. */
  const { state, actions } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Feature flag gating: enable by default unless REACT_APP_FEATURE_FLAGS excludes guest-login
  const guestEnabled = useMemo(() => {
    const flags = process.env.REACT_APP_FEATURE_FLAGS || "";
    if (!flags) return true;
    return flags.split(",").map((s) => s.trim()).includes("guest-login");
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await actions.login(username.trim(), password);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <form className="card" onSubmit={onSubmit}>
        <h2>Welcome to SuperDrive</h2>
        <p>Sign in to continue or explore in guest mode.</p>
        <div className="input-row">
          <label>Username</label>
          <input
            className="input"
            placeholder="Enter username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="input-row">
          <label>Password</label>
          <input
            className="input"
            type="password"
            placeholder="Enter password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="helper" style={{ color: "#B91C1C" }}>{error}</div>}
        {state.error && <div className="helper" style={{ color: "#B91C1C" }}>{state.error}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setUsername("");
              setPassword("");
              setError("");
            }}
          >
            Clear
          </button>
          {guestEnabled && (
            <button
              type="button"
              className="btn secondary"
              onClick={() => actions.loginAsGuest()}
              aria-label="Continue as Guest"
              title="Continue as Guest"
            >
              🚀 Continue as Guest
            </button>
          )}
        </div>

        {guestEnabled && (
          <div className="helper" style={{ marginTop: 12 }}>
            Guest mode grants access to all features without an account. Your session is stored locally and can be cleared by logging out.
          </div>
        )}
        <div className="helper" style={{ marginTop: 12 }}>
          Notes:
          <ul>
            <li>In monolith mode, APIs are same-origin under /api. Override base via REACT_APP_API_BASE or REACT_APP_BACKEND_URL if remote.</li>
            <li>Default credentials are admin/admin unless overridden on the server (SUPERDRIVE_USERS or USERS_JSON).</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
