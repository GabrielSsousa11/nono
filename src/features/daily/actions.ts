"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { rpcErrorMessage } from "@/lib/auth/guards";
import { getSessionContext } from "@/lib/auth/session";

export async function logHabit(_p: ActionState, fd: FormData): Promise<ActionState> {
  const v = z
    .object({
      patientId: z.uuid(),
      kind: z.enum(["brushing", "flossing"]),
      guided: z.coerce.number().int().min(0).max(600).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou.");
  const { error } = await supabase.rpc("log_habit", {
    p_patient: v.data.patientId,
    p_kind: v.data.kind,
    p_guided_seconds: v.data.guided && v.data.guided >= 10 ? v.data.guided : null,
  });
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath("/portal/daily");
  revalidatePath("/portal");
  return ok(v.data.kind === "brushing" ? "Escovação registrada." : "Fio dental registrado.");
}

export async function completeMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const v = z
    .object({ patientId: z.uuid(), mission: z.string().regex(/^[a-z0-9_]+$/) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou.");
  const { error } = await supabase.rpc("complete_mission", { p_patient: v.data.patientId, p_mission: v.data.mission });
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath("/portal/daily");
  return ok("Missão concluída.");
}
