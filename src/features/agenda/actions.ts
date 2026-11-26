"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isIsoDate } from "@/lib/datetime";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff, rpcErrorMessage } from "@/lib/auth/guards";
import { getSessionContext } from "@/lib/auth/session";

const refresh = () => {
  revalidatePath("/studio/agenda");
  revalidatePath("/portal", "layout");
  revalidatePath("/studio/lista-de-espera");
};

/** Horários livres (a RPC só devolve horários, nunca dados de outros pacientes). */
export async function getSlots(
  professionalId: string,
  serviceId: string,
  day: string,
): Promise<{ slots: string[]; error?: string }> {
  const v = z
    .object({ p: z.uuid(), s: z.uuid(), d: z.string().refine(isIsoDate, "Data inválida.") })
    .safeParse({ p: professionalId, s: serviceId, d: day });
  if (!v.success) return { slots: [], error: "Escolha serviço, profissional e data." };
  const { supabase, user } = await getSessionContext();
  if (!supabase || !user) return { slots: [], error: "Sua sessão expirou. Entre novamente." };
  const { data, error } = await supabase.rpc("available_slots", {
    p_professional: v.data.p,
    p_service: v.data.s,
    p_day: v.data.d,
  });
  if (error) return { slots: [], error: rpcErrorMessage(error) };
  return { slots: ((data ?? []) as { starts_at: string }[]).map((r) => r.starts_at) };
}

/** Profissionais que realizam um serviço (para o formulário de agendamento). */
export async function professionalsFor(serviceId: string): Promise<{ id: string; name: string }[]> {
  if (!z.uuid().safeParse(serviceId).success) return [];
  const { supabase } = await getSessionContext();
  if (!supabase) return [];
  const { data } = await supabase
    .from("professional_services")
    .select("professionals(id, display_name, active)")
    .eq("service_id", serviceId);
  return ((data ?? []) as unknown as { professionals: { id: string; display_name: string; active: boolean } | null }[])
    .map((r) => r.professionals)
    .filter((p): p is { id: string; display_name: string; active: boolean } => Boolean(p?.active))
    .map((p) => ({ id: p.id, name: p.display_name }));
}

export async function searchPatients(q: string): Promise<{ id: string; name: string; detail: string }[]> {
  const ctx = await requireStaff("patients.read");
  const term = q
    .trim()
    .slice(0, 60)
    .replace(/[%_,()]/g, "");
  if (!ctx || term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  let query = ctx.supabase
    .from("patients")
    .select("id, full_name, social_name, phone, birth_date")
    .is("archived_at", null)
    .limit(8);
  query = digits.length >= 4 ? query.ilike("phone", `%${digits}%`) : query.ilike("full_name", `%${term}%`);
  const { data } = await query;
  return (
    (data ?? []) as {
      id: string;
      full_name: string;
      social_name: string | null;
      phone: string | null;
      birth_date: string | null;
    }[]
  ).map((p) => ({
    id: p.id,
    name: p.social_name || p.full_name,
    detail: [p.birth_date, p.phone].filter(Boolean).join(" · "),
  }));
}

const bookSchema = z.object({
  patientId: z.uuid("Escolha o paciente."),
  serviceId: z.uuid("Escolha o serviço."),
  professionalId: z.uuid("Escolha o profissional."),
  startsAt: z.iso.datetime({ offset: true, message: "Escolha um horário." }),
  bookingRequestId: z.union([z.literal(""), z.uuid()]).optional(),
});

export async function bookAppointment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const v = bookSchema.safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase, access } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou. Entre novamente.");
  const { error } = await supabase.rpc("book_appointment", {
    p_patient: v.data.patientId,
    p_professional: v.data.professionalId,
    p_service: v.data.serviceId,
    p_starts_at: v.data.startsAt,
    p_source: v.data.bookingRequestId ? "booking_request" : access.is_staff ? "studio" : "portal",
    p_booking_request: v.data.bookingRequestId || null,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Consulta agendada.");
}

export async function setAppointmentStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const v = z
    .object({
      id: z.uuid(),
      status: z.enum(["scheduled", "confirmed", "checked_in", "completed", "cancelled", "no_show"]),
      reason: z.string().trim().max(300).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou. Entre novamente.");
  const { error } = await supabase.rpc("set_appointment_status", {
    p_appointment: v.data.id,
    p_status: v.data.status,
    p_reason: v.data.reason || null,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  const msg: Record<string, string> = {
    confirmed: "Consulta confirmada.",
    cancelled: "Consulta cancelada.",
    checked_in: "Chegada registrada.",
    completed: "Atendimento concluído.",
    no_show: "Falta registrada.",
    scheduled: "Consulta reaberta.",
  };
  return ok(msg[v.data.status]);
}

export async function rescheduleAppointment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const v = z
    .object({ id: z.uuid(), startsAt: z.iso.datetime({ offset: true, message: "Escolha o novo horário." }) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou. Entre novamente.");
  const { error } = await supabase.rpc("reschedule_appointment", {
    p_appointment: v.data.id,
    p_new_start: v.data.startsAt,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Consulta remarcada.");
}

export async function joinWaitingList(_p: ActionState, fd: FormData): Promise<ActionState> {
  const v = z
    .object({
      patientId: z.uuid("Escolha o paciente."),
      serviceId: z.uuid("Escolha o serviço."),
      professionalId: z.union([z.literal(""), z.uuid()]).optional(),
      period: z.enum(["any", "morning", "afternoon", "evening"]).default("any"),
      latest: z.union([z.literal(""), z.string().refine(isIsoDate, "Data inválida.")]).optional(),
      notes: z.string().trim().max(300).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou. Entre novamente.");
  const { error } = await supabase.rpc("join_waiting_list", {
    p_patient: v.data.patientId,
    p_service: v.data.serviceId,
    p_professional: v.data.professionalId || null,
    p_period: v.data.period,
    p_earliest: null,
    p_latest: v.data.latest || null,
    p_notes: v.data.notes || null,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Incluído na lista de espera. Avisaremos quando uma vaga compatível abrir.");
}

export async function leaveWaitingList(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou.");
  const { error } = await supabase.rpc("leave_waiting_list", { p_entry: id.data });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Removido da lista de espera.");
}

export async function acceptWaitlistOffer(_p: ActionState, fd: FormData): Promise<ActionState> {
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou.");
  const { error } = await supabase.rpc("accept_waitlist_offer", { p_entry: id.data });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Vaga confirmada! A consulta está na sua agenda.");
}
