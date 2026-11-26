// Lista o que falta no conteúdo oficial antes de publicar. Uso: npm run content:check
// Sai com código 1 se houver lacunas bloqueantes (útil no pipeline de deploy).
import { findContentGaps } from "../src/lib/content/gaps.ts";
import { officialContent } from "../src/lib/content/official.ts";

const gaps = findContentGaps(officialContent);
if (gaps.length === 0) {
  console.log("✓ Conteúdo oficial completo.");
  process.exit(0);
}
for (const g of gaps) console.log(`${g.blocking ? "✗ BLOQUEANTE" : "• opcional  "}  ${g.field} — ${g.reason}`);
process.exit(gaps.some((g) => g.blocking) ? 1 : 0);
