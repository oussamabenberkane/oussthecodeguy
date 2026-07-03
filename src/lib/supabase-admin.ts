// Server-only Supabase client using the service-role key.
//
// All analytics tables have RLS enabled with NO policies, so this client is the
// only way in or out — nothing is readable from the browser. Mirrors the chat
// route's "missing key" pattern: returns null instead of throwing, so the app
// still builds and runs (tracking becomes a no-op) without env vars.
//
// NEVER import this from a client component.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith("your-")) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
