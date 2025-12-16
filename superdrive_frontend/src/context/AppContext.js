import React, { createContext, useContext, useMemo, useReducer, useEffect } from "react";
import { AuthAPI, FilesAPI } from "../api/client";

// Feature flag helper
function isGuestEnabled() {
  const flags = process.env.REACT_APP_FEATURE_FLAGS || "";
  if (!flags) return true; // enable by default when not present
  return flags.split(",").map((s) => s.trim()).includes("guest-login");
}

// App state and actions
const initialState = {
  user: null,
  currentPath: "/",
  tree: [],
  entries: [],
  selected: new Set(),
  loading: false,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload, error: action.payload ? null : state.error };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_PATH":
      return { ...state, currentPath: action.payload };
    case "SET_ENTRIES":
      return { ...state, entries: action.payload };
    case "SET_TREE":
      return { ...state, tree: action.payload };
    case "SELECT":
      return { ...state, selected: new Set(action.payload) };
    default:
      return state;
  }
}

const AppContext = createContext(null);

// PUBLIC_INTERFACE
export function useApp() {
  /** Access global app state and actions. */
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

function persistAuth(user) {
  try {
    if (user) {
      localStorage.setItem("sd_auth_user", JSON.stringify(user));
      localStorage.setItem("sd_last_user", user.username || user.name || "");
    } else {
      localStorage.removeItem("sd_auth_user");
      localStorage.removeItem("sd_last_user");
    }
  } catch {
    // ignore storage unavailability
  }
}

function restoreAuth() {
  try {
    const raw = localStorage.getItem("sd_auth_user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || typeof u !== "object") return null;
    return u;
  } catch {
    return null;
  }
}

// PUBLIC_INTERFACE
export function AppProvider({ children, bus }) {
  /** Provider that manages global app state, auth, and file listing. */
  const [state, dispatch] = useReducer(reducer, initialState);

  const setLoading = (v) => dispatch({ type: "SET_LOADING", payload: v });
  const setError = (e) => {
    dispatch({ type: "SET_ERROR", payload: e });
    if (bus && e) {
      bus.dispatchEvent(new CustomEvent("toast", { detail: { type: "error", message: e } }));
    }
  };
  const setUser = (u) => {
    dispatch({ type: "SET_USER", payload: u });
    persistAuth(u);
  };
  const setPath = (p) => dispatch({ type: "SET_PATH", payload: p });
  const setEntries = (list) => dispatch({ type: "SET_ENTRIES", payload: list });
  const setTree = (tree) => dispatch({ type: "SET_TREE", payload: tree });
  const setSelected = (ids) => dispatch({ type: "SELECT", payload: ids });

  const notify = (message, type = "success") => {
    if (bus && message) {
      bus.dispatchEvent(new CustomEvent("toast", { detail: { type, message } }));
    }
  };

  const actions = useMemo(
    () => ({
      async init() {
        setLoading(true);
        try {
          // Attempt restore from localStorage (guest or normal)
          const restored = restoreAuth();
          if (restored?.isGuest) {
            setUser(restored);
          } else {
            const me = await AuthAPI.me().catch(() => null);
            if (me) setUser(me);
          }
          await actions.refresh();
        } catch {
          // ignore initial errors; user may need to login
        } finally {
          setLoading(false);
        }
      },
      async login(username, password) {
        setLoading(true);
        try {
          await AuthAPI.login({ username, password });
          const me = await AuthAPI.me().catch(() => ({ username }));
          setUser(me);
          notify("Signed in");
          await actions.refresh("/");
        } catch (e) {
          const message = e?.message || "Login failed";
          setError(message);
          throw e;
        } finally {
          setLoading(false);
        }
      },
      // PUBLIC_INTERFACE
      async loginAsGuest() {
        /** Log in as a guest user and persist the session locally. */
        if (!isGuestEnabled()) {
          setError("Guest login is disabled.");
          return;
        }
        // Create a client-side session object; role guest, but full capabilities in UI.
        const guest = { username: "guest", role: "guest", isGuest: true };
        setUser(guest);
        notify("Continuing as Guest");
        await actions.refresh("/");
      },
      async logout() {
        setLoading(true);
        try {
          if (state.user?.isGuest) {
            // Client-side only logout for guest
            notify("Signed out", "success");
          } else {
            await AuthAPI.logout();
            notify("Signed out", "success");
          }
        } finally {
          setUser(null);
          setLoading(false);
        }
      },
      async refresh(path) {
        if (path) setPath(path);
        const target = path || state.currentPath || "/";
        setLoading(true);
        try {
          const data = await FilesAPI.list(target);
          setEntries(data.entries || []);
          setTree(data.tree || []);
        } catch (e) {
          setError(e.message || "Failed to load");
        } finally {
          setLoading(false);
        }
      },
      async createFolder(name) {
        setLoading(true);
        try {
          await FilesAPI.createDir(state.currentPath, name);
          notify(`Folder "${name}" created`);
          await actions.refresh();
        } catch (e) {
          setError(e.message || "Failed to create folder");
        } finally {
          setLoading(false);
        }
      },
      async upload(files) {
        setLoading(true);
        try {
          await FilesAPI.upload(state.currentPath, files);
          notify(`Uploaded ${files.length} file(s)`);
          await actions.refresh();
        } catch (e) {
          setError(e.message || "Upload failed");
        } finally {
          setLoading(false);
        }
      },
      async download(path) {
        try {
          const res = await FilesAPI.download(path);
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          const name = path.split("/").pop();
          a.href = url;
          a.download = name || "download";
          a.click();
          window.URL.revokeObjectURL(url);
          notify(`Downloading ${name || "file"}`);
        } catch (e) {
          setError(e.message || "Download failed");
        }
      },
      async remove(path) {
        setLoading(true);
        try {
          await FilesAPI.remove(path);
          notify("Deleted");
          await actions.refresh();
        } catch (e) {
          setError(e.message || "Delete failed");
        } finally {
          setLoading(false);
        }
      },
      async rename(path, newName) {
        setLoading(true);
        try {
          await FilesAPI.rename(path, newName);
          notify("Renamed");
          await actions.refresh();
        } catch (e) {
          setError(e.message || "Rename failed");
        } finally {
          setLoading(false);
        }
      },
      async move(from, to) {
        setLoading(true);
        try {
          await FilesAPI.move(from, to);
          notify("Moved");
          await actions.refresh();
        } catch (e) {
          setError(e.message || "Move failed");
        } finally {
          setLoading(false);
        }
      },
      setSelected,
      setPath,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.currentPath, state.user]
  );

  useEffect(() => {
    actions.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init on mount

  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}
