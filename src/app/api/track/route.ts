// Next.js Route Handler — POST /api/track (first-party analytics ingest)
//
// Receives beacons from src/lib/track.ts and writes to Supabase (service-role,
// see src/lib/supabase-admin.ts). Three kinds:
//   start — upsert visitor + session; geo comes free from Vercel's IP headers,
//           and company/ISP enrichment (ipwho.is reverse-IP) runs after the
//           response via next/server's after() so it never adds latency.
//   event — append to the events table, bump the session's last_seen_at.
//   end   — record session duration (sent via sendBeacon on page hide).
//
// Failure policy: analytics must never surface errors to visitors. Malformed
// input gets a 400; everything else (missing env, db down) returns 204 and is
// at most console.error'd. Rate limiting mirrors api/chat/route.ts.

import type { NextRequest } from "next/server";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const RATE_LIMIT = 240; // beacons
const RATE_WINDOW_MS = 5 * 60_000;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_PAYLOAD_CHARS = 2_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_TYPE_RE = /^[a-z0-9_]{1,40}$/;

// ─────────────────────────────────────────────────────────────────────────────
// In-memory per-IP rate limiter (same shape/limits caveats as api/chat)
// ─────────────────────────────────────────────────────────────────────────────

const hits = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const windowStart = now - RATE_WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 2000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request context: IP, Vercel geo headers, user-agent parsing
// ─────────────────────────────────────────────────────────────────────────────

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Vercel geolocates every request and passes the result as headers. */
function geoFromHeaders(req: NextRequest) {
  const h = (name: string) => {
    const v = req.headers.get(name);
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    country: h("x-vercel-ip-country"),
    region: h("x-vercel-ip-country-region"),
    city: h("x-vercel-ip-city"),
  };
}

const BOT_RE =
  /bot|crawl|spider|slurp|headless|lighthouse|pingdom|pagespeed|facebookexternalhit|preview|scrape|python-requests|curl\/|wget\//i;

/** Tiny UA classifier — order matters (Edge before Chrome, Chrome before Safari). */
function parseUa(ua: string) {
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\//i.test(ua)
      ? "Opera"
      : /samsungbrowser/i.test(ua)
        ? "Samsung Internet"
        : /firefox\//i.test(ua)
          ? "Firefox"
          : /chrome|crios/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
              ? "Safari"
              : "Other";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad|ipod/i.test(ua)
        ? "iOS"
        : /mac os/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : "Other";
  const device = /ipad|tablet/i.test(ua)
    ? "tablet"
    : /mobi|iphone|android.+mobile/i.test(ua)
      ? "mobile"
      : "desktop";
  return { browser, os, device, isBot: BOT_RE.test(ua) };
}

function isPublicIp(ip: string): boolean {
  if (!ip || ip === "unknown") return false;
  return !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd])/i.test(ip);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse-IP enrichment (company / ISP) — best-effort, after the response
// ─────────────────────────────────────────────────────────────────────────────

async function enrichSession(sessionId: string, visitorId: string, ip: string) {
  const db = supabaseAdmin();
  if (!db || !isPublicIp(ip)) return;
  try {
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country,city,region,connection`,
      { signal: AbortSignal.timeout(4_000) },
    );
    const data = (await res.json()) as {
      success?: boolean;
      country?: string;
      city?: string;
      region?: string;
      connection?: { org?: string; isp?: string };
    };
    if (!data?.success) return;
    const org = data.connection?.org?.slice(0, 200) || null;
    const isp = data.connection?.isp?.slice(0, 200) || null;
    await db
      .from("sessions")
      .update({
        org,
        isp,
        // Fallback geo for non-Vercel environments where the headers are absent.
        ...(data.country ? { country: data.country } : {}),
        ...(data.city ? { city: data.city } : {}),
        ...(data.region ? { region: data.region } : {}),
      })
      .eq("id", sessionId);
    // Only surface real organizations on the visitor card, not consumer ISPs.
    if (org && org !== isp) {
      await db.from("visitors").update({ company: org }).eq("id", visitorId).is("company", null);
    }
  } catch {
    // enrichment is strictly best-effort
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — ingest
// ─────────────────────────────────────────────────────────────────────────────

interface StartBody {
  kind: "start";
  vid: string;
  sid: string;
  resumed?: boolean;
  referrer?: string;
  refCode?: string;
  utm?: Record<string, string>;
  path?: string;
  mode?: string;
  screen?: string;
}
interface EventBody {
  kind: "event";
  vid: string;
  sid: string;
  type: string;
  payload?: Record<string, unknown>;
}
interface EndBody {
  kind: "end";
  vid: string;
  sid: string;
  duration?: number;
}

const ok = () => new Response(null, { status: 204 });

export async function POST(req: NextRequest) {
  const now = Date.now();

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json({ error: "Body too large." }, { status: 400 });
  }

  const ip = clientIp(req);
  if (rateLimited(ip, now)) return ok(); // silently drop — it's telemetry

  let body: StartBody | EventBody | EndBody;
  try {
    body = (await req.json()) as StartBody | EventBody | EndBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !UUID_RE.test(String(body.vid)) ||
    !UUID_RE.test(String(body.sid))
  ) {
    return Response.json({ error: "Malformed beacon." }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) return ok(); // not configured — no-op, never an error

  const vid = String(body.vid).toLowerCase();
  const sid = String(body.sid).toLowerCase();

  try {
    if (body.kind === "start") {
      const ua = req.headers.get("user-agent") ?? "";
      const { browser, os, device, isBot } = parseUa(ua);
      const geo = geoFromHeaders(req);
      const str = (v: unknown, max: number) =>
        typeof v === "string" && v ? v.slice(0, max) : null;

      const { data: existingVisitor } = await db
        .from("visitors")
        .select("id, visit_count")
        .eq("id", vid)
        .maybeSingle();

      const visitorPatch = {
        last_seen: new Date(now).toISOString(),
        last_ip: ip,
        last_country: geo.country,
        last_city: geo.city,
        last_user_agent: ua.slice(0, 400),
      };
      if (existingVisitor) {
        await db
          .from("visitors")
          .update({
            ...visitorPatch,
            // Reloads re-send "start" with resumed=true — not a new visit.
            visit_count: existingVisitor.visit_count + (body.resumed ? 0 : 1),
          })
          .eq("id", vid);
      } else {
        await db.from("visitors").insert({ id: vid, ...visitorPatch });
      }

      await db.from("sessions").upsert(
        {
          id: sid,
          visitor_id: vid,
          last_seen_at: new Date(now).toISOString(),
          ip,
          country: geo.country,
          city: geo.city,
          region: geo.region,
          user_agent: ua.slice(0, 400),
          browser,
          os,
          device,
          referrer: str(body.referrer, 500),
          ref_code: str(body.refCode, 80),
          utm: body.utm && typeof body.utm === "object" ? body.utm : null,
          landing_path: str(body.path, 200),
          entry_mode: str(body.mode, 20),
          screen: str(body.screen, 20),
          is_bot: isBot,
        },
        { onConflict: "id" },
      );

      if (!isBot) after(() => enrichSession(sid, vid, ip));
      return ok();
    }

    if (body.kind === "event") {
      if (!EVENT_TYPE_RE.test(String(body.type))) {
        return Response.json({ error: "Malformed beacon." }, { status: 400 });
      }
      let payload: Record<string, unknown> | null = null;
      if (body.payload && typeof body.payload === "object") {
        const json = JSON.stringify(body.payload);
        payload = json.length <= MAX_PAYLOAD_CHARS ? body.payload : { truncated: true };
      }
      await db.from("events").insert({
        session_id: sid,
        visitor_id: vid,
        type: body.type,
        payload,
      });
      after(async () => {
        await db
          .from("sessions")
          .update({ last_seen_at: new Date(now).toISOString() })
          .eq("id", sid);
      });
      return ok();
    }

    if (body.kind === "end") {
      const duration = Number(body.duration);
      await db
        .from("sessions")
        .update({
          last_seen_at: new Date(now).toISOString(),
          ...(Number.isFinite(duration) && duration > 0 && duration < 24 * 3_600_000
            ? { duration_ms: Math.round(duration) }
            : {}),
        })
        .eq("id", sid);
      return ok();
    }

    return Response.json({ error: "Unknown beacon kind." }, { status: 400 });
  } catch (err) {
    console.error("[track] ingest failed:", err instanceof Error ? err.message : err);
    return ok();
  }
}
