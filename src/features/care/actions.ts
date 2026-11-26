"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff, rpcErrorMessage } from "@/lib/auth/guards";
import { getSessionContext } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";

const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional();

export async function saveProtocol(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("care.manage");
  if (!ctx) return fail("Sem permissão.");
  const v = z
    .object({
      id: z.union([z.literal(""), z.uuid()]).optional(),
      kind: z.enum(["post_op", "orthodontic", "appliance", "hygiene", "return"]),
      title: z.string().trim().min(3, "Dê um título.").max(120),
      body: z.string().trim().min(10, "Escreva a orientação (mínimo 10 caracteres).").max(5000),
      interval: z.union([z.literal(""), z.coerce.number().int().min(1).max(730)]).optional(),
      approve: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const row: Record<string, unknown> = {
    kind: v.data.kind,
    title: v.data.title,
    body: v.data.body,
    default_interval_days: v.data.interval || null,
  };
  if (v.data.approve === "on") {
    row.approved_by = ctx.user.id;
    row.approved_at = new Date().toISOString();
  }
  const { error } = v.data.id ? await ctx.supabase.from("care_protocols").update(row).eq("id", v.data.id) : await ctx.supabase.from("care_protocols").insert(row);
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath("/studio/cuidados");
  return ok(v.data.approve === "on" ? "Protocolo salvo e aprovado." : "Protocolo salvo. Aguarda aprovação de uma dentista.");
}

export async function assignProtocol(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("care.manage");
  if (!ctx) return fail("Sem permissão.");
  const v = z
    .object({ patientId: z.uuid(), protocolId: z.uuid("Escolha o protocolo."), note: z.string().trim().max(1000).optional(), interval: z.union([z.literal(""), z.coerce.number().int().min(1).max(730)]).optional(), firstDue: date, ends: date })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await ctx.supabase.rpc("assign_care_protocol", {
    p_patient: v.data.patientId,
    p_protocol: v.data.protocolId,
    p_note: v.data.note || null,
    p_interval_days: v.data.interval || null,
    p_first_due: v.data.firstDue || null,
    p_ends: v.data.ends || null,
  });
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath(`/studio/pacientes/${v.data.patientId}/cuidados`);
  return ok("Orientação enviada ao paciente.");
}

export async function stopReminder(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("care.manage");
  if (!ctx) return fail("Sem permissão.");
  const v = z.object({ id: z.uuid(), patientId: z.uuid() }).safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase.from("care_reminders").update({ active: false }).eq("id", v.data.id);
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath(`/studio/pacientes/${v.data.patientId}/cuidados`);
  return ok("Lembrete encerrado.");
}

export async function saveHabitGoal(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("care.manage");
  if (!ctx) return fail("Sem permissão.");
  const v = z
    .object({ patientId: z.uuid(), brushing: z.coerce.number().int().min(1).max(3), flossing: z.coerce.number().int().min(0).max(2), seconds: z.coerce.number().int().min(60).max(240), note: z.string().trim().max(300).optional() })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Use 1 a 3 escovações, 0 a 2 usos de fio e 60 a 240 segundos.");
  const { error } = await ctx.supabase.from("habit_goals").upsert({
    patient_id: v.data.patientId,
    brushing_per_day: v.data.brushing,
    flossing_per_day: v.data.flossing,
    brushing_seconds: v.data.seconds,
    note: v.data.note || null,
    set_by: ctx.user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath(`/studio/pacientes/${v.data.patientId}/cuidados`);
  return ok("Metas do CG Daily atualizadas.");
}

export async function acknowledgeCare(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou.");
  const { error } = await supabase.rpc("acknowledge_care", { p_reminder: id.data });
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath("/portal/cuidados");
  return ok("Leitura confirmada.");
}

export async function staffReply(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("messages.manage");
  if (!ctx) return fail("Sem permissão.");
  const v = z.object({ patientId: z.uuid(), body: z.string().trim().min(2, "Escreva a resposta.").max(2000) }).safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await ctx.supabase.rpc("send_patient_message", { p_patient: v.data.patientId, p_body: v.data.body, p_topic: null });
  if (error) return fail(rpcErrorMessage(error));
  await ctx.supabase.rpc("mark_messages_read", { p_patient: v.data.patientId });
  revalidatePath("/studio/mensagens");
  return ok("Resposta enviada.");
}

/** CG Passport: gera token temporário (10 min) e QR Code com APENAS o link de check-in. */
export async function issueCheckin(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(fd.get("appointmentId"));
  if (!id.success) return fail("Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou.");
  const { data, error } = await supabase.rpc("issue_checkin_token", { p_appointment: id.data });
  if (error) return fail(rpcErrorMessage(error));
  const { token, expires_at } = data as { token: string; expires_at: string };
  const url = `${siteUrl()}/studio/checkin?codigo=${token}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#202420", light: "#ffffff" }, errorCorrectionLevel: "M" });
  return ok("QR Code gerado.", { svg, expiresAt: expires_at, code: token.slice(0, 8).toUpperCase() });
}

export async function performCheckin(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("checkin.perform");
  if (!ctx) return fail("Sem permissão.");
  const raw = String(fd.get("codigo") ?? "").trim();
  const token = raw.includes("codigo=") ? new URL(raw, siteUrl()).searchParams.get("codigo") ?? "" : raw;
  if (!/^[0-9a-f]{48}$/.test(token)) return fail("Código inválido. Leia o QR Code do paciente ou cole o link completo.");
  const { data, error } = await ctx.supabase.rpc("checkin_with_token", { p_token: token });
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath("/studio/agenda");
  const r = data as { patient: string; starts_at: string };
  return ok(`Chegada registrada: ${r.patient}.`);
}
