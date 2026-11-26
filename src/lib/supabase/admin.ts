import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Cliente com a SERVICE ROLE — ignora RLS. Exceção documentada (ADR-011):
 * usar SOMENTE para operações da API administrativa de autenticação
 * (`auth.admin.inviteUserByEmail`), e SEMPRE depois de verificar a permissão de
 * quem pediu com a sessão dessa pessoa. Nunca usar para ler ou gravar tabelas.
 */
export function createAuthAdminClient(): SupabaseClient["auth"]["admin"] | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !key) return null;
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).auth.admin;
}
