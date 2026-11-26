import { describe, expect, it } from "vitest";
import { currentConsents } from "@/features/portal/consents";
import { inviteStaffSchema, roleChangeSchema, teamErrorMessage } from "@/features/studio/team-schema";

describe("inviteStaffSchema", () => {
  it("aceita convite válido e normaliza e-mail", () => {
    const r = inviteStaffSchema.parse({ email: "Ana@Clinica.com", fullName: " Ana Lima ", role: "receptionist" });
    expect(r).toEqual({ email: "ana@clinica.com", fullName: "Ana Lima", role: "receptionist" });
  });

  it.each(["patient", "guardian", "root", ""])("rejeita função %s", (role) => {
    expect(inviteStaffSchema.safeParse({ email: "a@b.com", fullName: "Ana Lima", role }).success).toBe(false);
  });
});

describe("roleChangeSchema", () => {
  it("converte grant em booleano", () => {
    const r = roleChangeSchema.parse({
      userId: "00000000-0000-4000-8000-000000000001",
      role: "dentist",
      grant: "false",
    });
    expect(r.grant).toBe(false);
  });
});

describe("teamErrorMessage", () => {
  it.each([
    [{ message: "não é possível remover o próprio papel de administrador" }, /seu próprio acesso/],
    [{ message: "a clínica precisa de ao menos um administrador" }, /ao menos um administrador/],
    [{ message: "permissão negada", code: "42501" }, /não tem permissão/],
    [{ message: "algo inesperado" }, /Tente novamente/],
    [null, /Tente novamente/],
  ])("%j", (err, expected) => expect(teamErrorMessage(err)).toMatch(expected));
});

describe("currentConsents", () => {
  it("considera apenas consentimentos concedidos e não revogados", () => {
    const s = currentConsents([
      {
        kind: "communications_email",
        granted: true,
        revoked_at: "2026-11-01T00:00:00Z",
        recorded_at: "2026-10-01T00:00:00Z",
      },
      { kind: "communications_email", granted: true, revoked_at: null, recorded_at: "2026-11-02T00:00:00Z" },
      { kind: "birthday_messages", granted: false, revoked_at: null, recorded_at: "2026-11-02T00:00:00Z" },
      { kind: "treatment", granted: true, revoked_at: null, recorded_at: "2026-11-02T00:00:00Z" },
    ]);
    expect(s.communications_email).toEqual({ active: true, since: "2026-11-02T00:00:00Z" });
    expect(s.birthday_messages.active).toBe(false);
    expect(s.clinical_photos.active).toBe(false);
    expect("treatment" in s).toBe(false);
  });
});
