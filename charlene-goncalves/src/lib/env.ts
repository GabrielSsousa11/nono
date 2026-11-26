import { z } from "zod";

/**
 * Variáveis de ambiente públicas (seguras para o navegador).
 * Todas são opcionais: o site institucional funciona sem backend configurado,
 * e cada recurso dependente informa com honestidade quando está indisponível.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
});

function emptyToUndefined(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SITE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
  NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
});

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function siteUrl(): string {
  return publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/**
 * Fonte do conteúdo institucional.
 *  - "official": somente dados verificados em src/lib/content/official.ts (padrão).
 *  - "fixtures": dados SINTÉTICOS para desenvolvimento visual. Proibido em produção
 *    (o build falha — ver next.config.ts).
 */
export type ContentSource = "official" | "fixtures";

export function contentSource(): ContentSource {
  return process.env.CG_CONTENT_SOURCE === "fixtures" ? "fixtures" : "official";
}
