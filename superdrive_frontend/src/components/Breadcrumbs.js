import React from "react";
import { useApp } from "../context/AppContext";

// PUBLIC_INTERFACE
export default function Breadcrumbs() {
  /** Breadcrumb navigation derived from currentPath. */
  const { state, actions } = useApp();
  const path = state.currentPath || "/";
  const parts = path.split("/").filter(Boolean);

  const crumbs = [{ name: "root", path: "/" }];
  let acc = "";
  for (const p of parts) {
    acc += `/${p}`;
    crumbs.push({ name: p, path: acc });
  }

  return (
    <div className="breadcrumbs">
      {crumbs.map((c, idx) => (
        <React.Fragment key={c.path || idx}>
          <span
            className="crumb"
            onClick={() => actions.refresh(c.path)}
            role="button"
          >
            {c.name}
          </span>
          {idx < crumbs.length - 1 && <span className="sep">/</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
