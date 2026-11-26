"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";

export type EnrollState =
  | { status: "idle" }
  | { status: "ready"; factorId: string; qrCode: string; secret: string }
  | { status: "error"; message: string };

export type VerifyState = { status: "idle" } | { status: "error"; message: string };

const codeSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, "Digite os 6 números exibidos no aplicativo autenticador.");

/** Inicia o cadastro de um autenticador TOTP (remove tentativas não concluídas). */
export async function startTotpEnrollment(): Promise<EnrollState> {
  const { supabase, user, access } = await getSessionContext();
  if (!supabase || !user) redirect("/entrar");
  if (!access.is_staff) return { status: "error", message: "A verificação em duas etapas é exigida apenas da equipe." };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `CG Studio ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) {
    return { status: "error", message: "Não foi possível gerar o código de cadastro. Tente novamente." };
  }
  return { status: "ready", factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

async function challengeAndVerify(factorId: string, rawCode: FormDataEntryValue | null): Promise<VerifyState | null> {
  const code = codeSchema.safeParse(String(rawCode ?? ""));
  if (!code.success) return { status: "error", message: code.error.issues[0]?.message ?? "Código inválido." };
  const { supabase } = await getSessionContext();
  if (!supabase) redirect("/entrar");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) {
    return {
      status: "error",
      message:
        error.status === 429
          ? "Muitas tentativas. Aguarde um minuto e tente novamente."
          : "Código incorreto ou expirado. Confira o horário do celular e digite o código atual.",
    };
  }
  return null;
}

/** Confirma o cadastro do autenticador (a sessão passa a aal2). */
export async function confirmTotpEnrollment(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const factorId = z.string().uuid().safeParse(formData.get("factorId"));
  if (!factorId.success) return { status: "error", message: "Cadastro expirado. Gere um novo QR Code." };
  const failure = await challengeAndVerify(factorId.data, formData.get("code"));
  if (failure) return failure;
  redirect("/studio");
}

/** Verificação no login com um autenticador já cadastrado. */
export async function verifyTotp(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const { supabase, user } = await getSessionContext();
  if (!supabase || !user) redirect("/entrar");
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) redirect("/studio/mfa/configurar");
  const failure = await challengeAndVerify(factor.id, formData.get("code"));
  if (failure) return failure;
  redirect("/studio");
}
