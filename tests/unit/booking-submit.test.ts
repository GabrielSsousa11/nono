import { describe, expect, it, vi } from "vitest";
import { PRIVACY_POLICY_VERSION } from "@/features/booking/schema";
import { submitBookingRequest } from "@/features/booking/submit";

const input = {
  fullName: "Maria da Silva",
  phone: "(11) 91234-5678",
  email: "Maria@Exemplo.com",
  preferredPeriod: "any",
  consent: true,
};

const client = (result: { error: null | { message: string; code?: string } }) => ({
  rpc: vi.fn().mockResolvedValue(result),
});

describe("submitBookingRequest", () => {
  it("chama a RPC com os dados normalizados e a versão da política", async () => {
    const c = client({ error: null });
    const r = await submitBookingRequest(input, { client: c as never, locallyAllowed: true });
    expect(r).toEqual({ status: "success" });
    expect(c.rpc).toHaveBeenCalledWith("request_booking", {
      p_full_name: "Maria da Silva",
      p_phone: "(11) 91234-5678",
      p_email: "maria@exemplo.com",
      p_service_interest: null,
      p_preferred_period: "any",
      p_message: null,
      p_consent_version: PRIVACY_POLICY_VERSION,
    });
  });

  it("retorna erros por campo sem chamar o banco", async () => {
    const c = client({ error: null });
    const r = await submitBookingRequest({ ...input, phone: "123" }, { client: c as never, locallyAllowed: true });
    expect(r.status).toBe("invalid");
    expect(r.status === "invalid" && r.fieldErrors.phone).toBeTruthy();
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it("finge sucesso quando o honeypot é preenchido (robôs)", async () => {
    const c = client({ error: null });
    const r = await submitBookingRequest({ ...input, website: "spam" }, { client: c as never, locallyAllowed: true });
    expect(r).toEqual({ status: "success" });
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it("informa indisponibilidade sem backend — nunca simula envio", async () => {
    const r = await submitBookingRequest(input, { client: null, locallyAllowed: true });
    expect(r.status).toBe("unavailable");
  });

  it("respeita o limitador local", async () => {
    const c = client({ error: null });
    const r = await submitBookingRequest(input, { client: c as never, locallyAllowed: false });
    expect(r.status).toBe("rate_limited");
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it("traduz o limite do banco", async () => {
    const r = await submitBookingRequest(input, {
      client: client({ error: { message: "rate_limited" } }) as never,
      locallyAllowed: true,
    });
    expect(r.status).toBe("rate_limited");
  });

  it("não registra dados pessoais em log de falha", async () => {
    const log = vi.fn();
    const r = await submitBookingRequest(input, {
      client: client({ error: { message: "boom", code: "XX000" } }) as never,
      locallyAllowed: true,
      log,
    });
    expect(r.status).toBe("error");
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toMatch(/Maria|91234|exemplo/i);
  });
});
