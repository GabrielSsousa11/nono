import { z } from "zod";
import type { SiteContent } from "./types";

/**
 * Esquemas das seções editáveis no CG Studio. O conteúdo do banco só entra no
 * site se passar por estes esquemas (dados malformados são ignorados).
 */
const text = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) =>
  text(max)
    .nullable()
    .transform((v) => (v ? v : null));

export const sectionSchemas = {
  professional: z.object({
    name: text(120).min(3),
    cro: nullableText(40),
    role: nullableText(120),
    bio: z.array(text(1200).min(1)).max(6),
    specialties: z.array(text(80).min(2)).max(12),
  }),
  contact: z.object({
    phone: nullableText(30),
    whatsapp: nullableText(30),
    email: z
      .email()
      .nullable()
      .or(z.literal("").transform(() => null)),
    instagram: nullableText(60),
  }),
  address: z
    .object({
      street: text(160).min(3),
      district: text(80).min(2),
      city: text(80).min(2),
      state: text(2).min(2),
      postalCode: text(9).min(8),
      mapsUrl: z.url().startsWith("https://").nullable(),
    })
    .nullable(),
  hours: z
    .array(
      z.object({
        days: z.array(z.number().int().min(0).max(6)).min(1),
        opens: z.string().regex(/^\d{2}:\d{2}$/),
        closes: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(10),
  services: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
        name: text(80).min(3),
        summary: text(200).min(3),
        explanation: text(1500).min(10),
        steps: z.array(z.object({ title: text(60).min(2), description: text(300).min(2) })).max(6),
        region: z.enum(["enamel", "crown", "gum", "root", "arch", "whole"]),
      }),
    )
    .max(20),
  clinic_faq: z.array(z.object({ question: text(200).min(5), answer: text(1500).min(5) })).max(30),
  legal: z.object({
    companyName: nullableText(160),
    cnpj: z
      .string()
      .regex(/^\d{14}$/)
      .nullable(),
    dpoContact: nullableText(200),
  }),
} as const;

export type SectionKey = keyof typeof sectionSchemas;
export const SECTION_KEYS = Object.keys(sectionSchemas) as SectionKey[];

/** Aplica as seções publicadas (válidas) sobre o conteúdo base verificado. */
export function mergeSections(base: SiteContent, sections: Partial<Record<string, unknown>>): SiteContent {
  const out: SiteContent = structuredClone(base);
  for (const key of SECTION_KEYS) {
    if (!(key in sections)) continue;
    const parsed = sectionSchemas[key].safeParse(sections[key]);
    if (!parsed.success) continue;
    const v = parsed.data as never;
    switch (key) {
      case "professional":
        out.professional = { ...out.professional, ...(v as object), photo: out.professional.photo };
        break;
      case "contact":
        out.contact = v;
        break;
      case "address":
        out.address = v;
        break;
      case "hours":
        out.hours = v;
        break;
      case "services":
        out.services = v;
        break;
      case "clinic_faq":
        out.clinicFaq = v;
        break;
      case "legal":
        out.legal = v;
        break;
    }
  }
  return out;
}
