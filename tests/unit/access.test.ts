import { describe, expect, it } from "vitest";
import { can, gatePath, homeFor, isStaffRole, parseAccess, resolveStudioGate } from "@/lib/auth/access";

describe("resolveStudioGate", () => {
  const base = { authenticated: true, isStaff: true, currentAal: "aal1", hasVerifiedFactor: false };

  it.each([
    [{ ...base, authenticated: false }, "login"],
    [{ ...base, isStaff: false }, "forbidden"],
    [{ ...base, isStaff: false, currentAal: "aal2" }, "forbidden"],
    [base, "enroll_mfa"],
    [{ ...base, hasVerifiedFactor: true }, "verify_mfa"],
    [{ ...base, currentAal: "aal2", hasVerifiedFactor: true }, "ok"],
    [{ ...base, currentAal: null }, "enroll_mfa"],
  ] as const)("%j → %s", (input, expected) => {
    expect(resolveStudioGate(input)).toBe(expected);
  });

  it("todo portão não-ok tem destino", () => {
    expect(gatePath).toEqual({
      login: "/entrar",
      forbidden: "/portal",
      enroll_mfa: "/studio/mfa/configurar",
      verify_mfa: "/studio/mfa/verificar",
    });
  });
});

describe("parseAccess", () => {
  it("normaliza a resposta da RPC my_access", () => {
    const a = parseAccess({
      roles: ["admin", "hacker"],
      permissions: ["users.manage", "DROP TABLE", 3],
      is_staff: true,
      mfa_verified: true,
    });
    expect(a).toEqual({ roles: ["admin"], permissions: ["users.manage"], is_staff: true, mfa_verified: true });
  });

  it.each([null, undefined, "x", 42])("entrada inválida (%j) vira acesso vazio", (raw) => {
    expect(parseAccess(raw)).toEqual({ roles: [], permissions: [], is_staff: false, mfa_verified: false });
  });

  it("is_staff só é verdadeiro com booleano true", () => {
    expect(parseAccess({ is_staff: "true" }).is_staff).toBe(false);
  });
});

describe("utilitários", () => {
  it("can verifica permissão", () => {
    const a = parseAccess({ permissions: ["patients.read"] });
    expect(can(a, "patients.read")).toBe(true);
    expect(can(a, "clinical.read")).toBe(false);
  });

  it("homeFor envia equipe ao Studio e demais ao portal", () => {
    expect(homeFor(parseAccess({ is_staff: true }))).toBe("/studio");
    expect(homeFor(parseAccess({ roles: ["patient"] }))).toBe("/portal");
  });

  it("isStaffRole", () => {
    expect(isStaffRole("finance")).toBe(true);
    expect(isStaffRole("guardian")).toBe(false);
  });
});
