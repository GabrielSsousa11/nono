import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** URLs assinadas de curta duração (5 min). Nunca use URLs públicas para dados clínicos. */
export async function signedUrls(
  supabase: SupabaseClient,
  bucket: "clinical-photos" | "documents",
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 300);
  return Object.fromEntries(
    (data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]),
  );
}
