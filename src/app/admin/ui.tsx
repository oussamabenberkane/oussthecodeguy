// Presentational pieces for the admin dashboard — server-renderable, no state.
// Visual language: the terminal mode's dark sibling. Panels are "windows",
// every section header is a shell command, green is the single data hue
// (#1FBF54, hover #62DA8B), amber is reserved for alerts (bots, errors).

import type { ReactNode } from "react";

export const T = {
  crust: "#090A06",
  base: "#13140D",
  mantle: "#0D0E07",
  surface0: "#262719",
  surface1: "#3A3B27",
  text: "#E8E6DB",
  subtext1: "#CDCBBE",
  subtext0: "#A4A293",
  overlay1: "#767262",
  overlay0: "#585546",
  green: "#1FBF54",
  greenMid: "#41CB6D",
  greenLight: "#62DA8B",
  amber: "#FFB000",
};

// ── formatting helpers ───────────────────────────────────────────────────────

export function fmtDuration(ms: number | null): string {
  if (!ms || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 ? ` ${s % 60}s` : ""}`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const TZ = process.env.ADMIN_TZ || "Africa/Algiers";

export function fmtWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

/** Stable YYYY-MM-DD key in the admin timezone, for day-bucketing. */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ── structural pieces ────────────────────────────────────────────────────────

/** A "window": titlebar shows the section as a shell command. */
export function Panel({
  cmd,
  right,
  children,
  span,
}: {
  cmd: string;
  right?: ReactNode;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <section
      style={{
        background: T.base,
        border: `1px solid ${T.surface0}`,
        gridColumn: span ? "1 / -1" : undefined,
        minWidth: 0,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          padding: "7px 12px",
          borderBottom: `1px solid ${T.surface0}`,
          background: T.mantle,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            color: T.subtext1,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: T.green }}>$</span> {cmd}
        </h2>
        {right && <div style={{ fontSize: 11, color: T.overlay1 }}>{right}</div>}
      </header>
      <div style={{ padding: 12 }}>{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: T.base,
        border: `1px solid ${T.surface0}`,
        padding: "12px 14px",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, color: T.overlay1, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: T.subtext0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

/** Empty-state line, terminal-voiced but actionable. */
export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ color: T.overlay1, fontSize: 12, padding: "6px 0" }}>{children}</div>;
}

// ── charts ───────────────────────────────────────────────────────────────────

/**
 * Daily visits — thin green bars with 2px gaps over one hairline baseline.
 * The SVG is stretched (preserveAspectRatio="none"), so NO text lives inside
 * it — the peak's direct label and the date axis are HTML overlaid/below.
 * Every bar still carries a native <title> tooltip.
 */
export function DailyBars({ days }: { days: { key: string; count: number }[] }) {
  const n = days.length;
  const max = Math.max(1, ...days.map((d) => d.count));
  const peakIdx = days.findIndex((d) => d.count === max);
  const bw = 100 / n;
  const hasData = days.some((d) => d.count > 0);

  return (
    <div>
      {/* peak label strip — sits at the tip of the tallest column */}
      <div style={{ position: "relative", height: 16 }}>
        {hasData && (
          <span
            style={{
              position: "absolute",
              left: `${((peakIdx + 0.5) / n) * 100}%`,
              transform: "translateX(-50%)",
              fontSize: 11,
              color: T.subtext1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {max}
          </span>
        )}
      </div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 110, display: "block" }}
        role="img"
        aria-label={`Daily visits, peak ${max}`}
      >
        <line x1="0" y1="99.5" x2="100" y2="99.5" stroke={T.surface0} strokeWidth="1" />
        {days.map((d, i) => {
          if (d.count === 0) return null;
          const h = Math.max(3, (d.count / max) * 98);
          return (
            <rect
              key={d.key}
              x={i * bw + 0.35}
              y={99 - h}
              width={bw - 0.7}
              height={h}
              fill={T.green}
            >
              <title>{`${d.key} — ${d.count} visit${d.count === 1 ? "" : "s"}`}</title>
            </rect>
          );
        })}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: T.overlay1,
          paddingTop: 5,
        }}
      >
        <span>{days[0]?.key.slice(5)}</span>
        <span>{days[Math.floor(n / 2)]?.key.slice(5)}</span>
        <span>{days[n - 1]?.key.slice(5)}</span>
      </div>
    </div>
  );
}

/** Top-N list rendered as htop-style meters: label · track · count. */
export function MeterList({
  items,
  total,
}: {
  items: { label: string; count: number }[];
  total: number;
}) {
  if (items.length === 0) return <Empty>no data in this range yet</Empty>;
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
      {items.map((it) => (
        <li
          key={it.label}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 42%) 1fr auto",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
          }}
          title={`${it.label} — ${it.count} (${Math.round((it.count / Math.max(1, total)) * 100)}%)`}
        >
          <span
            style={{
              color: T.subtext1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {it.label}
          </span>
          <span style={{ background: T.mantle, height: 8, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                inset: "0 auto 0 0",
                width: `${(it.count / max) * 100}%`,
                background: T.green,
              }}
            />
          </span>
          <span style={{ color: T.subtext0, fontVariantNumeric: "tabular-nums" }}>
            {it.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
