import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { can, type AccessInfo, type Permission } from "./access";
import { getSessionContext } from "./session";

export interface StaffContext {
  supabase: SupabaseClient;
  user: User;
  access: AccessInfo;
}

/** Para páginas e ações do Studio: exige sessão de equipe com MFA e, opcionalmente, uma permissão. */
export async function requireStaff(permission?: Permission): Promise<StaffContext | null> {
  const ctx = await getSessionContext();
  if (ctx.gate !== "ok" || !ctx.supabase || !ctx.user) return null;
  if (permission && !can(ctx.access, permission)) return null;
  return { supabase: ctx.supabase, user: ctx.user, access: ctx.access };
}

export const PORTAL_PATIENT_COOKIE = "cg_patient";

export interface PatientPortalContext {
  supabase: SupabaseClient;
  user: User;
  patients: { id: string; name: string; isSelf: boolean; birthDate: string | null }[];
  current: { id: string; name: string; isSelf: boolean; birthDate: string | null } | null;
}

/** Portal: pacientes que a pessoa pode acompanhar (ela mesma + dependentes) e o selecionado. */
export async function requirePortal(selected?: string | null): Promise<PatientPortalContext | null> {
  const ctx = await getSessionContext();
  if (selected === undefined) selected = (await cookies()).get(PORTAL_PATIENT_COOKIE)?.value ?? null;
  if (!ctx.supabase || !ctx.user) return null;
  const { data } = await ctx.supabase
    .from("patients")
    .select("id, full_name, social_name, birth_date, profile_id")
    .is("archived_at", null)
    .order("full_name");
  const patients = (
    (data ?? []) as {
      id: string;
      full_name: string;
      social_name: string | null;
      birth_date: string | null;
      profile_id: string | null;
    }[]
  ).map((p) => ({
    id: p.id,
    name: p.social_name || p.full_name,
    isSelf: p.profile_id === ctx.user!.id,
    birthDate: p.birth_date,
  }));
  patients.sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
  const current = patients.find((p) => p.id === selected) ?? patients[0] ?? null;
  return { supabase: ctx.supabase, user: ctx.user, patients, current };
}

/** Mensagem amigável para erros de RPC (sem detalhes internos). */
export function rpcErrorMessage(
  error: { message?: string; code?: string } | null,
  fallback = "Não foi possível concluir. Tente novamente.",
): string {
  const m = error?.message ?? "";
  const known = [
    "horário indisponível",
    "antecedência mínima não respeitada",
    "data além do período disponível",
    "este serviço é agendado pela clínica",
    "mudança de situação não permitida",
    "informe o motivo do cancelamento",
    "cancelamento em cima da hora deve ser feito com a clínica",
    "remarcação em cima da hora deve ser feita com a clínica",
    "só consultas futuras ativas podem ser remarcadas",
    "já existe um pedido ativo na lista de espera para este serviço",
    "oferta expirada ou indisponível",
    "a vaga já foi preenchida",
    "meta do dia já cumprida — mais vezes não traz benefício extra",
    "registros de escovação precisam de intervalo de pelo menos 2 horas",
    "protocolo inexistente ou ainda não aprovado por dentista",
    "somente uma dentista pode aprovar o protocolo",
    "paciente sem consentimento ativo para fotografias clínicas",
    "o check-in fica disponível no dia da consulta",
    "consulta não está aguardando chegada",
    "código inválido ou expirado",
    "pagamento excede o valor da cobrança",
    "cobrança cancelada não recebe pagamentos",
    "período inválido (máximo de 1 ano)",
    "pesquisa indisponível",
    "paciente não encontrado ou arquivado",
    "este paciente já está vinculado a outra conta",
    "o conteúdo do arquivo não corresponde ao formato informado",
    "informe o motivo da revogação",
  ];
  const hit = known.find((k) => m.includes(k));
  if (hit) return hit.charAt(0).toUpperCase() + hit.slice(1) + ".";
  if (error?.code === "42501" || m.includes("permissão negada")) return "Você não tem permissão para esta ação.";
  if (error?.code === "23505") return "Este registro já existe.";
  return fallback;
}
