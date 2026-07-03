// Admin session auth — single password from ADMIN_PASSWORD, no user table.
//
// The session cookie value is HMAC-SHA256(password, fixed label): stateless,
// verifiable on any instance, and rotating the password invalidates every
// existing session. Server-only (node:crypto) — never import client-side.

import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "ouss-admin-session";
const TOKEN_LABEL = "ouss-admin-session-v1";

function secret(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length < 8 || pw.startsWith("your-")) return null;
  return pw;
}

export function adminConfigured(): boolean {
  return secret() !== null;
}

export function sessionToken(): string | null {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update(TOKEN_LABEL).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Compare same-length buffers only; length leak is fine (token length is public).
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyPassword(candidate: string): boolean {
  const s = secret();
  return s !== null && safeEqual(candidate, s);
}

export function verifyAdminCookie(value: string | null | undefined): boolean {
  const expected = sessionToken();
  return Boolean(expected && value && safeEqual(value, expected));
}
