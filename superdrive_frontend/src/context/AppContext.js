import React, { createContext, useContext, useMemo, useReducer, useEffect } from "react";
import { AuthAPI, FilesAPI } from "../api/client";

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
    try {
      if (u?.username) localStorage.setItem("sd_last_user", u.username);
      else localStorage.removeItem("sd_last_user");
    } catch {
      // ignore storage issues
    }
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
          const me = await AuthAPI.me().catch(() => null);
          if (me) setUser(me);
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
          setError(e.message || "Login failed");
          throw e;
        } finally {
          setLoading(false);
        }
      },
      async logout() {
        setLoading(true);
        try {
          await AuthAPI.logout();
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
          const data = await FilesAPI.list(target);
          // Expecting { entries: [...], tree: [...] }
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
    [state.currentPath]
  );

  useEffect(() => {
    actions.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // init on mount

  return <AppContext.Provider value={{ state, actions }}>{children}</AppContext.Provider>;
}
