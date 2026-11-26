import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { connection } from "next/server";
import { cache } from "react";
import { createSessionClient } from "@/lib/supabase/server";
import { EMPTY_ACCESS, parseAccess, resolveStudioGate, type AccessInfo, type StudioGate } from "./access";

export interface SessionContext {
  supabase: SupabaseClient | null;
  user: User | null;
  access: AccessInfo;
  currentAal: string | null;
  hasVerifiedFactor: boolean;
  gate: StudioGate;
}

/**
 * Lê a sessão atual (cookies) — chamar somente dentro de <Suspense> ou em Server Actions.
 * `cache` evita consultas repetidas na mesma requisição.
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  // Sessão é sempre dado de requisição: nunca pré-renderizar, mesmo sem backend configurado.
  await connection();
  const supabase = await createSessionClient();
  const base = { supabase, user: null, access: EMPTY_ACCESS, currentAal: null, hasVerifiedFactor: false };
  if (!supabase) return { ...base, gate: "login" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...base, gate: "login" };

  const [accessRes, aalRes, factorsRes] = await Promise.all([
    supabase.rpc("my_access"),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const access = parseAccess(accessRes.data);
  const currentAal = aalRes.data?.currentLevel ?? null;
  const hasVerifiedFactor = (factorsRes.data?.totp?.length ?? 0) > 0;
  const gate = resolveStudioGate({ authenticated: true, isStaff: access.is_staff, currentAal, hasVerifiedFactor });

  return { supabase, user, access, currentAal, hasVerifiedFactor, gate };
});
