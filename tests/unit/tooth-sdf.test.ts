import { describe, expect, it } from "vitest";
import { sampleToothField, smin, toothSdf } from "@/components/three/tooth-sdf";

describe("toothSdf", () => {
  it("é negativo dentro da coroa e positivo longe do dente", () => {
    expect(toothSdf(0, 0.25, 0)).toBeLessThan(0);
    expect(toothSdf(0, 2, 0)).toBeGreaterThan(0);
    expect(toothSdf(1, 0, 1)).toBeGreaterThan(0);
  });

  it("tem duas raízes separadas (espaço entre elas é vazio)", () => {
    expect(toothSdf(0.24, -0.6, 0)).toBeLessThan(0);
    expect(toothSdf(-0.22, -0.6, 0)).toBeLessThan(0);
    expect(toothSdf(0, -0.6, 0)).toBeGreaterThan(0);
  });

  it("tem fossa oclusal (centro do topo mais baixo que as cúspides)", () => {
    expect(toothSdf(0.22, 0.66, 0.17)).toBeLessThan(0.02);
    expect(toothSdf(0, 0.66, 0)).toBeGreaterThan(0);
  });

  it("smin aproxima min com transição suave", () => {
    expect(smin(1, 5, 0.1)).toBeCloseTo(1);
    expect(smin(0.5, 0.5, 0.2)).toBeLessThan(0.5);
  });
});

describe("sampleToothField", () => {
  it("mantém a superfície longe das bordas da grade", () => {
    const n = 32;
    const f = sampleToothField(n);
    expect(f.length).toBe(n ** 3);
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++)
        for (const edge of [0, 1, n - 2, n - 1]) {
          expect(f[edge + a * n + b * n * n]).toBeLessThan(0);
          expect(f[a + edge * n + b * n * n]).toBeLessThan(0);
          expect(f[a + b * n + edge * n * n]).toBeLessThan(0);
        }
  });
});
