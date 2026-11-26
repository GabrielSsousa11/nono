"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff, rpcErrorMessage } from "@/lib/auth/guards";
import { parseMoney, zonedToUtc } from "@/lib/datetime";

const DENIED = fail("Você não tem permissão para esta ação.");
const done = (msg: string) => {
  revalidatePath("/studio/servicos");
  revalidatePath("/studio/agenda");
  return ok(msg);
};

const serviceSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do serviço.").max(80),
  duration: z.coerce.number().int().min(5, "Duração mínima de 5 minutos.").max(480),
  buffer: z.coerce.number().int().min(0).max(120).default(0),
  price: z.string().trim().optional(),
  description: z.string().trim().max(600).optional(),
  selfBooking: z.string().optional(),
});

export async function createService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("services.manage");
  if (!ctx) return DENIED;
  const v = serviceSchema.safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const price = v.data.price ? parseMoney(v.data.price) : null;
  if (v.data.price && price === null) return fail("Valor inválido. Use, por exemplo, 150,00.");
  const { error } = await ctx.supabase.from("services").insert({
    name: v.data.name,
    duration_minutes: v.data.duration,
    buffer_minutes: v.data.buffer,
    price_cents: price,
    description: v.data.description || null,
    self_booking: v.data.selfBooking === "on",
  });
  if (error) return fail(rpcErrorMessage(error));
  return done("Serviço cadastrado.");
}

export async function toggleService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("services.manage");
  if (!ctx) return DENIED;
  const v = z
    .object({ id: z.uuid(), field: z.enum(["active", "self_booking"]), value: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase
    .from("services")
    .update({ [v.data.field]: v.data.value === "true" })
    .eq("id", v.data.id);
  if (error) return fail(rpcErrorMessage(error));
  return done("Atualizado.");
}

const profSchema = z.object({
  displayName: z.string().trim().min(3, "Informe o nome.").max(120),
  croNumber: z
    .string()
    .trim()
    .regex(/^\d{0,8}$/, "CRO deve conter apenas números.")
    .optional(),
  croState: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{2})?$/, "UF com 2 letras.")
    .optional(),
  profileId: z.union([z.literal(""), z.uuid()]).optional(),
});

export async function createProfessional(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("professionals.manage");
  if (!ctx) return DENIED;
  const v = profSchema.safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  if (Boolean(v.data.croNumber) !== Boolean(v.data.croState))
    return fail("Informe número e UF do CRO, ou nenhum dos dois.");
  const { error } = await ctx.supabase.from("professionals").insert({
    display_name: v.data.displayName,
    cro_number: v.data.croNumber || null,
    cro_state: v.data.croState || null,
    profile_id: v.data.profileId || null,
  });
  if (error)
    return fail(error.code === "23505" ? "CRO ou conta já vinculados a outro profissional." : rpcErrorMessage(error));
  return done("Profissional cadastrado.");
}

export async function toggleProfessionalService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("services.manage");
  if (!ctx) return DENIED;
  const v = z
    .object({ professionalId: z.uuid(), serviceId: z.uuid(), link: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const row = { professional_id: v.data.professionalId, service_id: v.data.serviceId };
  const { error } =
    v.data.link === "true"
      ? await ctx.supabase.from("professional_services").upsert(row)
      : await ctx.supabase.from("professional_services").delete().match(row);
  if (error) return fail(rpcErrorMessage(error));
  return done(v.data.link === "true" ? "Serviço vinculado." : "Serviço desvinculado.");
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

export async function addAvailability(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("services.manage");
  if (!ctx) return DENIED;
  const v = z
    .object({
      professionalId: z.uuid("Escolha o profissional."),
      weekday: z.coerce.number().int().min(0).max(6),
      starts: time,
      ends: time,
    })
    .refine((x) => x.ends > x.starts, "O fim precisa ser depois do início.")
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await ctx.supabase.from("availability").insert({
    professional_id: v.data.professionalId,
    weekday: v.data.weekday,
    starts: v.data.starts,
    ends: v.data.ends,
  });
  if (error) return fail(rpcErrorMessage(error));
  return done("Horário adicionado.");
}

export async function removeAvailability(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("services.manage");
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase.from("availability").delete().eq("id", id.data);
  if (error) return fail(rpcErrorMessage(error));
  return done("Horário removido.");
}

export async function addBlock(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("agenda.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      professionalId: z.union([z.literal(""), z.uuid()]),
      kind: z.enum(["holiday", "absence", "block"]),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial inválida."),
      startTime: z.union([z.literal(""), time]),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final inválida."),
      endTime: z.union([z.literal(""), time]),
      reason: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const startsAt = zonedToUtc(v.data.startDate, v.data.startTime || "00:00");
  const endsAt = v.data.endTime ? zonedToUtc(v.data.endDate, v.data.endTime) : zonedToUtc(v.data.endDate, "23:59");
  if (endsAt <= startsAt) return fail("O fim precisa ser depois do início.");
  const { error } = await ctx.supabase.from("schedule_blocks").insert({
    professional_id: v.data.professionalId || null,
    kind: v.data.kind,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: v.data.reason || null,
    created_by: ctx.user.id,
  });
  if (error) return fail(rpcErrorMessage(error));
  return done("Bloqueio registrado.");
}

export async function removeBlock(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("agenda.write");
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase.from("schedule_blocks").delete().eq("id", id.data);
  if (error) return fail(rpcErrorMessage(error));
  return done("Bloqueio removido.");
}
