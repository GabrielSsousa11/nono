"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { createRateLimiter, hashIdentifier } from "@/lib/rate-limit";
import { createSessionClient } from "@/lib/supabase/server";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "invalid"; message: string }
  | { status: "rate_limited"; message: string }
  | { status: "unavailable"; message: string };

const emailSchema = z.email("Informe um e-mail válido.").max(254);
const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

/**
 * Envia link mágico de acesso. Não cria contas (shouldCreateUser: false): o
 * cadastro é feito pela clínica. A resposta é a mesma para e-mail cadastrado
 * ou não, para não revelar quem é paciente.
 */
export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(
    String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0]?.message ?? "E-mail inválido." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter(await hashIdentifier(`${ip}|${parsed.data}`)).allowed) {
    return { status: "rate_limited", message: "Muitas tentativas. Aguarde alguns minutos para pedir um novo link." };
  }

  const supabase = await createSessionClient();
  if (!supabase) {
    return { status: "unavailable", message: "A área do paciente ainda não foi ativada pela clínica." };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl()}/auth/confirm?next=/portal` },
  });

  // Erros de "usuário não encontrado" são tratados como envio (anti-enumeração).
  if (error && error.status === 429) {
    return { status: "rate_limited", message: "Muitas tentativas. Aguarde alguns minutos para pedir um novo link." };
  }
  return { status: "sent" };
}

export async function signOut() {
  const supabase = await createSessionClient();
  await supabase?.auth.signOut();
  redirect("/entrar");
}
