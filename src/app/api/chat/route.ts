// Next.js Route Handler — POST /api/chat ("Ask Ouss" chatbot)
//
// One-shot, grounded Q&A about Oussama Benberkane. Mirrors the sibling
// `orkestra` route's shape (Node runtime, body-size cap, GET smoke-check) but is
// deliberately simpler: a single `generateText` call, NO streaming, NO tools, NO
// sql.js/CSV. The full reply comes back as JSON; the client fakes streaming.
//
// Contract (see ASK-OUSS-00-SHARED-SPEC §3):
//   POST { messages: { role: "user"|"assistant", content: string }[] }
//        → 200 { reply: string (markdown) }
//        → 400 malformed body / empty messages / user message > 500 chars
//        → 405 non-POST/GET method
//        → 429 IP rate limit exceeded (+ Retry-After header)
//        → 503 MISTRAL_API_KEY missing/placeholder
//        → 500 model call failed / timed out
//
// The Mistral API key is read server-side by `@ai-sdk/mistral` and never reaches
// the client or the logs.

import type { NextRequest } from "next/server";
import { after } from "next/server";
import { mistral } from "@ai-sdk/mistral";
import { generateText } from "ai";
import { buildSystemPrompt } from "@/lib/chat-context";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail constants
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT = 12; // requests
const RATE_WINDOW_MS = 15 * 60_000; // 15 min
const MAX_INPUT_CHARS = 500;
const MAX_HISTORY = 8;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_OUTPUT_TOK = 600;
const TIMEOUT_MS = 30_000;
const TEMPERATURE = 0.3;

// Graceful reply when the model returns nothing, so the UI never shows an empty
// bubble.
const EMPTY_FALLBACK =
  "Sorry — I didn't catch that. Could you rephrase your question about Ouss?";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory per-IP rate limiter (best-effort)
// ─────────────────────────────────────────────────────────────────────────────
//
// A module-scope Map of recent request timestamps per IP, pruned to the sliding
// window on each call. This is intentionally simple and has known limits:
//   • It lives in process memory, so it RESETS on serverless cold starts and is
//     NOT shared across instances — a determined caller hitting multiple
//     instances can exceed the nominal limit.
// Both are acceptable for a personal portfolio. Swap for Upstash/Redis if this
// ever needs to be authoritative.

const hits = new Map<string, number[]>();

/**
 * Record a hit for `ip` at `now` and report whether the IP is over the limit.
 * Returns `retryAfterMs` (time until the window frees) when limited.
 */
function rateLimit(
  ip: string,
  now: number,
): { limited: boolean; retryAfterMs: number } {
  const windowStart = now - RATE_WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  if (recent.length >= RATE_LIMIT) {
    // Oldest in-window hit dictates when a slot frees up.
    const retryAfterMs = recent[0] + RATE_WINDOW_MS - now;
    hits.set(ip, recent); // persist the pruned list
    return { limited: true, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  recent.push(now);
  hits.set(ip, recent);

  // Opportunistically prune IPs whose entire history has aged out, so the Map
  // doesn't grow unbounded across many distinct callers.
  if (hits.size > 1000) {
    for (const [k, v] of hits) {
      if (v.every((t) => t <= windowStart)) hits.delete(k);
    }
  }

  return { limited: false, retryAfterMs: 0 };
}

/** First hop from x-forwarded-for, then x-real-ip, else "unknown". */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function hasApiKey(): boolean {
  const key = process.env.MISTRAL_API_KEY;
  return Boolean(
    key && key !== "your-mistral-api-key-here" && key !== "...",
  );
}

function modelId(): string {
  return process.env.CHAT_MODEL || "mistral-small-latest";
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics: log Q&A to Supabase (fire-and-forget, never blocks the reply)
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trackId(v: unknown): string | null {
  return typeof v === "string" && UUID_RE.test(v) ? v.toLowerCase() : null;
}

async function logChat(
  question: string,
  reply: string | null,
  status: "ok" | "error",
  visitorId: string | null,
  sessionId: string | null,
) {
  const db = supabaseAdmin();
  if (!db) return;
  try {
    await db.from("chat_logs").insert({
      session_id: sessionId,
      visitor_id: visitorId,
      question: question.slice(0, MAX_INPUT_CHARS),
      reply,
      status,
    });
  } catch (err) {
    console.error("[chat] log failed:", err instanceof Error ? err.message : err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — smoke check (no LLM call, never leaks the key)
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  return Response.json({
    ok: true,
    model: modelId(),
    has_api_key: hasApiKey(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — the chat endpoint
// ─────────────────────────────────────────────────────────────────────────────

type ChatRole = "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  content: string;
}

export async function POST(req: NextRequest) {
  // A single shared "now" for all time math this request.
  const now = Date.now();

  // 1. API-key guard — return 503 so the app still builds/runs without a key.
  if (!hasApiKey()) {
    return Response.json(
      { error: "Chatbot is not configured yet." },
      { status: 503 },
    );
  }

  // 2. Body-size cap. Only the Content-Length header is checked — a chunked
  //    request without that header bypasses this, which is acceptable here.
  const contentLength = req.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json(
      { error: "Request body is too large." },
      { status: 400 },
    );
  }

  // 3. Rate limit (per IP, sliding window).
  const ip = clientIp(req);
  const { limited, retryAfterMs } = rateLimit(ip, now);
  if (limited) {
    return Response.json(
      { error: "Too many messages — please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      },
    );
  }

  // 4. Parse + validate body.
  let body: { messages?: unknown; vid?: unknown; sid?: unknown };
  try {
    body = (await req.json()) as { messages?: unknown; vid?: unknown; sid?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Optional analytics ids sent by the client tracker (see src/lib/track.ts).
  const visitorId = trackId(body.vid);
  const sessionId = trackId(body.sid);

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json(
      { error: "Body must include a non-empty `messages` array." },
      { status: 400 },
    );
  }

  const messages: ChatMessage[] = [];
  for (const raw of body.messages) {
    if (!raw || typeof raw !== "object") continue;
    const { role, content } = raw as { role?: unknown; content?: unknown };

    // Coerce roles to user/assistant only; drop anything else (e.g. system).
    const coercedRole: ChatRole | null =
      role === "assistant" ? "assistant" : role === "user" ? "user" : null;
    if (!coercedRole) continue;

    if (typeof content !== "string" || content.trim().length === 0) {
      return Response.json(
        { error: "Each message must have non-empty string content." },
        { status: 400 },
      );
    }

    if (coercedRole === "user" && content.length > MAX_INPUT_CHARS) {
      return Response.json(
        { error: "Message is too long (max 500 characters)." },
        { status: 400 },
      );
    }

    messages.push({ role: coercedRole, content });
  }

  if (messages.length === 0) {
    return Response.json(
      { error: "Body must include a non-empty `messages` array." },
      { status: 400 },
    );
  }

  // 5. Trim history to the last N messages.
  const trimmed = messages.slice(-MAX_HISTORY);

  // 6. Generate (one-shot). 7/8. Respond / handle errors.
  try {
    const { text } = await generateText({
      model: mistral(modelId()),
      system: buildSystemPrompt(new Date().toISOString().slice(0, 10)),
      messages: trimmed,
      temperature: TEMPERATURE,
      maxTokens: MAX_OUTPUT_TOK, // ai v4 param name (v5 renamed it maxOutputTokens)
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const reply = text.trim() || EMPTY_FALLBACK;
    const lastQuestion = [...trimmed].reverse().find((m) => m.role === "user")?.content ?? "";
    after(() => logChat(lastQuestion, reply, "ok", visitorId, sessionId));
    return Response.json({ reply });
  } catch (err) {
    // Log the real error server-side only — never leak provider errors out.
    console.error(
      "[chat] generate failed:",
      err instanceof Error ? err.message : err,
    );
    const lastQuestion = [...trimmed].reverse().find((m) => m.role === "user")?.content ?? "";
    after(() => logChat(lastQuestion, null, "error", visitorId, sessionId));
    return Response.json(
      { error: "Something went wrong generating a reply. Please try again." },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Any other method → 405
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT() {
  return methodNotAllowed();
}
export async function DELETE() {
  return methodNotAllowed();
}
export async function PATCH() {
  return methodNotAllowed();
}

function methodNotAllowed() {
  return Response.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "GET, POST" } },
  );
}
