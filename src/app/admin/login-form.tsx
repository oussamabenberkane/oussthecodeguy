"use client";

// SSH-style login gate for /admin. Wrong password shakes nothing, animates
// nothing — it just prints an error line, like a terminal would.

import { useState } from "react";

const T = {
  base: "#13140D",
  surface0: "#262719",
  surface1: "#3A3B27",
  text: "#E8E6DB",
  subtext0: "#A4A293",
  overlay1: "#767262",
  green: "#1FBF54",
  amber: "#FFB000",
};

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 204) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Sign-in failed.");
      setBusy(false);
      setPassword("");
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "min(460px, 100%)",
          background: T.base,
          border: `1px solid ${T.surface1}`,
          boxShadow: "6px 6px 0 rgba(31,191,84,0.08)",
        }}
      >
        <div
          style={{
            padding: "8px 14px",
            borderBottom: `1px solid ${T.surface0}`,
            color: T.subtext0,
            fontSize: 12,
          }}
        >
          ssh admin@oussamabenberkane.com
        </div>
        <div style={{ padding: "22px 14px 24px" }}>
          <div style={{ color: T.overlay1, fontSize: 12, marginBottom: 14 }}>
            The authenticity of this host is not in question. It&apos;s yours.
          </div>
          <label
            style={{ display: "flex", alignItems: "baseline", gap: 10 }}
            htmlFor="admin-password"
          >
            <span style={{ color: T.green, whiteSpace: "nowrap" }}>password:</span>
            <input
              id="admin-password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: `1px solid ${T.surface1}`,
                color: T.text,
                font: "inherit",
                outline: "none",
                padding: "2px 0",
                caretColor: T.green,
              }}
            />
          </label>
          {error && (
            <div style={{ color: T.amber, fontSize: 12, marginTop: 14 }}>
              Permission denied: {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            style={{
              marginTop: 22,
              background: password && !busy ? T.green : T.surface0,
              color: password && !busy ? "#08160C" : T.overlay1,
              border: "none",
              font: "inherit",
              fontWeight: 700,
              padding: "8px 18px",
              cursor: password && !busy ? "pointer" : "default",
            }}
          >
            {busy ? "authenticating…" : "connect"}
          </button>
        </div>
      </form>
    </main>
  );
}
