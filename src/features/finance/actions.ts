"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff, rpcErrorMessage } from "@/lib/auth/guards";
import { getSessionContext } from "@/lib/auth/session";
import { parseMoney } from "@/lib/datetime";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const refresh = () => {
  revalidatePath("/studio/financeiro");
  revalidatePath("/studio/pacientes", "layout");
  revalidatePath("/portal/financeiro");
};

export async function createInvoice(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("finance.write");
  if (!ctx) return fail("Sem permissão.");
  const v = z
    .object({
      patientId: z.uuid("Escolha o paciente."),
      description: z.string().trim().min(3, "Descreva a cobrança.").max(200),
      amount: z.string(),
      dueDate: day,
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const cents = parseMoney(v.data.amount);
  if (!cents || cents <= 0) return fail("Valor inválido. Use, por exemplo, 250,00.");
  const { error } = await ctx.supabase.from("invoices").insert({
    patient_id: v.data.patientId,
    description: v.data.description,
    amount_cents: cents,
    due_date: v.data.dueDate,
    created_by: ctx.user.id,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Cobrança registrada.");
}

export async function recordPayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("finance.write");
  if (!ctx) return fail("Sem permissão.");
  const v = z
    .object({
      invoiceId: z.uuid(),
      amount: z.string(),
      paidOn: day,
      method: z.enum(["pix", "cash", "debit", "credit", "transfer", "other"]),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const cents = parseMoney(v.data.amount);
  if (!cents || cents <= 0) return fail("Valor inválido.");
  const { error } = await ctx.supabase.from("payments").insert({
    invoice_id: v.data.invoiceId,
    amount_cents: cents,
    paid_on: v.data.paidOn,
    method: v.data.method,
    recorded_by: ctx.user.id,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Pagamento registrado.");
}

export async function cancelInvoice(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("finance.write");
  if (!ctx) return fail("Sem permissão.");
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("id", id.data)
    .eq("status", "open");
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Cobrança cancelada.");
}

export async function createExpense(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("finance.write");
  if (!ctx) return fail("Sem permissão.");
  const v = z
    .object({
      description: z.string().trim().min(3, "Descreva a despesa.").max(200),
      category: z.string().trim().min(2, "Informe a categoria.").max(60),
      amount: z.string(),
      dueDate: day,
      paidOn: z.union([z.literal(""), day]).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Dados inválidos.");
  const cents = parseMoney(v.data.amount);
  if (!cents || cents <= 0) return fail("Valor inválido.");
  const { error } = await ctx.supabase.from("expenses").insert({
    description: v.data.description,
    category: v.data.category,
    amount_cents: cents,
    due_date: v.data.dueDate,
    paid_on: v.data.paidOn || null,
    recorded_by: ctx.user.id,
  });
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Despesa registrada.");
}

export async function payExpense(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("finance.write");
  if (!ctx) return fail("Sem permissão.");
  const v = z.object({ id: z.uuid(), paidOn: day }).safeParse(Object.fromEntries(fd));
  if (!v.success) return fail("Dados inválidos.");
  const { error } = await ctx.supabase.from("expenses").update({ paid_on: v.data.paidOn }).eq("id", v.data.id);
  if (error) return fail(rpcErrorMessage(error));
  refresh();
  return ok("Despesa paga.");
}

export async function answerSurvey(_p: ActionState, fd: FormData): Promise<ActionState> {
  const v = z
    .object({
      id: z.uuid(),
      score: z.coerce.number().int().min(0, "Escolha uma nota.").max(10),
      comment: z.string().trim().max(1000).optional(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!v.success) return fail(v.error.issues[0]?.message ?? "Escolha uma nota de 0 a 10.");
  const { supabase } = await getSessionContext();
  if (!supabase) return fail("Sua sessão expirou.");
  const { error } = await supabase.rpc("answer_survey", {
    p_survey: v.data.id,
    p_score: v.data.score,
    p_comment: v.data.comment || null,
  });
  if (error) return fail(rpcErrorMessage(error));
  revalidatePath("/portal/avaliacao");
  return ok("Obrigado pela avaliação!");
}
