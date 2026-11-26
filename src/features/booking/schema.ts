import { z } from "zod";

/** Versão da política de privacidade aceita no formulário. Atualize junto com /privacidade. */
export const PRIVACY_POLICY_VERSION = "privacidade-2026-11-preliminar";

export const periodOptions = [
  { value: "any", label: "Sem preferência" },
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
] as const;

export type Period = (typeof periodOptions)[number]["value"];

const phoneDigits = (value: string) => value.replace(/\D/g, "");

export const bookingRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo.")
    .max(120, "Use no máximo 120 caracteres.")
    .regex(/^[\p{L}][\p{L}\p{M}' .-]+$/u, "Use apenas letras no nome."),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const d = phoneDigits(v);
      const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
      return /^[1-9]{2}9?[0-9]{8}$/.test(local);
    }, "Informe um telefone com DDD, por exemplo (11) 91234-5678."),
  email: z
    .union([z.literal(""), z.email("Informe um e-mail válido.").max(254)])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : undefined)),
  serviceInterest: z.string().trim().max(80).optional(),
  preferredPeriod: z.enum(["any", "morning", "afternoon", "evening"]),
  message: z.string().trim().max(600, "Use no máximo 600 caracteres.").optional(),
  consent: z.literal(true, "É preciso concordar com a política de privacidade para enviar."),
  /** Honeypot: campo invisível; humanos não preenchem. */
  website: z.string().max(0).optional(),
});

export type BookingRequestInput = z.input<typeof bookingRequestSchema>;
export type BookingRequest = z.output<typeof bookingRequestSchema>;

export function normalizePhone(value: string): string {
  return phoneDigits(value);
}

/** Máscara progressiva (XX) XXXXX-XXXX para digitação. */
export function maskPhone(value: string): string {
  const d = phoneDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export type BookingActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "invalid"; fieldErrors: Partial<Record<keyof BookingRequestInput, string>> }
  | { status: "rate_limited"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };
