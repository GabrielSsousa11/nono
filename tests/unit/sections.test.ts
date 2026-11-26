import { describe, expect, it } from "vitest";
import { officialContent } from "@/lib/content/official";
import { mergeSections } from "@/lib/content/sections";

describe("mergeSections", () => {
  it("aplica seções válidas", () => {
    const c = mergeSections(officialContent, {
      contact: { phone: "(00) 0000-0000", whatsapp: null, email: "", instagram: null },
      hours: [{ days: [1, 2, 3], opens: "08:00", closes: "12:00" }],
    });
    expect(c.contact.phone).toBe("(00) 0000-0000");
    expect(c.contact.email).toBeNull();
    expect(c.hours).toHaveLength(1);
  });

  it("ignora seções malformadas (não quebra o site)", () => {
    const c = mergeSections(officialContent, { hours: [{ days: [9], opens: "x" }], address: { street: "" } });
    expect(c.hours).toEqual([]);
    expect(c.address).toBeNull();
  });

  it("não altera o conteúdo base", () => {
    mergeSections(officialContent, { legal: { companyName: "Razão X", cnpj: null, dpoContact: null } });
    expect(officialContent.legal.companyName).toBeNull();
  });

  it("rejeita mapa sem https", () => {
    const c = mergeSections(officialContent, {
      address: {
        street: "Rua A, 1",
        district: "Centro",
        city: "Cidade",
        state: "UF",
        postalCode: "00000-000",
        mapsUrl: "javascript:alert(1)",
      },
    });
    expect(c.address).toBeNull();
  });
});
