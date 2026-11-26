"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff, rpcErrorMessage } from "@/lib/auth/guards";
import { localDate, isIsoDate } from "@/lib/datetime";
import { isValidFdi } from "./teeth";

const DENIED = fail("Somente a equipe clínica com verificação em duas etapas pode registrar.");
const refresh = (patientId: string) => {
  revalidatePath(`/studio/pacientes/${patientId}/clinico`);
  revalidatePath(`/studio/pacientes/${patientId}/fotos`);
  revalidatePath("/portal", "layout");
};
const uuid = z.uuid();
const date = z.union([z.literal(""), z.string().refine(isIsoDate, "Data inválida.")]).optional();

export async function addClinicalRecord(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      patientId: uuid,
      kind: z.enum(["anamnesis", "evolution", "exam", "note"]),
      content: z.string().trim().min(3, "Escreva o registro.").max(10000),
      visible: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { data: pro } = await ctx.supabase
    .from("professionals")
    .select("id")
    .eq("profile_id", ctx.user.id)
    .maybeSingle();
  const { error } = await ctx.supabase.from("clinical_records").insert({
    patient_id: v.data.patientId,
    kind: v.data.kind,
    content: v.data.content,
    visible_to_patient: v.data.visible === "on",
    recorded_by: ctx.user.id,
    professional_id: (pro as { id: string } | null)?.id ?? null,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Registro adicionado ao prontuário.");
}

export async function addToothRecord(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      patientId: uuid,
      tooth: z.coerce.number().int().refine(isValidFdi, "Dente inválido."),
      state: z.enum(["existing", "planned", "completed", "observation"]),
      procedure: z.string().trim().min(2, "Descreva o procedimento ou condição.").max(120),
      performedOn: date,
      notes: z.string().trim().max(1000).optional(),
      hidden: z.string().optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  if (v.data.state === "completed" && !v.data.performedOn)
    return fail("Informe a data em que o procedimento foi realizado.");
  const surfaces = fd
    .getAll("surfaces")
    .map(String)
    .filter((s) => ["M", "D", "O", "I", "V", "L", "P"].includes(s));
  const { error } = await ctx.supabase.from("tooth_records").insert({
    patient_id: v.data.patientId,
    tooth_fdi: v.data.tooth,
    state: v.data.state,
    procedure: v.data.procedure,
    surfaces,
    performed_on: v.data.performedOn || null,
    notes: v.data.notes || null,
    visible_to_patient: v.data.hidden !== "on",
    recorded_by: ctx.user.id,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok(`Registro salvo no dente ${v.data.tooth}.`);
}

export async function supersedeToothRecord(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z.object({ id: uuid, patientId: uuid }).safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase
    .from("tooth_records")
    .update({ superseded_at: new Date().toISOString() })
    .eq("id", v.data.id);
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Registro marcado como substituído (o histórico é mantido).");
}

export async function ensureDentalChart(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({ patientId: uuid, dentition: z.enum(["permanent", "deciduous", "mixed"]) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase
    .from("dental_charts")
    .upsert({ patient_id: v.data.patientId, dentition: v.data.dentition }, { onConflict: "patient_id" });
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Dentição atualizada.");
}

export async function createPlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      patientId: uuid,
      title: z.string().trim().min(3, "Dê um título ao plano.").max(120),
      goals: z.string().trim().max(2000).optional(),
      estimatedEnd: date,
      professionalId: z.union([z.literal(""), uuid]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { error } = await ctx.supabase.from("treatment_plans").insert({
    patient_id: v.data.patientId,
    title: v.data.title,
    goals: v.data.goals || null,
    estimated_end: v.data.estimatedEnd || null,
    professional_id: v.data.professionalId || null,
    created_by: ctx.user.id,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Plano criado como rascunho. Ative-o para que o paciente veja.");
}

export async function updatePlan(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      id: uuid,
      patientId: uuid,
      status: z.enum(["draft", "active", "completed", "cancelled"]).optional(),
      estimatedEnd: date,
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const patch: Record<string, unknown> = {};
  if (v.data.status) patch.status = v.data.status;
  if (v.data.estimatedEnd !== undefined) patch.estimated_end = v.data.estimatedEnd || null;
  const { error } = await ctx.supabase.from("treatment_plans").update(patch).eq("id", v.data.id);
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Plano atualizado.");
}

export async function addStage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      planId: uuid,
      patientId: uuid,
      title: z.string().trim().min(2, "Dê um título à etapa.").max(120),
      description: z.string().trim().max(2000).optional(),
      guidance: z.string().trim().max(2000).optional(),
      estimatedDate: date,
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const { data: last } = await ctx.supabase
    .from("treatment_stages")
    .select("position")
    .eq("plan_id", v.data.planId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await ctx.supabase.from("treatment_stages").insert({
    plan_id: v.data.planId,
    patient_id: v.data.patientId,
    position: ((last as { position: number } | null)?.position ?? 0) + 1,
    title: v.data.title,
    description: v.data.description || null,
    guidance: v.data.guidance || null,
    estimated_date: v.data.estimatedDate || null,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Etapa adicionada.");
}

export async function updateStage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      id: uuid,
      patientId: uuid,
      status: z.enum(["pending", "scheduled", "in_progress", "completed", "skipped"]),
      estimatedDate: date,
      guidance: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const patch: Record<string, unknown> = {
    status: v.data.status,
    completed_at: v.data.status === "completed" ? new Date().toISOString() : null,
  };
  if (v.data.estimatedDate !== undefined) patch.estimated_date = v.data.estimatedDate || null;
  if (v.data.guidance !== undefined) patch.guidance = v.data.guidance || null;
  const { error } = await ctx.supabase.from("treatment_stages").update(patch).eq("id", v.data.id);
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok("Etapa atualizada.");
}

/** Confere os primeiros bytes: o tipo informado pelo navegador pode ser forjado. */
function matchesSignature(b: Uint8Array, ext: "jpg" | "png" | "webp" | "pdf"): boolean {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (ext === "jpg") return at(0, 0xff, 0xd8, 0xff);
  if (ext === "png") return at(0, 0x89, 0x50, 0x4e, 0x47);
  if (ext === "pdf") return at(0, 0x25, 0x50, 0x44, 0x46);
  return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
}

const ALLOWED = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as const;

export async function uploadClinicalFile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({
      patientId: uuid,
      target: z.enum(["photo", "document"]),
      takenOn: date,
      viewLabel: z.string().trim().max(60).optional(),
      notes: z.string().trim().max(1000).optional(),
      title: z.string().trim().max(120).optional(),
      kind: z.enum(["consent_form", "exam", "report", "guidance", "other"]).optional(),
      visible: z.string().optional(),
    })
    .safeParse(Object.fromEntries([...fd.entries()].filter(([, val]) => typeof val === "string")));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Escolha um arquivo.");
  if (file.size > 4.5 * 1024 * 1024) return fail("Arquivo maior que 4,5 MB.");
  const ext = ALLOWED[file.type as keyof typeof ALLOWED];
  if (!ext || (v.data.target === "photo" && ext === "pdf")) return fail("Formato não permitido.");
  if (v.data.target === "document" && (!v.data.title || v.data.title.length < 3))
    return fail("Dê um título ao documento.");

  // Checagem de consentimento antes do envio (o banco também exige).
  if (v.data.target === "photo") {
    const { count } = await ctx.supabase
      .from("consents")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", v.data.patientId)
      .eq("kind", "clinical_photos")
      .eq("granted", true)
      .is("revoked_at", null);
    if (!count)
      return fail("Paciente sem consentimento ativo para fotografias clínicas. Registre o consentimento antes.");
  }

  if (!matchesSignature(new Uint8Array(await file.slice(0, 12).arrayBuffer()), ext))
    return fail("O conteúdo do arquivo não corresponde ao formato informado.");

  const path = `${v.data.patientId}/${crypto.randomUUID()}.${ext}`;
  const bucket = v.data.target === "photo" ? "clinical-photos" : "documents";
  const { error: upErr } = await ctx.supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return fail("Não foi possível enviar o arquivo. Tente novamente.");

  const { error } =
    v.data.target === "photo"
      ? await ctx.supabase.from("clinical_photos").insert({
          patient_id: v.data.patientId,
          storage_path: path,
          taken_on: v.data.takenOn || localDate(new Date()),
          view_label: v.data.viewLabel || null,
          professional_notes: v.data.notes || null,
          visible_to_patient: v.data.visible === "on",
          uploaded_by: ctx.user.id,
        })
      : await ctx.supabase.from("documents").insert({
          patient_id: v.data.patientId,
          kind: v.data.kind ?? "other",
          title: v.data.title!,
          storage_path: path,
          visible_to_patient: v.data.visible === "on",
          uploaded_by: ctx.user.id,
        });
  if (error) {
    await ctx.supabase.storage.from(bucket).remove([path]);
    return fail(rpcErrorMessage(error));
  }
  refresh(v.data.patientId);
  return ok(v.data.target === "photo" ? "Foto adicionada ao diário." : "Documento adicionado.");
}

export async function setPhotoVisibility(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("clinical.write");
  if (!ctx) return DENIED;
  const v = z
    .object({ id: uuid, patientId: uuid, visible: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase
    .from("clinical_photos")
    .update({ visible_to_patient: v.data.visible === "true" })
    .eq("id", v.data.id);
  if (error) return fail(rpcErrorMessage(error));
  refresh(v.data.patientId);
  return ok(v.data.visible === "true" ? "Foto liberada ao paciente." : "Foto ocultada do paciente.");
}
