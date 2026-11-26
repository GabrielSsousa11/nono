import { z } from "zod";
import { STAFF_ROLES } from "@/lib/auth/access";

export const inviteStaffSchema = z.object({
  email: z
    .email("Informe um e-mail válido.")
    .max(254)
    .transform((v) => v.toLowerCase()),
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(120),
  role: z.enum(STAFF_ROLES, "Escolha uma função."),
});

export const roleChangeSchema = z.object({
  userId: z.uuid(),
  role: z.enum(STAFF_ROLES),
  grant: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export type TeamActionState =
  { status: "idle" } | { status: "success"; message: string } | { status: "error"; message: string };

/** Traduz erros do Postgres/RPC para mensagens claras na interface. */
export function teamErrorMessage(error: { message?: string; code?: string } | null): string {
  const m = error?.message ?? "";
  if (m.includes("próprio papel de administrador"))
    return "Você não pode remover o seu próprio acesso de administrador.";
  if (m.includes("ao menos um administrador")) return "A clínica precisa ter ao menos um administrador.";
  if (error?.code === "42501" || m.includes("permissão negada"))
    return "Você não tem permissão para esta ação ou sua verificação em duas etapas expirou.";
  return "Não foi possível concluir a ação. Tente novamente.";
}
