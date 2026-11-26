import { describe, expect, it } from "vitest";
import { bookingRequestSchema, maskPhone } from "@/features/booking/schema";

const valid = {
  fullName: "Maria da Silva",
  phone: "(11) 91234-5678",
  email: "",
  serviceInterest: "",
  preferredPeriod: "morning" as const,
  message: "",
  consent: true as const,
  website: "",
};

describe("bookingRequestSchema", () => {
  it("aceita um pedido válido e normaliza e-mail vazio", () => {
    const r = bookingRequestSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBeUndefined();
  });

  it.each([
    ["(11) 91234-5678", true],
    ["11912345678", true],
    ["(21) 3456-7890", true],
    ["+55 11 91234-5678", true],
    ["(00) 91234-5678", false],
    ["1234", false],
    ["(11) 81234-56789", false],
  ])("telefone %s → %s", (phone, ok) => {
    expect(bookingRequestSchema.safeParse({ ...valid, phone }).success).toBe(ok);
  });

  it("exige consentimento", () => {
    const r = bookingRequestSchema.safeParse({ ...valid, consent: false });
    expect(r.success).toBe(false);
  });

  it("rejeita nome curto ou com dígitos", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, fullName: "Al" }).success).toBe(false);
    expect(bookingRequestSchema.safeParse({ ...valid, fullName: "Maria 123" }).success).toBe(false);
  });

  it("aceita nomes com acentos e apóstrofo", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, fullName: "João D'Ávila-Conceição" }).success).toBe(true);
  });

  it("limita a mensagem a 600 caracteres", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, message: "a".repeat(601) }).success).toBe(false);
  });
});

describe("maskPhone", () => {
  it.each([
    ["", ""],
    ["1", "(1"],
    ["11", "(11"],
    ["119", "(11) 9"],
    ["1134567890", "(11) 3456-7890"],
    ["11912345678", "(11) 91234-5678"],
    ["119123456789999", "(11) 91234-5678"],
  ])("%s → %s", (input, expected) => expect(maskPhone(input)).toBe(expected));
});
