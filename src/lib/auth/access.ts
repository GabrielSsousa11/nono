/**
 * Regras de acesso puras (sem I/O) — testadas em tests/unit/access.test.ts.
 * A autorização definitiva é sempre do banco (RLS + RPCs); estas regras
 * decidem apenas navegação e o que a interface mostra.
 */

export const STAFF_ROLES = ["admin", "dentist", "receptionist", "finance"] as const;
export const ALL_ROLES = [...STAFF_ROLES, "patient", "guardian"] as const;
export type AppRole = (typeof ALL_ROLES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

export type Permission =
  | "users.manage"
  | "audit.read"
  | "settings.manage"
  | "content.manage"
  | "professionals.read"
  | "professionals.manage"
  | "patients.read"
  | "patients.write"
  | "patients.invite"
  | "guardians.manage"
  | "consents.read"
  | "consents.write"
  | "booking_requests.manage"
  | "clinical.read"
  | "clinical.write"
  | "finance.read"
  | "finance.write";

/** Retorno da RPC `public.my_access()`. */
export interface AccessInfo {
  roles: AppRole[];
  permissions: Permission[];
  is_staff: boolean;
  mfa_verified: boolean;
}

export const EMPTY_ACCESS: AccessInfo = { roles: [], permissions: [], is_staff: false, mfa_verified: false };

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrador",
  dentist: "Dentista",
  receptionist: "Recepcionista",
  finance: "Financeiro",
  patient: "Paciente",
  guardian: "Responsável autorizado",
};

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function can(access: AccessInfo, permission: Permission): boolean {
  return access.permissions.includes(permission);
}

export type StudioGate = "login" | "forbidden" | "enroll_mfa" | "verify_mfa" | "ok";

/** Decide para onde vai quem tenta abrir o CG Studio. */
export function resolveStudioGate(input: {
  authenticated: boolean;
  isStaff: boolean;
  currentAal: string | null;
  hasVerifiedFactor: boolean;
}): StudioGate {
  if (!input.authenticated) return "login";
  if (!input.isStaff) return "forbidden";
  if (input.currentAal === "aal2") return "ok";
  return input.hasVerifiedFactor ? "verify_mfa" : "enroll_mfa";
}

export const gatePath: Record<Exclude<StudioGate, "ok">, string> = {
  login: "/entrar",
  forbidden: "/portal",
  enroll_mfa: "/studio/mfa/configurar",
  verify_mfa: "/studio/mfa/verificar",
};

/** Destino após o login: equipe vai ao Studio, demais ao portal. */
export function homeFor(access: AccessInfo): "/studio" | "/portal" {
  return access.is_staff ? "/studio" : "/portal";
}

/** Normaliza a resposta crua da RPC, descartando valores desconhecidos. */
export function parseAccess(raw: unknown): AccessInfo {
  if (!raw || typeof raw !== "object") return EMPTY_ACCESS;
  const r = raw as Record<string, unknown>;
  const roles = Array.isArray(r.roles)
    ? r.roles.filter((x): x is AppRole => (ALL_ROLES as readonly string[]).includes(x))
    : [];
  const permissions = Array.isArray(r.permissions)
    ? r.permissions.filter((x): x is Permission => typeof x === "string" && /^[a-z_]+\.[a-z_]+$/.test(x))
    : [];
  return { roles, permissions, is_staff: r.is_staff === true, mfa_verified: r.mfa_verified === true };
}
