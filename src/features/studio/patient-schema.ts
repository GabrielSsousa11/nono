import { z } from "zod";
import { isValidCpf } from "@/lib/cpf";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const patientSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(120),
  socialName: optionalText(120),
  birthDate: z
    .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => !v || (v > "1900-01-01" && v <= new Date().toISOString().slice(0, 10)),
      "Data de nascimento inválida.",
    ),
  cpf: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : null))
    .refine((v) => !v || isValidCpf(v), "CPF inválido."),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\D/g, "") : null))
    .refine((v) => !v || /^\d{10,13}$/.test(v), "Telefone inválido."),
  email: z
    .union([z.literal(""), z.email("E-mail inválido.")])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null)),
  responsibleProfessionalId: z
    .union([z.literal(""), z.uuid()])
    .optional()
    .transform((v) => (v ? v : null)),
  adminNotes: optionalText(2000),
});

export type PatientInput = z.output<typeof patientSchema>;

export function toPatientRow(v: PatientInput) {
  return {
    full_name: v.fullName,
    social_name: v.socialName,
    birth_date: v.birthDate,
    cpf: v.cpf,
    phone: v.phone,
    email: v.email,
    responsible_professional_id: v.responsibleProfessionalId,
    admin_notes: v.adminNotes,
  };
}

export const RELATIONSHIPS = [
  { value: "mother", label: "Mãe" },
  { value: "father", label: "Pai" },
  { value: "legal_guardian", label: "Tutor(a) legal" },
  { value: "curator", label: "Curador(a)" },
  { value: "authorized_adult", label: "Adulto autorizado pelo paciente" },
  { value: "other", label: "Outro" },
] as const;

export const LEGAL_BASIS = [
  { value: "parental_authority", label: "Poder familiar" },
  { value: "court_order", label: "Decisão judicial" },
  { value: "patient_authorization", label: "Autorização do próprio paciente" },
  { value: "other", label: "Outro (descrever na evidência)" },
] as const;

export const CONSENT_KINDS = [
  { value: "treatment", label: "Consentimento para tratamento" },
  { value: "clinical_photos", label: "Fotografias clínicas" },
  { value: "photo_publicity", label: "Uso de imagem em divulgação" },
  { value: "privacy_policy", label: "Ciência da política de privacidade" },
  { value: "communications_whatsapp", label: "Contato por WhatsApp" },
  { value: "communications_email", label: "Contato por e-mail" },
  { value: "birthday_messages", label: "Mensagem de aniversário" },
] as const;

export function isMinor(birthDate: string | null, today = new Date()): boolean {
  if (!birthDate) return false;
  const [y, m, d] = birthDate.split("-").map(Number);
  const age =
    today.getFullYear() - y - (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d) ? 1 : 0);
  return age < 18;
}
