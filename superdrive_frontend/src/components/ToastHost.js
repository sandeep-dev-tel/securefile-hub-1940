import React, { useEffect, useState } from "react";

// PUBLIC_INTERFACE
export default function ToastHost({ bus }) {
  /**
   * Simple toast host that listens to events on a provided bus (EventTarget-like).
   * Usage: bus.dispatchEvent(new CustomEvent('toast', { detail: { type:'success', message:'Saved' } }))
   */
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!bus) return;
    const onToast = (e) => {
      const item = { id: Math.random().toString(36).slice(2), ...e.detail };
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
      }, 3000);
    };
    bus.addEventListener("toast", onToast);
    return () => bus.removeEventListener("toast", onToast);
  }, [bus]);

  return (
    <div style={{
      position: "fixed",
      right: 16,
      bottom: 16,
      display: "grid",
      gap: 8,
      zIndex: 60
    }}
    aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="badge"
          style={{
            padding: "8px 12px",
            background: t.type === "error" ? "#FEE2E2" : "#ECFDF5",
            color: t.type === "error" ? "#991B1B" : "#065F46",
            border: `1px solid ${t.type === "error" ? "#FECACA" : "#A7F3D0"}`
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
