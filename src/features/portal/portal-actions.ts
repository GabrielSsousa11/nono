"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { PORTAL_PATIENT_COOKIE, requirePortal, rpcErrorMessage } from "@/lib/auth/guards";
import { getSessionContext } from "@/lib/auth/session";

export async function switchPatient(fd: FormData): Promise<void> {
  const id = z.uuid().safeParse(fd.get("patientId"));
  if (!id.success) return;
  const portal = await requirePortal(null);
  if (!portal?.patients.some((p) => p.id === id.data)) return;
  (await cookies()).set(PORTAL_PATIENT_COOKIE, id.data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  revalidatePath("/portal", "layout");
}

export async function markNotificationsRead(): Promise<void> {
  const { supabase, user } = await getSessionContext();
  if (!supabase || !user) return;
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).is("read_at", null);
  revalidatePath("/portal", "layout");
}

export async function sendMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const v = z.object({ patientId: z.uuid(), body: z.string().trim().min(2, "Escreva sua mensagem.").max(2000) }).safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Mensagem inválida.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou.");
  const { error } = await supabase.rpc("send_patient_message", { p_patient: v.data.patientId, p_body: v.data.body, p_topic: null });
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath("/portal/mensagens");
  revalidatePath("/studio/mensagens");
  return ok("Mensagem enviada. A equipe responde em horário de atendimento.");
}
