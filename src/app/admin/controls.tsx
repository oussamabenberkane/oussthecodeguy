"use client";

// The only interactive pieces of the dashboard: sign out, and inline visitor
// labels ("Acme recruiter") that persist to the visitors table.

import { useState } from "react";
import { T } from "./ui";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch("/api/admin/login", { method: "DELETE" }).catch(() => {});
        window.location.reload();
      }}
      disabled={busy}
      style={{
        background: "transparent",
        border: `1px solid ${T.surface1}`,
        color: T.subtext0,
        font: "inherit",
        fontSize: 11,
        padding: "3px 10px",
        cursor: "pointer",
      }}
    >
      {busy ? "…" : "logout"}
    </button>
  );
}

export function LabelEditor({
  visitorId,
  initial,
}: {
  visitorId: string;
  initial: string | null;
}) {
  const [label, setLabel] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const next = label.trim();
    if (next === saved || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, label: next }),
      });
      if (res.ok) setSaved(next);
      else setLabel(saved);
    } catch {
      setLabel(saved);
    }
    setBusy(false);
  };

  return (
    <input
      value={label}
      placeholder="label…"
      onChange={(e) => setLabel(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label="Visitor label"
      style={{
        width: 110,
        background: "transparent",
        border: "none",
        borderBottom: `1px dashed ${label.trim() === saved ? T.surface1 : T.green}`,
        color: label ? T.greenLight : T.overlay1,
        font: "inherit",
        fontSize: 11,
        outline: "none",
        padding: "1px 0",
        opacity: busy ? 0.5 : 1,
      }}
    />
  );
}
