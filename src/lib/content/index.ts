import { contentSource } from "@/lib/env";
import { devFixtures } from "./dev-fixtures";
import { officialContent } from "./official";
import type { LoadedContent } from "./types";

export type * from "./types";

/**
 * Ponto único de acesso ao conteúdo do site. Os componentes nunca importam
 * `official.ts` ou `dev-fixtures.ts` diretamente.
 */
export function getSiteContent(): LoadedContent {
  if (contentSource() === "fixtures") {
    return { content: devFixtures, synthetic: true };
  }
  return { content: officialContent, synthetic: false };
}

export { findContentGaps, type ContentGap } from "./gaps";
