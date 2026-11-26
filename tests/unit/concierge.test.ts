import { describe, expect, it } from "vitest";
import { answer, normalize, type ConciergeContext } from "@/features/concierge/engine";

const empty: ConciergeContext = { clinicName: "Clínica Teste", authenticated: false, hours: [], address: null, phone: null, whatsapp: null, email: null, services: [], faq: [] };
const full: ConciergeContext = {
  ...empty,
  authenticated: true,
  hours: ["Segunda a sexta, das 08h às 18h"],
  address: "Rua Sintética, 0",
  phone: "(00) 0000-0000",
  services: [{ name: "Clareamento dental", summary: "Tons mais claros." }],
  nextAppointment: { when: "segunda, 10:00", service: "Avaliação", professional: "Dra. Teste" },
  openSlots: [{ service: "Avaliação", when: "terça, 09:00" }],
};

describe("normalize", () => {
  it("remove acentos e pontuação", () => expect(normalize("  Olá, Horário?! ")).toBe("ola horario"));
});

describe("segurança clínica", () => {
  it.each(["Estou com dor no dente, o que tomo?", "Qual antibiótico devo usar?", "minha gengiva está sangrando", "isso é grave?"])("não responde clinicamente: %s", (q) => {
    const r = answer(q, full);
    expect(r.intent).toMatch(/^clinical/);
    expect(r.text).toMatch(/não posso|procure atendimento/i);
  });

  it("orienta urgência para SAMU", () => {
    const r = answer("muita dor e inchaço no rosto", empty);
    expect(r.intent).toBe("clinical_urgent");
    expect(r.actions.some((a) => a.href === "tel:192")).toBe(true);
  });
});

describe("intenções", () => {
  it("não inventa horário quando não publicado", () => {
    const r = answer("Qual o horário de funcionamento?", empty);
    expect(r.text).toMatch(/ainda não foi publicado/);
  });
  it("informa horário verificado", () => expect(answer("vocês abrem sábado?", full).text).toContain("Segunda a sexta"));
  it("consulta próxima consulta só com login", () => {
    expect(answer("quando é minha consulta?", empty).actions[0].href).toBe("/entrar");
    expect(answer("quando é minha próxima consulta?", full).text).toContain("Dra. Teste");
  });
  it("remarcação leva ao portal", () => expect(answer("preciso remarcar", full).actions[0].href).toBe("/portal/agenda"));
  it("disponibilidade lista horários livres", () => expect(answer("tem vaga essa semana?", full).text).toContain("terça, 09:00"));
  it("agendamento anônimo leva ao formulário", () => expect(answer("quero marcar uma avaliação", empty).actions[0].href).toBe("/#agendamento"));
  it("explica serviço cadastrado com ressalva", () => {
    const r = answer("como funciona o clareamento?", full);
    expect(r.intent).toBe("service");
    expect(r.text).toMatch(/avaliação individual/);
  });
  it("encaminha para humano", () => expect(answer("quero falar com um atendente", full).actions[0].handoff).toBe(true));
  it("fallback oferece encaminhamento", () => expect(answer("xyz abc", full).intent).toBe("fallback"));
  it("pagamento sem valores inventados", () => expect(answer("quanto custa?", full).text).not.toMatch(/R\$/));
});
