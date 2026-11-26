"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff, rpcErrorMessage } from "@/lib/auth/guards";
import { siteUrl } from "@/lib/env";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { patientSchema, toPatientRow } from "./patient-schema";

const DENIED = fail("Você não tem permissão para esta ação.");
const refresh = (id: string) => revalidatePath(`/studio/pacientes/${id}`);

export async function createPatient(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("patients.write");
  if (!ctx) return DENIED;
  const v = patientSchema.safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { data, error } = await ctx.supabase
    .from("patients")
    .insert({ ...toPatientRow(v.data), created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "Já existe paciente com este CPF." : rpcErrorMessage(error));
  redirect(`/studio/pacientes/${data.id}`);
}

export async function updatePatient(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("patients.write");
  if (!ctx) return DENIED;
  const id = z.uuid().safeParse(fd.get("id"));
  const v = patientSchema.safeParse(Object.fromEntries(fd));
  if (!id.success || !v.success) return fail(v.error?.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await ctx.supabase.from("patients").update(toPatientRow(v.data)).eq("id", id.data);
  if (error) return fail(error.code === "23505" ? "Já existe paciente com este CPF." : rpcErrorMessage(error));
  refresh(id.data);
  return ok("Cadastro atualizado.");
}

export async function setPatientArchived(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("patients.write");
  if (!ctx) return DENIED;
  const v = z.object({ id: z.uuid(), archived: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase
    .from("patients")
    .update({ archived_at: v.data.archived === "true" ? new Date().toISOString() : null })
    .eq("id", v.data.id);
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.id);
  return ok(
    v.data.archived === "true" ? "Cadastro arquivado. O histórico é mantido pelo prazo legal." : "Cadastro reativado.",
  );
}

export async function addGuardian(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("guardians.manage");
  if (!ctx) return DENIED;
  const v = z
    .object({
      patientId: z.uuid(),
      guardianName: z.string().trim().min(3, "Informe o nome do responsável.").max(120),
      guardianEmail: z.union([z.literal(""), z.email("E-mail inválido.")]).optional(),
      relationship: z.enum(["mother", "father", "legal_guardian", "curator", "authorized_adult", "other"]),
      legalBasis: z.enum(["parental_authority", "court_order", "patient_authorization", "other"]),
      evidenceNote: z.string().trim().max(500).optional(),
      canViewClinical: z.string().optional(),
      canSchedule: z.string().optional(),
      validUntil: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await ctx.supabase.from("patient_guardians").insert({
    patient_id: v.data.patientId,
    guardian_name: v.data.guardianName,
    guardian_email: v.data.guardianEmail?.toLowerCase() || null,
    relationship: v.data.relationship,
    legal_basis: v.data.legalBasis,
    evidence_note: v.data.evidenceNote || null,
    can_view_clinical: v.data.canViewClinical === "on",
    can_schedule: v.data.canSchedule === "on",
    valid_until: v.data.validUntil || null,
    created_by: ctx.user.id,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Responsável registrado.");
}

export async function revokeGuardian(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("guardians.manage");
  if (!ctx) return DENIED;
  const v = z
    .object({ id: z.uuid(), patientId: z.uuid(), reason: z.string().trim().min(3, "Informe o motivo.").max(300) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await ctx.supabase.rpc("revoke_guardian", { p_guardian_link: v.data.id, p_reason: v.data.reason });
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Acesso revogado.");
}

export async function recordConsent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("consents.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      patientId: z.uuid(),
      kind: z.enum([
        "privacy_policy",
        "treatment",
        "clinical_photos",
        "photo_publicity",
        "communications_whatsapp",
        "communications_email",
        "birthday_messages",
      ]),
      version: z.string().trim().min(1, "Informe a versão do termo.").max(40),
      granted: z.enum(["true", "false"]),
      method: z.enum(["in_person", "signed_document"]),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await ctx.supabase.rpc("record_consent", {
    p_patient: v.data.patientId,
    p_kind: v.data.kind,
    p_version: v.data.version,
    p_granted: v.data.granted === "true",
    p_method: v.data.method,
    p_on_behalf_of_guardian: null,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Consentimento registrado.");
}

/** Convida o paciente (ou responsável) ao portal: cria/acha a conta e vincula ao cadastro. */
export async function invitePortalAccess(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("patients.invite");
  if (!ctx) return DENIED;
  const v = z
    .object({
      patientId: z.uuid(),
      email: z.email("E-mail inválido."),
      guardianLinkId: z.union([z.literal(""), z.uuid()]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const admin = createAuthAdminClient();
  if (!admin)
    return fail(
      "Convites exigem a chave administrativa do servidor (SUPABASE_SERVICE_ROLE_KEY), ainda não configurada.",
    );
  const email = v.data.email.toLowerCase();

  const invited = await admin.inviteUserByEmail(email, { redirectTo: `${siteUrl()}/auth/confirm?next=/continuar` });
  let userId = invited.data.user?.id ?? null;
  if (!userId) {
    const { data } = await ctx.supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    userId = (data as { id: string } | null)?.id ?? null;
  }
  if (!userId) return fail("Não foi possível enviar o convite. Confira o e-mail.");

  const { error } = v.data.guardianLinkId
    ? await ctx.supabase.rpc("link_guardian_account", { p_guardian_link: v.data.guardianLinkId, p_user: userId })
    : await ctx.supabase.rpc("link_patient_account", { p_patient: v.data.patientId, p_user: userId });
  if (error)
    return fail(
      error.message?.includes("equipe") ? "Este e-mail pertence a um membro da equipe." : rpcErrorMessage(error),
    );
  refresh(v.data.patientId);
  return ok(invited.data.user ? `Convite enviado para ${email}.` : `${email} já tinha conta; acesso vinculado.`);
}
