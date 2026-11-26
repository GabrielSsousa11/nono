import { afterEach, describe, expect, it, vi } from "vitest";
import { devFixtures } from "@/lib/content/dev-fixtures";
import { formatDays, formatHours, telHref, whatsappHref } from "@/lib/content/format";
import { officialContent } from "@/lib/content/official";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("conteúdo oficial", () => {
  it("não contém dados factuais não verificados", () => {
    expect(officialContent.professional.cro).toBeNull();
    expect(officialContent.contact).toEqual({ phone: null, whatsapp: null, email: null, instagram: null });
    expect(officialContent.address).toBeNull();
    expect(officialContent.services).toEqual([]);
    expect(officialContent.spacePhotos).toEqual([]);
  });

  it("fixtures são identificáveis como sintéticas", () => {
    expect(devFixtures.professional.cro).toMatch(/sintético/);
    expect(devFixtures.contact.phone).toMatch(/0000/);
    expect(devFixtures.contact.email).toMatch(/\.invalid$/);
  });
});

describe("getSiteContent", () => {
  it("usa o conteúdo oficial por padrão", async () => {
    vi.stubEnv("CG_CONTENT_SOURCE", "");
    const { getSiteContent } = await import("@/lib/content");
    expect(getSiteContent().synthetic).toBe(false);
  });

  it("marca dados como sintéticos no modo fixtures", async () => {
    vi.stubEnv("CG_CONTENT_SOURCE", "fixtures");
    const { getSiteContent } = await import("@/lib/content");
    expect(getSiteContent().synthetic).toBe(true);
  });

  it("aponta lacunas bloqueantes para publicação", async () => {
    const { findContentGaps } = await import("@/lib/content");
    const blocking = findContentGaps(officialContent)
      .filter((g) => g.blocking)
      .map((g) => g.field);
    expect(blocking).toEqual(expect.arrayContaining(["professional.cro", "contact", "legal.companyName"]));
  });
});

describe("formatação", () => {
  it.each([
    [[1, 2, 3, 4, 5], "segunda a sexta"],
    [[6], "sábado"],
    [[1, 3, 5], "segunda, quarta e sexta"],
    [[2, 1], "segunda e terça"],
  ])("formatDays(%j) = %s", (days, expected) => expect(formatDays(days)).toBe(expected));

  it("formata horário", () => {
    expect(formatHours({ days: [1, 2, 3, 4, 5], opens: "08:00", closes: "18:30" })).toBe(
      "Segunda a sexta, das 08h às 18h30",
    );
  });

  it("gera links de telefone e WhatsApp com DDI", () => {
    expect(telHref("(11) 3456-7890")).toBe("tel:+551134567890");
    expect(whatsappHref("+55 (11) 91234-5678")).toBe("https://wa.me/5511912345678");
  });
});
