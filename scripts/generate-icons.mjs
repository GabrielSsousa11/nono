// Gera os ícones do PWA a partir do monograma CG. Uso: npm run icons
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const mark = (stroke, ring) => `
  <circle cx="24" cy="24" r="17" fill="none" stroke="${ring}" stroke-width="0.6"/>
  <g transform="translate(24 24) scale(0.72) translate(-24 -24)">
    <path d="M30.5 15.2A11 11 0 1 0 30.5 32.8" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M33.6 19.4A7.4 7.4 0 1 0 33.6 28.6V24.6H28.6" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

const icon = ({ bg, stroke, ring, padded }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="512" height="512">
  <rect width="48" height="48" fill="${bg}"/>
  <g transform="translate(24 24) scale(${padded ? 0.92 : 1.2}) translate(-24 -24)">${mark(stroke, ring)}</g>
</svg>`;

await mkdir("public/icons", { recursive: true });
const brand = { bg: "#414d40", stroke: "#f7f4ed", ring: "#b29a70" };
const out = [
  ["public/icons/icon-192.png", 192, icon({ ...brand, padded: false })],
  ["public/icons/icon-512.png", 512, icon({ ...brand, padded: false })],
  ["public/icons/icon-maskable-512.png", 512, icon({ ...brand, padded: true })],
  ["src/app/apple-icon.png", 180, icon({ ...brand, padded: false })],
];
for (const [file, size, svg] of out) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log("✓", file);
}
await writeFile(
  "src/app/icon.svg",
  icon({ bg: "#414d40", stroke: "#f7f4ed", ring: "#b29a70", padded: false }).replace(' width="512" height="512"', ""),
);
console.log("✓ src/app/icon.svg");
