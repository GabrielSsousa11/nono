"use server";

import { revalidatePath } from "next/cache";
import { can, isStaffRole } from "@/lib/auth/access";
import { getSessionContext } from "@/lib/auth/session";
import { siteUrl } from "@/lib/env";
import { createAuthAdminClient } from "@/lib/supabase/admin";
import { inviteStaffSchema, roleChangeSchema, teamErrorMessage, type TeamActionState } from "./team-schema";

const DENIED: TeamActionState = { status: "error", message: "Somente administradores gerenciam a equipe." };
const NO_ADMIN_API: TeamActionState = {
  status: "error",
  message:
    "Convites e redefinições exigem a chave administrativa do servidor (SUPABASE_SERVICE_ROLE_KEY), ainda não configurada.",
};

async function requireManager() {
  const ctx = await getSessionContext();
  if (!ctx.supabase || !ctx.user || ctx.gate !== "ok" || !can(ctx.access, "users.manage")) return null;
  return ctx;
}

export async function inviteStaff(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const ctx = await requireManager();
  if (!ctx) return DENIED;
  const parsed = inviteStaffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const admin = createAuthAdminClient();
  if (!admin) return NO_ADMIN_API;

  const { email, fullName, role } = parsed.data;
  let userId: string | null = null;
  const invited = await admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${siteUrl()}/auth/confirm?next=/continuar`,
  });
  if (invited.data.user) {
    userId = invited.data.user.id;
  } else {
    // Conta já existente: localiza o perfil (visível para quem gerencia usuários).
    const { data } = await ctx.supabase!.from("profiles").select("id").eq("email", email).maybeSingle();
    userId = data?.id ?? null;
  }
  if (!userId)
    return { status: "error", message: "Não foi possível enviar o convite. Confira o e-mail e tente novamente." };

  const { error } = await ctx.supabase!.rpc("grant_role", { p_user: userId, p_role: role });
  if (error) return { status: "error", message: teamErrorMessage(error) };
  await ctx.supabase!.rpc("record_admin_event", { p_action: "staff.invite", p_user: userId });
  revalidatePath("/studio/equipe");
  return {
    status: "success",
    message: invited.data.user
      ? `Convite enviado para ${email}. No primeiro acesso, a pessoa cadastrará a verificação em duas etapas.`
      : `${email} já tinha conta; a função foi adicionada.`,
  };
}

export async function changeStaffRole(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const ctx = await requireManager();
  if (!ctx) return DENIED;
  const parsed = roleChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Dados inválidos." };
  const { userId, role, grant } = parsed.data;
  const { error } = await ctx.supabase!.rpc(grant ? "grant_role" : "revoke_role", { p_user: userId, p_role: role });
  if (error) return { status: "error", message: teamErrorMessage(error) };
  revalidatePath("/studio/equipe");
  return { status: "success", message: grant ? "Função adicionada." : "Função removida." };
}

export async function resetStaffMfa(_prev: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const ctx = await requireManager();
  if (!ctx) return DENIED;
  const userId = String(formData.get("userId") ?? "");
  if (userId === ctx.user!.id)
    return { status: "error", message: "Para trocar o seu próprio autenticador, peça a outro administrador." };
  const { data: target } = await ctx.supabase!.from("user_roles").select("role").eq("user_id", userId);
  if (!target?.some((r) => isStaffRole(r.role))) return { status: "error", message: "Pessoa não pertence à equipe." };
  const admin = createAuthAdminClient();
  if (!admin) return NO_ADMIN_API;

  const { data, error } = await admin.mfa.listFactors({ userId });
  if (error) return { status: "error", message: "Não foi possível consultar os autenticadores." };
  for (const factor of data.factors) await admin.mfa.deleteFactor({ userId, id: factor.id });
  await ctx.supabase!.rpc("record_admin_event", { p_action: "staff.mfa_reset", p_user: userId });
  return {
    status: "success",
    message: "Verificação redefinida. No próximo acesso, a pessoa cadastrará um novo autenticador.",
  };
}
