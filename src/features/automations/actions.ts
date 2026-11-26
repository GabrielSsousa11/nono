"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff, rpcErrorMessage } from "@/lib/auth/guards";

export async function updateRule(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("automations.manage");
  if (!ctx) return fail("Sem permissão.");
  const v = z.object({ key: z.string().regex(/^[a-z_]+\.[a-z_0-9]+$/), enabled: z.string().optional(), number: z.union([z.literal(""), z.coerce.number().int().min(0).max(720)]).optional(), numberKey: z.string().regex(/^[a-z_]*$/).optional() }).safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Valor inválido.");
  const { data: rule } = await ctx.supabase.from("automation_rules").select("config").eq("key", v.data.key).maybeSingle();
  const config = { ...((rule as { config: Record<string, unknown> } | null)?.config ?? {}) };
  if (v.data.numberKey && v.data.number !== "" && v.data.number !== undefined) config[v.data.numberKey] = v.data.number;
  const { error } = await ctx.supabase.from("automation_rules").update({ enabled: v.data.enabled === "on", config }).eq("key", v.data.key);
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath("/studio/automacoes");
  return ok("Regra salva.");
}

export async function runNow(): Promise<ActionState> {
  const ctx = await requireStaff("automations.manage");
  if (!ctx) return fail("Sem permissão.");
  const { data, error } = await ctx.supabase.rpc("run_automations_now");
  if (error) return fail(rpcErrorMessage(error));
  const r = data as { scheduled: number; processed: number; failed: number };
  revalidatePath("/studio/automacoes");
  return ok(`Agendados: ${r.scheduled}. Executados: ${r.processed}. Com falha: ${r.failed}.`);
}
