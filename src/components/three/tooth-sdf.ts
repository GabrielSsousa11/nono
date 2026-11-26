/**
 * Molar CONCEITUAL descrito como campo de distância com sinal (SDF).
 *
 * Esquemático por definição: não representa a anatomia de nenhum paciente.
 * Coordenadas no cubo [-1, 1]³, eixo Y para cima (coroa em cima, raízes embaixo).
 * Funções puras — testadas em tests/unit/tooth-sdf.test.ts.
 */

type V3 = readonly [number, number, number];

const len = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** União suave (polinomial) — junções orgânicas entre volumes. */
export function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}

/** Subtração suave: remove b de a. */
export function ssub(a: number, b: number, k: number): number {
  const h = clamp(0.5 - (0.5 * (a + b)) / k, 0, 1);
  return mix(a, -b, h) + k * h * (1 - h);
}

function sdRoundBox(px: number, py: number, pz: number, b: V3, r: number): number {
  const qx = Math.abs(px) - b[0];
  const qy = Math.abs(py) - b[1];
  const qz = Math.abs(pz) - b[2];
  return len(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

function sdSphere(px: number, py: number, pz: number, c: V3, r: number): number {
  return len(px - c[0], py - c[1], pz - c[2]) - r;
}

/** Cápsula afunilada de a (raio ra) até b (raio rb) — usada nas raízes. */
function sdTaperedCapsule(px: number, py: number, pz: number, a: V3, b: V3, ra: number, rb: number): number {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const pax = px - a[0];
  const pay = py - a[1];
  const paz = pz - a[2];
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return len(pax - bax * h, pay - bay * h, paz - baz * h) - mix(ra, rb, h);
}

const CUSPS: V3[] = [
  [0.22, 0.52, 0.17],
  [-0.22, 0.53, 0.16],
  [0.23, 0.5, -0.18],
  [-0.2, 0.51, -0.19],
  [0.02, 0.46, 0.25],
];

/** Distância assinada ao molar: negativa dentro, positiva fora. */
export function toothSdf(x: number, y: number, z: number): number {
  // Coroa: volume arredondado, levemente mais largo no terço oclusal (bossa vestibular).
  const bulge = 1 + 0.12 * clamp(y - 0.0, 0, 0.45);
  let d = sdRoundBox(x / bulge, y - 0.2, z / bulge, [0.24, 0.08, 0.19], 0.27);

  // Cúspides fundidas suavemente.
  for (const c of CUSPS) d = smin(d, sdSphere(x, y, z, c, 0.2), 0.1);

  // Fossa central e sulcos oclusais.
  d = ssub(d, sdSphere(x, y, z, [0, 0.8, 0], 0.27), 0.12);
  d = ssub(d, sdTaperedCapsule(x, y, z, [-0.4, 0.68, 0], [0.4, 0.68, 0], 0.05, 0.05), 0.07);
  d = ssub(d, sdTaperedCapsule(x, y, z, [0.02, 0.69, -0.36], [-0.02, 0.69, 0.36], 0.04, 0.04), 0.06);

  // Colo do dente: estreitamento cervical.
  const neck = sdRoundBox(x, y + 0.12, z, [0.17, 0.08, 0.14], 0.13);
  d = smin(d, neck, 0.18);

  // Raízes mesial e distal, divergentes e levemente curvas.
  const curve = 0.09 * Math.max(0, -y) * Math.max(0, -y);
  const rootM = sdTaperedCapsule(x + curve, y, z, [0.15, -0.12, 0.02], [0.27, -0.82, 0.04], 0.165, 0.05);
  const rootD = sdTaperedCapsule(x - curve, y, z, [-0.15, -0.12, -0.02], [-0.25, -0.8, -0.03], 0.165, 0.05);
  d = smin(d, smin(rootM, rootD, 0.06), 0.16);

  return d;
}

/**
 * Amostra o SDF numa grade `size³` no mesmo layout do MarchingCubes do three.js
 * (índice = x + y·size + z·size²; coordenada = (i − size/2) / (size/2)).
 * Retorna densidade = −sdf·scale (positivo dentro), isolação em 0.
 */
export function sampleToothField(size: number, scale = 1): Float32Array {
  const field = new Float32Array(size * size * size);
  const half = size / 2;
  // Encolhe levemente para manter a superfície longe das bordas da grade.
  const fit = 1.22;
  for (let k = 0; k < size; k++) {
    const z = ((k - half) / half) * fit;
    for (let j = 0; j < size; j++) {
      const y = ((j - half) / half) * fit + 0.02;
      for (let i = 0; i < size; i++) {
        const x = ((i - half) / half) * fit;
        field[i + j * size + k * size * size] = -toothSdf(x, y, z) * scale;
      }
    }
  }
  return field;
}
