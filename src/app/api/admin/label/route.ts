// POST /api/admin/label — attach a human label to a visitor
// ("Acme recruiter", "my mom", …). Admin-cookie gated.

import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifyAdminCookie } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const store = await cookies();
  if (!verifyAdminCookie(store.get(ADMIN_COOKIE)?.value)) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) {
    return Response.json({ error: "Database is not configured." }, { status: 503 });
  }

  let body: { visitorId?: unknown; label?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
  if (!UUID_RE.test(visitorId)) {
    return Response.json({ error: "Invalid visitor id." }, { status: 400 });
  }
  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 80)
      : null;

  const { error } = await db.from("visitors").update({ label }).eq("id", visitorId);
  if (error) {
    return Response.json({ error: "Update failed." }, { status: 500 });
  }
  return Response.json({ label });
}
