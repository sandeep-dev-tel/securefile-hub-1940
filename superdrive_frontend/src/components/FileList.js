import React, { useRef, useState } from "react";
import { useApp } from "../context/AppContext";

function bytes(n) {
  if (n == null) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

// PUBLIC_INTERFACE
export default function FileList() {
  /**
   * Main content panel listing files/dirs with actions.
   * Supports drag-and-drop upload and selection.
   */
  const { state, actions } = useApp();
  const inputRef = useRef(null);
  const [renaming, setRenaming] = useState(null);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) actions.upload(files);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const openCreateFolder = () => {
    const name = prompt("New folder name");
    if (name) actions.createFolder(name);
  };

  const onUpload = (e) => {
    // Read FileList synchronously and immediately clear the input
    const list = e?.target?.files || [];
    const files = Array.from(list || []);
    // Clear the input before any async operations to avoid stale references
    if (e?.target) e.target.value = "";
    if (files.length > 0) {
      actions.upload(files);
    } else {
      // no-op; AppContext.upload also guards, but we avoid calling it for clarity
    }
  };

  const onDownload = (entry) => {
    const target = state.currentPath.replace(/\/+$/, "") + "/" + entry.name;
    actions.download(target);
  };

  const onDelete = (entry) => {
    const target = state.currentPath.replace(/\/+$/, "") + "/" + entry.name;
    if (window.confirm(`Delete ${entry.name}?`)) actions.remove(target);
  };

  const onRename = (entry) => {
    setRenaming(entry.name);
  };

  const commitRename = (entry, newName) => {
    setRenaming(null);
    if (!newName || newName === entry.name) return;
    const path = state.currentPath.replace(/\/+$/, "") + "/" + entry.name;
    actions.rename(path, newName);
  };

  const openDir = (entry) => {
    const next = (state.currentPath === "/" ? "" : state.currentPath) + "/" + entry.name;
    actions.refresh(next.replace(/\/+/g, "/"));
  };

  const toggleSelect = (name) => {
    const base = state && state.selected instanceof Set ? state.selected : new Set();
    const next = new Set(base);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    actions.setSelected(next);
  };

  // Defensive copy and sort here as well in case callers mutate state elsewhere
  const entries = Array.isArray(state.entries) ? state.entries.slice() : [];
  entries.sort((a, b) => {
    if ((a?.type) !== (b?.type)) return a?.type === "dir" ? -1 : 1;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });

  return (
    <div className="panel" onDrop={onDrop} onDragOver={onDragOver}>
      <div className="toolbar">
        <button className="btn primary" onClick={openCreateFolder}>+ New Folder</button>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={onUpload}
        />
        <button className="btn secondary" onClick={() => inputRef.current?.click()}>
          ⬆ Upload
        </button>
        <button
          className="btn"
          onClick={() => actions.refresh()}
          aria-label="Refresh list"
        >
          Refresh
        </button>
      </div>

      <table className="table" role="grid" aria-label="Files and folders">
        <thead>
          <tr>
            <th style={{ width: 36 }}></th>
            <th>Name</th>
            <th style={{ width: 120 }}>Type</th>
            <th style={{ width: 140 }}>Size</th>
            <th style={{ width: 180 }}>Modified</th>
            <th style={{ width: 260 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const isSelected = state.selected?.has(e.name);
            return (
              <tr
                key={e.name}
                className="row"
                aria-selected={isSelected}
                onDoubleClick={() => (e.type === "dir" ? openDir(e) : onDownload(e))}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    onChange={() => toggleSelect(e.name)}
                    aria-label={`Select ${e.name}`}
                  />
                </td>
                <td>
                  {renaming === e.name ? (
                    <input
                      autoFocus
                      className="input"
                      defaultValue={e.name}
                      onBlur={(ev) => commitRename(e, ev.target.value.trim())}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") commitRename(e, ev.currentTarget.value.trim());
                        if (ev.key === "Escape") setRenaming(null);
                      }}
                    />
                  ) : (
                    <span>{e.type === "dir" ? "📁 " : "📄 "}{e.name}</span>
                  )}
                </td>
                <td>{e.type}</td>
                <td>{e.type === "dir" ? "-" : bytes(e.size)}</td>
                <td>{e.modified ? new Date(e.modified).toLocaleString() : "-"}</td>
                <td>
                  {e.type === "dir" ? (
                    <button className="btn" onClick={() => openDir(e)}>Open</button>
                  ) : (
                    <button className="btn" onClick={() => onDownload(e)}>Download</button>
                  )}
                  <button className="btn" onClick={() => onRename(e)}>Rename</button>
                  <button className="btn" onClick={() => onDelete(e)} style={{ color: "#B91C1C" }}>
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {!entries.length && !state.loading && (
            <tr>
              <td colSpan={6} style={{ padding: 24 }}>
                <div className="helper" style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 600, color: "#111827", marginBottom: 6 }}>
                    This folder is empty.
                  </div>
                  <div style={{ marginTop: 12 }}>
                    Drag and drop files here to upload, or use the Upload button. Files are stored locally in your browser (IndexedDB).
                  </div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {state.loading && (
        <div className="helper" style={{ padding: 12 }}>
          Loading...
        </div>
      )}
      {state.error && (
        <div className="helper" style={{ padding: 12, color: "#B91C1C" }}>
          {state.error}
        </div>
      )}
    </div>
  );
}
