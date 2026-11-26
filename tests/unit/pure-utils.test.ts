import { describe, expect, it } from "vitest";
import { isMinor } from "@/features/studio/patient-schema";
import { isValidFdi, toothFamily, toothName, toothSummary, type ToothRecord } from "@/features/clinical/teeth";
import { isValidCpf, maskCpf } from "@/lib/cpf";
import { addDays, daysInMonth, fmtMoney, isIsoDate, localDate, parseMoney, startOfMonth, startOfWeek, tzOffsetMinutes, weekday, zonedToUtc } from "@/lib/datetime";
import { progressOf } from "@/features/clinical/journey";

describe("CPF", () => {
  it.each([["529.982.247-25", true], ["52998224725", true], ["111.111.111-11", false], ["529.982.247-24", false], ["123", false]])("%s → %s", (v, ok) => expect(isValidCpf(v)).toBe(ok));
  it("máscara", () => expect(maskCpf("52998224725")).toBe("529.982.247-25"));
});

describe("datas no fuso da clínica", () => {
  it("São Paulo é UTC-3", () => expect(tzOffsetMinutes(new Date("2026-12-07T12:00:00Z"))).toBe(-180));
  it("converte hora local para UTC", () => expect(zonedToUtc("2026-12-07", "09:30").toISOString()).toBe("2026-12-07T12:30:00.000Z"));
  it("23h30 local ainda é o mesmo dia local", () => expect(localDate(new Date("2026-12-08T02:30:00Z"))).toBe("2026-12-07"));
  it("addDays atravessa mês e ano", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("dia da semana e início de semana/mês", () => {
    expect(weekday("2026-12-07")).toBe(1);
    expect(startOfWeek("2026-12-09")).toBe("2026-12-06");
    expect(startOfMonth("2026-12-09")).toBe("2026-12-01");
    expect(daysInMonth("2028-02-10")).toBe(29);
  });
  it("valida data ISO", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-12-07")).toBe(true);
    expect(isIsoDate("07/12/2026")).toBe(false);
  });
});

describe("dinheiro", () => {
  it.each([["150", 15000], ["150,5", 15050], ["1.250,00", 125000], ["R$ 99,99", 9999]])("parseMoney(%s)", (v, c) => expect(parseMoney(v)).toBe(c));
  it.each(["", "abc", "1,234", "-5"])("rejeita %j", (v) => expect(parseMoney(v)).toBeNull());
  it("formata em reais", () => expect(fmtMoney(123450).replace(/\s/g, " ")).toBe("R$ 1.234,50"));
});

describe("dentes FDI", () => {
  it.each([[11, true], [48, true], [55, true], [85, true], [19, false], [56, false], [9, false], [90, false]])("%i → %s", (n, ok) => expect(isValidFdi(n)).toBe(ok));
  it("nomes e famílias", () => {
    expect(toothName(36)).toBe("Primeiro molar inferior esquerdo");
    expect(toothFamily(13)).toBe(1);
    expect(toothFamily(55)).toBe(3);
  });
  it("resumo ignora substituídos e prioriza planejado", () => {
    const r = (id: number, fdi: number, state: ToothRecord["state"], superseded: string | null = null): ToothRecord => ({ id: String(id), tooth_fdi: fdi, state, procedure: "x", surfaces: [], notes: null, performed_on: null, recorded_at: "2026-01-01", superseded_at: superseded });
    const m = toothSummary([r(1, 16, "completed"), r(2, 16, "planned"), r(3, 26, "planned", "2026-02-01")]);
    expect(m.get(16)).toBe("planned");
    expect(m.has(26)).toBe(false);
  });
});

describe("menor de idade e progresso", () => {
  it("calcula 18 anos pelo aniversário", () => {
    const today = new Date(2026, 5, 15);
    expect(isMinor("2008-06-16", today)).toBe(true);
    expect(isMinor("2008-06-15", today)).toBe(false);
    expect(isMinor(null, today)).toBe(false);
  });
  it("progresso ignora etapas puladas", () => {
    const s = (status: string) => ({ id: status, position: 1, title: "t", description: null, guidance: null, status, estimated_date: null, completed_at: null });
    expect(progressOf([s("completed"), s("pending"), s("skipped"), s("pending")])).toEqual({ done: 1, total: 3, percent: 33 });
    expect(progressOf([])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});
