import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { contentSource } from "@/lib/env";
import { createAnonServerClient } from "@/lib/supabase/anon";
import { devFixtures } from "./dev-fixtures";
import { officialContent } from "./official";
import { mergeSections } from "./sections";
import type { LoadedContent } from "./types";

export const SITE_CONTENT_TAG = "site-content";

/**
 * Conteúdo do site: base verificada do código + seções publicadas (e verificadas)
 * no CG Studio. Cacheado por tag; a publicação invalida imediatamente.
 */
export async function loadSiteContent(): Promise<LoadedContent> {
  "use cache";
  cacheTag(SITE_CONTENT_TAG);
  cacheLife("hours");
  if (contentSource() === "fixtures") return { content: devFixtures, synthetic: true };
  const supabase = createAnonServerClient();
  if (!supabase) return { content: officialContent, synthetic: false };
  try {
    const { data, error } = await supabase
      .from("website_content")
      .select("section, payload, version")
      .eq("published", true)
      .order("version", { ascending: false });
    if (error || !data) return { content: officialContent, synthetic: false };
    const latest: Record<string, unknown> = {};
    for (const row of data as { section: string; payload: unknown }[])
      if (!(row.section in latest)) latest[row.section] = row.payload;
    return { content: mergeSections(officialContent, latest), synthetic: false };
  } catch {
    return { content: officialContent, synthetic: false };
  }
}
