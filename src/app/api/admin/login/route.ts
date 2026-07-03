// POST /api/admin/login — exchange the admin password for a session cookie.
// DELETE — log out. Login attempts are rate limited hard (it's a password gate).

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  adminConfigured,
  sessionToken,
  verifyPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

const RATE_LIMIT = 10; // attempts
const RATE_WINDOW_MS = 15 * 60_000;
const COOKIE_MAX_AGE_S = 30 * 24 * 3600;

const attempts = new Map<string, number[]>();

function rateLimited(ip: string, now: number): boolean {
  const windowStart = now - RATE_WINDOW_MS;
  const recent = (attempts.get(ip) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT) {
    attempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  attempts.set(ip, recent);
  return false;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return Response.json({ error: "Admin is not configured." }, { status: 503 });
  }
  if (rateLimited(clientIp(req), Date.now())) {
    return Response.json(
      { error: "Too many attempts — try again later." },
      { status: 429 },
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!password || !verifyPassword(password)) {
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }

  const token = sessionToken();
  if (!token) {
    return Response.json({ error: "Admin is not configured." }, { status: 503 });
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_S,
  });
  return new Response(null, { status: 204 });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  return new Response(null, { status: 204 });
}
