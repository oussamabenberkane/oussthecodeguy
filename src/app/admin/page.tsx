// /admin — who's been visiting the portfolio.
//
// Server component: cookie gate → fetch raw rows from Supabase → aggregate in
// JS (portfolio traffic is small; no SQL group-bys needed) → render. Data is
// always fresh (force-dynamic). Range and bot-visibility live in the URL
// (?days=7|30|90&bots=1) so the header tabs are plain links.

import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminConfigured, verifyAdminCookie } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import LoginForm from "./login-form";
import { LabelEditor, LogoutButton } from "./controls";
import {
  DailyBars,
  Empty,
  MeterList,
  Panel,
  StatTile,
  T,
  dayKey,
  fmtDuration,
  fmtWhen,
} from "./ui";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Row types (shape of the Supabase selects below)
// ─────────────────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  visitor_id: string;
  started_at: string;
  duration_ms: number | null;
  country: string | null;
  city: string | null;
  org: string | null;
  isp: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  referrer: string | null;
  ref_code: string | null;
  entry_mode: string | null;
  is_bot: boolean;
  visitors: { label: string | null; company: string | null; visit_count: number } | null;
}

interface EventRow {
  session_id: string | null;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface ChatRow {
  id: number;
  question: string;
  reply: string | null;
  status: string | null;
  visitor_id: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation helpers
// ─────────────────────────────────────────────────────────────────────────────

function topN(values: (string | null | undefined)[], n = 8) {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function referrerHost(referrer: string | null): string | null {
  if (!referrer) return "(direct)";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.includes("oussamabenberkane.com")) return null; // self-navigation
    return host;
  } catch {
    return referrer.slice(0, 60);
  }
}

function fullscreenNote(lines: string[]) {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div
        style={{
          background: T.base,
          border: `1px solid ${T.surface1}`,
          padding: "18px 22px",
          maxWidth: 560,
          fontSize: 12,
          color: T.subtext0,
          display: "grid",
          gap: 6,
        }}
      >
        {lines.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data loading (module-level: server components must stay pure — no Date.now()
// in render; force-dynamic means this runs fresh per request anyway)
// ─────────────────────────────────────────────────────────────────────────────

async function loadDashboard(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  days: number,
) {
  const now = Date.now();
  const sinceIso = new Date(now - days * 86_400_000).toISOString();

  const [sessionsQ, eventsQ, chatQ] = await Promise.all([
    db
      .from("sessions")
      .select(
        "id, visitor_id, started_at, duration_ms, country, city, org, isp, browser, os, device, referrer, ref_code, entry_mode, is_bot, visitors(label, company, visit_count)",
      )
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false })
      .limit(2000),
    db
      .from("events")
      .select("session_id, type, payload, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000),
    db
      .from("chat_logs")
      .select("id, question, reply, status, visitor_id, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const dayKeys = Array.from({ length: days }, (_, i) =>
    dayKey(new Date(now - (days - 1 - i) * 86_400_000)),
  );

  return {
    allSessions: (sessionsQ.data ?? []) as unknown as SessionRow[],
    allEvents: (eventsQ.data ?? []) as EventRow[],
    chats: (chatQ.data ?? []) as ChatRow[],
    dayKeys,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!adminConfigured()) {
    return fullscreenNote([
      "admin: not configured.",
      "Set ADMIN_PASSWORD (min 8 chars) in .env.local and on Vercel, then reload.",
    ]);
  }

  const store = await cookies();
  if (!verifyAdminCookie(store.get(ADMIN_COOKIE)?.value)) {
    return <LoginForm />;
  }

  const db = supabaseAdmin();
  if (!db) {
    return fullscreenNote([
      "admin: database not configured.",
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local and on Vercel.",
    ]);
  }

  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const showBots = sp.bots === "1";

  const { allSessions, allEvents, chats, dayKeys } = await loadDashboard(db, days);
  const botIds = new Set(allSessions.filter((s) => s.is_bot).map((s) => s.id));
  const sessions = showBots ? allSessions : allSessions.filter((s) => !s.is_bot);
  const events = allEvents.filter(
    (e) => showBots || !e.session_id || !botIds.has(e.session_id),
  );

  // ── aggregates ──────────────────────────────────────────────────────────
  const uniqueVisitors = new Set(sessions.map((s) => s.visitor_id)).size;
  const durations = sessions.map((s) => s.duration_ms).filter((d): d is number => !!d && d > 0);
  const avgDuration = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(new Date(s.started_at));
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }
  const dayBars = dayKeys.map((k) => ({ key: k, count: byDay.get(k) ?? 0 }));

  const evCount = (type: string) => events.filter((e) => e.type === type).length;
  const eventsBySession = new Map<string, number>();
  for (const e of events) {
    if (e.session_id) eventsBySession.set(e.session_id, (eventsBySession.get(e.session_id) ?? 0) + 1);
  }

  const referrers = topN(sessions.map((s) => referrerHost(s.referrer)));
  const countries = topN(sessions.map((s) => s.country && `${s.country}${s.city ? ` · ${s.city}` : ""}`));
  const campaigns = topN(sessions.map((s) => s.ref_code));
  const companies = topN(sessions.map((s) => (s.org && s.org !== s.isp ? s.org : null)));
  const sections = topN(
    events
      .filter((e) => e.type === "section_view")
      .map((e) => (typeof e.payload?.section === "string" ? e.payload.section : null)),
  );
  const shellCmds = topN(
    events
      .filter((e) => e.type === "shell_command")
      .map((e) => (typeof e.payload?.cmd === "string" ? `$ ${e.payload.cmd}` : null)),
    6,
  );
  const devices = topN(sessions.map((s) => s.device));
  const browsers = topN(sessions.map((s) => s.browser), 5);
  const modes = topN(sessions.map((s) => s.entry_mode && `entered in ${s.entry_mode}`), 2);

  const tabStyle = (active: boolean) => ({
    padding: "3px 10px",
    fontSize: 11,
    border: `1px solid ${active ? T.green : T.surface1}`,
    color: active ? "#08160C" : T.subtext0,
    background: active ? T.green : "transparent",
    fontWeight: active ? 700 : 400,
    textDecoration: "none",
  });

  const th = {
    textAlign: "left" as const,
    padding: "4px 10px 6px 0",
    color: T.overlay1,
    fontWeight: 400,
    fontSize: 11,
    textTransform: "uppercase" as const,
    borderBottom: `1px solid ${T.surface0}`,
    whiteSpace: "nowrap" as const,
  };
  const td = {
    padding: "6px 10px 6px 0",
    borderBottom: `1px solid ${T.mantle}`,
    verticalAlign: "top" as const,
    whiteSpace: "nowrap" as const,
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "18px 18px 60px" }}>
      {/* ── status bar ── */}
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 12px",
          background: T.base,
          border: `1px solid ${T.surface1}`,
          marginBottom: 14,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: T.green }}>admin</span>
          <span style={{ color: T.overlay1 }}>@</span>oussamabenberkane.com
        </h1>
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/admin?days=${d}${showBots ? "&bots=1" : ""}`} style={tabStyle(days === d)}>
              {d}d
            </Link>
          ))}
          <Link
            href={`/admin?days=${days}${showBots ? "" : "&bots=1"}`}
            style={{
              ...tabStyle(false),
              color: showBots ? T.amber : T.overlay1,
              borderColor: showBots ? T.amber : T.surface1,
            }}
            title="Include crawler/bot sessions"
          >
            bots {showBots ? "on" : "off"}
          </Link>
          <LogoutButton />
        </nav>
      </header>

      {/* ── stat tiles ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <StatTile label="visits" value={String(sessions.length)} sub={`last ${days} days`} />
        <StatTile label="visitors" value={String(uniqueVisitors)} sub="unique devices" />
        <StatTile label="avg time" value={fmtDuration(avgDuration)} sub={`${durations.length} timed`} />
        <StatTile label="cv downloads" value={String(evCount("cv_download"))} />
        <StatTile label="chat questions" value={String(chats.filter((c) => c.status !== "error").length)} sub="all time (last 60)" />
        <StatTile label="contact clicks" value={String(evCount("contact_click"))} />
      </div>

      {/* ── panels ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 10,
        }}
      >
        <Panel cmd={`visits --last ${days}d`} span right={`${sessions.length} sessions`}>
          {sessions.length === 0 ? (
            <Empty>no visits recorded yet — the tracker only runs on the deployed site, not localhost</Empty>
          ) : (
            <DailyBars days={dayBars} />
          )}
        </Panel>

        <Panel cmd="referrers --top">
          <MeterList items={referrers} total={sessions.length} />
        </Panel>
        <Panel cmd="geo --top">
          <MeterList items={countries} total={sessions.length} />
        </Panel>
        <Panel cmd="campaigns --ref" right="?ref=… links you hand out">
          {campaigns.length === 0 ? (
            <Empty>
              none yet — share links like oussamabenberkane.com/?ref=acme-application to tag where a
              visit came from
            </Empty>
          ) : (
            <MeterList items={campaigns} total={sessions.length} />
          )}
        </Panel>
        <Panel cmd="companies --rdns" right="reverse-IP, office networks only">
          {companies.length === 0 ? (
            <Empty>no company networks identified in this range</Empty>
          ) : (
            <MeterList items={companies} total={sessions.length} />
          )}
        </Panel>
        <Panel cmd="sections --views">
          <MeterList items={sections} total={events.length} />
        </Panel>
        <Panel cmd="env --device --browser --mode">
          <div style={{ display: "grid", gap: 12 }}>
            <MeterList items={devices} total={sessions.length} />
            <MeterList items={browsers} total={sessions.length} />
            <MeterList items={modes} total={sessions.length} />
            {shellCmds.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: T.overlay1, marginBottom: 6 }}>
                  shell commands typed by visitors
                </div>
                <MeterList items={shellCmds} total={events.length} />
              </div>
            )}
          </div>
        </Panel>

        <Panel cmd="sessions --recent" span right="latest 25">
          {sessions.length === 0 ? (
            <Empty>nothing yet</Empty>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={th}>when</th>
                    <th style={th}>who</th>
                    <th style={th}>from</th>
                    <th style={th}>network</th>
                    <th style={th}>device</th>
                    <th style={th}>source</th>
                    <th style={th}>time</th>
                    <th style={th}>ev</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 25).map((s) => (
                    <tr key={s.id}>
                      <td style={{ ...td, color: T.subtext0 }}>{fmtWhen(s.started_at)}</td>
                      <td style={td}>
                        <LabelEditor visitorId={s.visitor_id} initial={s.visitors?.label ?? null} />
                        {(s.visitors?.visit_count ?? 1) > 1 && (
                          <span style={{ color: T.greenMid, fontSize: 11 }}>
                            {" "}
                            ×{s.visitors?.visit_count}
                          </span>
                        )}
                        {s.is_bot && (
                          <span style={{ color: T.amber, fontSize: 11 }}> [bot]</span>
                        )}
                      </td>
                      <td style={{ ...td, color: T.subtext1 }}>
                        {s.country ?? "—"}
                        {s.city ? ` · ${s.city}` : ""}
                      </td>
                      <td
                        style={{
                          ...td,
                          color: s.org && s.org !== s.isp ? T.greenLight : T.overlay1,
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={s.org ?? s.isp ?? ""}
                      >
                        {s.org ?? s.isp ?? "—"}
                      </td>
                      <td style={{ ...td, color: T.subtext0 }}>
                        {s.device ?? "?"} · {s.browser ?? "?"} · {s.os ?? "?"}
                      </td>
                      <td style={{ ...td, color: s.ref_code ? T.greenLight : T.subtext0 }}>
                        {s.ref_code ?? referrerHost(s.referrer) ?? "(direct)"}
                      </td>
                      <td style={{ ...td, color: T.subtext0 }}>{fmtDuration(s.duration_ms)}</td>
                      <td style={{ ...td, color: T.subtext0, fontVariantNumeric: "tabular-nums" }}>
                        {eventsBySession.get(s.id) ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel cmd="ask-ouss --log" span right="what visitors wanted to know">
          {chats.length === 0 ? (
            <Empty>no questions asked yet</Empty>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {chats.map((c) => (
                <details key={c.id} style={{ borderBottom: `1px solid ${T.mantle}`, padding: "4px 0" }}>
                  <summary style={{ cursor: "pointer", listStyle: "none", fontSize: 12 }}>
                    <span style={{ color: T.overlay1 }}>{fmtWhen(c.created_at)}</span>{" "}
                    <span style={{ color: c.status === "error" ? T.amber : T.text }}>
                      {c.question}
                    </span>
                    {c.status === "error" && (
                      <span style={{ color: T.amber, fontSize: 11 }}> [reply failed]</span>
                    )}
                  </summary>
                  <div
                    style={{
                      color: T.subtext0,
                      fontSize: 12,
                      padding: "6px 0 8px 14px",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {c.reply ?? "(no reply)"}
                  </div>
                </details>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </main>
  );
}
