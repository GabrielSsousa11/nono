import type { OpeningHours } from "./types";

const DAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;

/** "segunda a sexta", "sábado", "segunda, quarta e sexta" */
export function formatDays(days: number[]): string {
  const sorted = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return DAY_NAMES[sorted[0]];
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) {
    return `${DAY_NAMES[sorted[0]]} a ${DAY_NAMES[sorted[sorted.length - 1]]}`;
  }
  const names = sorted.map((d) => DAY_NAMES[d]);
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

export function formatHours(hours: OpeningHours): string {
  const days = formatDays(hours.days);
  return `${days.charAt(0).toUpperCase()}${days.slice(1)}, das ${hours.opens.replace(":", "h")} às ${hours.closes.replace(":", "h")}`.replace(
    /h00/g,
    "h",
  );
}

/** Link `tel:` apenas com dígitos (e prefixo +55 quando ausente). */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `tel:+${digits.startsWith("55") ? digits : `55${digits}`}`;
}

export function whatsappHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}
