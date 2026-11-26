import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Cliente sem sessão, com a chave pública (publishable/anon), para chamadas
 * públicas do servidor — p.ex. a RPC `request_booking`. Sujeito a RLS.
 * Nunca usar a service role key em código de aplicação web.
 */
export function createAnonServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
