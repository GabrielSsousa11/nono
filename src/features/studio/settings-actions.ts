"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff, rpcErrorMessage } from "@/lib/auth/guards";
import { SETTINGS_SPEC } from "./settings-spec";

export async function saveSettings(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("settings.manage");
  if (!ctx) return fail("Somente administradores alteram configurações.");
  for (const spec of SETTINGS_SPEC) {
    let value: unknown;
    if (spec.type === "boolean") value = fd.get(spec.key) === "on";
    else {
      const n = Number(fd.get(spec.key));
      if (!Number.isInteger(n) || n < spec.min! || n > spec.max!) return fail(`${spec.label}: use um número entre ${spec.min} e ${spec.max}.`);
      value = n;
    }
    const { error } = await ctx.supabase.from("clinic_settings").upsert({ key: spec.key, value, description: spec.label, updated_by: ctx.user.id });
    if (error) return fail(rpcErrorMessage(error));
  }
  revalidatePath("/studio/configuracoes");
  return ok("Configurações salvas.");
}
