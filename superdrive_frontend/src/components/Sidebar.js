import React, { useState } from "react";
import { useApp } from "../context/AppContext";

function TreeNode({ node, onOpen }) {
  const [open, setOpen] = useState(true);
  const isDir = node?.type === "dir";
  // Always coerce children to an array to avoid calling .map on undefined/null
  const children = Array.isArray(node?.children) ? node.children : [];
  return (
    <li>
      <div
        role="button"
        className="node"
        onClick={() => {
          if (isDir) {
            setOpen((v) => !v);
            if (node?.path) onOpen(node.path);
          }
        }}
        title={node?.path || "/"}
      >
        <span>{isDir ? (open ? "📂" : "📁") : "📄"}</span>
        <span>{node?.name ?? "/"}</span>
      </div>
      {isDir && open && children.length > 0 && (
        <ul className="children">
          {children.map((child) => (
            <TreeNode key={child.path} node={child} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </li>
  );
}

// PUBLIC_INTERFACE
export default function Sidebar() {
  /** Sidebar showing directory tree for quick navigation. */
  const { state, actions } = useApp();

  return (
    <aside className="sidebar">
      <div className="section-title">Navigation</div>
      <ul className="tree">
        {(state.tree?.length ? state.tree : [{ name: "/", path: "/", type: "dir", children: [] }]).map((n) => (
          <TreeNode key={n.path} node={n} onOpen={(p) => actions.refresh(p)} />
        ))}
      </ul>
    </aside>
  );
}
