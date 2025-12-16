//
// Auth Adapter Interface and Offline Implementations
//

// PUBLIC_INTERFACE
export class AuthAdapter {
  /** Abstract auth adapter. */
  // PUBLIC_INTERFACE
  async init() {
    /** Initialize adapter; can restore session. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async login(username, password) {
    /** Login using username/password. Returns user object. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async logout() {
    /** Logout current session. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async currentUser() {
    /** Return currently logged in user or null. */
    throw new Error("Not implemented");
  }
  // PUBLIC_INTERFACE
  async loginAsGuest() {
    /** Create a guest session. */
    throw new Error("Not implemented");
  }
}

// PUBLIC_INTERFACE
export class OfflineAuthAdapter extends AuthAdapter {
  /** Offline auth using localStorage session and optional static users from REACT_APP_SUPERDRIVE_USERS. */
  constructor() {
    super();
    this.key = "sd_auth_user";
    this.usersKey = "REACT_APP_SUPERDRIVE_USERS";
  }

  _readUsers() {
    // Expect env-injected variable at build time or runtime
    const raw = process.env[this.usersKey] || "";
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore parse error
    }
    return [];
  }

  _saveSession(user) {
    try {
      if (user) localStorage.setItem(this.key, JSON.stringify(user));
      else localStorage.removeItem(this.key);
    } catch {}
  }
  _loadSession() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const u = JSON.parse(raw);
      if (u && typeof u === "object") return u;
    } catch {}
    return null;
  }

  async init() {
    return this._loadSession();
  }

  async login(username, password) {
    const users = this._readUsers();
    if (!users.length) {
      // No configured users -> treat as guest-only environment; still allow "login" to create local user
      const u = { username, isGuest: false };
      this._saveSession(u);
      return u;
    }
    const u = users.find((x) => x.username === username && x.password === password);
    if (!u) {
      const err = new Error("Invalid credentials");
      err.status = 401;
      throw err;
    }
    const user = { username: u.username, isGuest: false };
    this._saveSession(user);
    return user;
  }

  async logout() {
    this._saveSession(null);
    return true;
  }

  async currentUser() {
    return this._loadSession();
  }

  async loginAsGuest() {
    const guest = { username: "guest", isGuest: true };
    this._saveSession(guest);
    return guest;
  }
}

