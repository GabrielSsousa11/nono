/** Datas no fuso da clínica (sem bibliotecas). Testado em tests/unit/datetime.test.ts. */
export const CLINIC_TZ = "America/Sao_Paulo";

/** Diferença (minutos) entre o fuso e UTC num instante. Ex.: São Paulo → -180. */
export function tzOffsetMinutes(instant: Date, tz = CLINIC_TZ): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** "2026-12-07" + "09:30" (hora local da clínica) → Date (instante UTC). */
export function zonedToUtc(dateStr: string, timeStr = "00:00", tz = CLINIC_TZ): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = tzOffsetMinutes(guess, tz);
  const result = new Date(guess.getTime() - offset * 60000);
  // Ajuste em transições de horário de verão.
  const offset2 = tzOffsetMinutes(result, tz);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

/** Data local (AAAA-MM-DD) de um instante no fuso da clínica. */
export function localDate(instant: Date, tz = CLINIC_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    instant,
  );
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Dia da semana (0 = domingo) de uma data AAAA-MM-DD. */
export function weekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function startOfWeek(dateStr: string): string {
  return addDays(dateStr, -weekday(dateStr));
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function daysInMonth(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  // Ida e volta: rejeita datas inexistentes que o JavaScript "corrige" (30/02 → 02/03).
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: CLINIC_TZ, ...opts });
export const fmtTime = (d: string | Date) => fmt({ hour: "2-digit", minute: "2-digit" }).format(new Date(d));
export const fmtDate = (d: string | Date) =>
  fmt({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
export const fmtDateLong = (d: string | Date) =>
  fmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(d));
export const fmtDateTime = (d: string | Date) => fmt({ dateStyle: "short", timeStyle: "short" }).format(new Date(d));
/** Para datas puras (AAAA-MM-DD), sem deslocar pelo fuso. */
export const fmtPlainDate = (
  s: string,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...opts }).format(new Date(`${s}T12:00:00Z`));

export function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** "150,00" ou "150" → 15000. Retorna null se inválido. */
export function parseMoney(input: string): number | null {
  const clean = input
    .trim()
    .replace(/[R$\s.]/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** Instante (ISO) deslocado em horas a partir de agora. */
export function isoFromNow(hours = 0): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}
