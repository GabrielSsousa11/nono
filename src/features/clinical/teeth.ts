/** Numeração FDI e utilidades do odontograma (puro, testado). */
export const PERMANENT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const PERMANENT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const DECIDUOUS_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
export const DECIDUOUS_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

export function isValidFdi(n: number): boolean {
  const q = Math.floor(n / 10);
  const t = n % 10;
  return (q >= 1 && q <= 4 && t >= 1 && t <= 8) || (q >= 5 && q <= 8 && t >= 1 && t <= 5);
}

const TYPE_PERMANENT = ["", "Incisivo central", "Incisivo lateral", "Canino", "Primeiro pré-molar", "Segundo pré-molar", "Primeiro molar", "Segundo molar", "Terceiro molar"];
const TYPE_DECIDUOUS = ["", "Incisivo central decíduo", "Incisivo lateral decíduo", "Canino decíduo", "Primeiro molar decíduo", "Segundo molar decíduo"];
const QUADRANT = ["", "superior direito", "superior esquerdo", "inferior esquerdo", "inferior direito", "superior direito", "superior esquerdo", "inferior esquerdo", "inferior direito"];

export function toothName(fdi: number): string {
  const q = Math.floor(fdi / 10);
  const t = fdi % 10;
  const type = q <= 4 ? TYPE_PERMANENT[t] : TYPE_DECIDUOUS[t];
  return `${type} ${QUADRANT[q]}`;
}

/** Família para a forma 3D: 0 incisivo, 1 canino, 2 pré-molar, 3 molar. */
export function toothFamily(fdi: number): 0 | 1 | 2 | 3 {
  const q = Math.floor(fdi / 10);
  const t = fdi % 10;
  if (q >= 5) return t <= 2 ? 0 : t === 3 ? 1 : 3;
  return t <= 2 ? 0 : t === 3 ? 1 : t <= 5 ? 2 : 3;
}

export type ToothState = "existing" | "planned" | "completed" | "observation";

export interface ToothRecord {
  id: string;
  tooth_fdi: number;
  state: ToothState;
  procedure: string;
  surfaces: string[];
  notes: string | null;
  performed_on: string | null;
  recorded_at: string;
  superseded_at: string | null;
  visible_to_patient?: boolean;
}

/** Situação resumida do dente: planejado tem prioridade visual, depois realizado, depois observação. */
export function toothSummary(records: ToothRecord[]): Map<number, ToothState> {
  const priority: ToothState[] = ["planned", "completed", "observation", "existing"];
  const map = new Map<number, ToothState>();
  for (const r of records) {
    if (r.superseded_at) continue;
    const cur = map.get(r.tooth_fdi);
    if (!cur || priority.indexOf(r.state) < priority.indexOf(cur)) map.set(r.tooth_fdi, r.state);
  }
  return map;
}

export const stateLabel: Record<ToothState, string> = {
  planned: "Procedimento planejado",
  completed: "Procedimento realizado",
  observation: "Em observação",
  existing: "Condição preexistente",
};

export const stateColor: Record<ToothState | "none", string> = {
  planned: "#b29a70",
  completed: "#414d40",
  observation: "#c9a89a",
  existing: "#8c9488",
  none: "#f4efe6",
};

export const SURFACES = [
  { value: "M", label: "Mesial" },
  { value: "D", label: "Distal" },
  { value: "O", label: "Oclusal" },
  { value: "I", label: "Incisal" },
  { value: "V", label: "Vestibular" },
  { value: "L", label: "Lingual" },
  { value: "P", label: "Palatina" },
];
