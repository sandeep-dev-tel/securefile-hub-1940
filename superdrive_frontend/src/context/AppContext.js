import React, { createContext, useContext, useMemo, useReducer, useEffect } from "react";
import { OfflineAuthAdapter } from "../adapters/auth";
import { OfflineFilesAdapter } from "../adapters/files";

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
      return { ...state, entries: Array.isArray(action.payload) ? action.payload : [] };
    case "SET_TREE":
      return { ...state, tree: Array.isArray(action.payload) ? action.payload : [] };
    case "SELECT":
      return { ...state, selected: new Set(action.payload || []) };
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

// PUBLIC_INTERFACE
export function AppProvider({ children, bus }) {
  /** Provider that manages global app state, auth, and file listing using offline adapters. */
  const [state, dispatch] = useReducer(reducer, initialState);

  const auth = useMemo(() => new OfflineAuthAdapter(), []);
  const files = useMemo(() => new OfflineFilesAdapter(), []);

  const setLoading = (v) => dispatch({ type: "SET_LOADING", payload: v });
  const setError = (e) => {
    dispatch({ type: "SET_ERROR", payload: e });
    if (bus && e) {
      bus.dispatchEvent(new CustomEvent("toast", { detail: { type: "error", message: e } }));
    }
  };
  const setUser = (u) => {
    dispatch({ type: "SET_USER", payload: u });
    try {
      if (u) localStorage.setItem("sd_auth_user", JSON.stringify(u));
      else localStorage.removeItem("sd_auth_user");
    } catch {}
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
          await files.init();
          const restored = await auth.init();
          if (restored) setUser(restored);
          else {
            // Default to guest mode automatically
            const guest = await auth.loginAsGuest();
            setUser(guest);
          }
          await actions.refresh("/");
        } catch (e) {
          setError(e?.message || "Initialization failed");
        } finally {
          setLoading(false);
        }
      },
      async login(username, password) {
        setLoading(true);
        try {
          const u = await auth.login(username, password);
          setUser(u);
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
        const guest = await auth.loginAsGuest();
        setUser(guest);
        notify("Continuing as Guest");
        await actions.refresh("/");
      },
      async logout() {
        setLoading(true);
        try {
          await auth.logout();
          notify("Signed out", "success");
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
          const data = await files.list(target);
          setEntries(data.entries || []);
          setTree(data.tree || []);
        } catch (e) {
          setError(e.message || "Failed to load");
        } finally {
          setLoading(false);
        }
      },
      async createFolder(name) {
        const trimmed = String(name || "").trim();
        if (!trimmed) {
          setError("Invalid folder name");
          return;
        }
        setLoading(true);
        try {
          const res = await files.createFolder(state.currentPath, trimmed);
          if (res && res.created) {
            notify(`Folder "${trimmed}" created`);
          }
          // Always refresh current path to repopulate entries and tree
          await actions.refresh(state.currentPath);
        } catch (e) {
          // Avoid success toast on duplicate; surface error message
          setError(e.message || "Failed to create folder");
        } finally {
          setLoading(false);
        }
      },
      async upload(fileList) {
        setLoading(true);
        try {
          await files.upload(state.currentPath, fileList);
          notify(`Uploaded ${fileList.length} file(s)`);
          await actions.refresh();
        } catch (e) {
          setError(e.message || "Upload failed");
        } finally {
          setLoading(false);
        }
      },
      async download(path) {
        try {
          const blob = await files.download(path);
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
          await files.remove(path);
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
          await files.rename(path, newName);
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
          await files.move(from, to);
          notify("Moved");
          await actions.refresh();
        } catch (e) {
          setError(e.message || "Move failed");
        } finally {
          setLoading(false);
        }
      },
      async clearLocalData() {
        // Clears all local IndexedDB + localStorage app keys and reloads state
        try {
          const { resetDB } = await import("../adapters/indexeddb");
          await resetDB();
          localStorage.removeItem("sd_auth_user");
          localStorage.removeItem("sd_last_user");
          notify("Local data cleared");
        } catch (e) {
          setError(e.message || "Failed to clear data");
        } finally {
          // force reinit
          await actions.init();
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
    // After initialization completes, attempt to create a '/test' folder once.
    // This uses the existing adapter logic and refresh to ensure visibility in listing and sidebar.
    (async () => {
      try {
        // Wait a tick for init state updates
        await new Promise((r) => setTimeout(r, 0));
        // Only run if we're at root to match requested behavior
        // Attempt to create, ignore if it already exists
        if ((state.currentPath || "/") === "/") {
          await actions.createFolder("test");
          // Ensure current path is refreshed so UI updates immediately
          await actions.refresh("/");
        }
      } catch {
        // ignore any error to avoid breaking startup
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init on mount

  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}
