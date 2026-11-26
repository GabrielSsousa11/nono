"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff } from "@/lib/auth/guards";
import { getSessionContext } from "@/lib/auth/session";

const subSchema = z.object({ endpoint: z.url().startsWith("https://"), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });

export async function savePushSubscription(raw: unknown): Promise<{ ok: boolean }> {
  const v = subSchema.safeParse(raw);
  const { supabase, user } = await getSessionContext();
  if (!v.success || !supabase || !user) return { ok: false };
  const { error } = await supabase.from("push_subscriptions").upsert(
    { profile_id: user.id, endpoint: v.data.endpoint, p256dh: v.data.keys.p256dh, auth: v.data.keys.auth },
    { onConflict: "endpoint" },
  );
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const { supabase, user } = await getSessionContext();
  if (!supabase || !user) return { ok: false };
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("profile_id", user.id);
  return { ok: !error };
}

/** Registra no banco o hash do segredo do disparador configurado no servidor. */
export async function registerDispatchSecret(): Promise<ActionState> {
  const ctx = await requireStaff("settings.manage");
  if (!ctx) return fail("Somente administradores.");
  const secret = process.env.PUSH_DISPATCH_SECRET ?? "";
  if (secret.length < 32) return fail("Defina PUSH_DISPATCH_SECRET (mínimo 32 caracteres) no servidor primeiro.");
  const hash = createHash("sha256").update(secret).digest("hex");
  const { error } = await ctx.supabase.from("clinic_settings").upsert({ key: "push.dispatch_secret_sha256", value: hash, description: "Hash do segredo do disparador de Web Push", updated_by: ctx.user.id });
  if (error) return fail("Não foi possível registrar.");
  return ok("Disparador autorizado.");
}
