import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bookingRequestSchema,
  PRIVACY_POLICY_VERSION,
  type BookingActionState,
  type BookingRequestInput,
} from "./schema";

export interface SubmitDeps {
  client: Pick<SupabaseClient, "rpc"> | null;
  /** Resultado do limitador local (melhor esforço). */
  locallyAllowed: boolean;
  log?: (event: string, detail: Record<string, unknown>) => void;
}

const UNAVAILABLE = "O pedido de agendamento online ainda não está ativo. Use os canais de contato da clínica.";

/**
 * Regra de negócio do pedido de agendamento, isolada do Next.js para teste.
 * Nunca registra em log nome, telefone, e-mail ou mensagem (dados pessoais).
 */
export async function submitBookingRequest(raw: unknown, deps: SubmitDeps): Promise<BookingActionState> {
  const parsed = bookingRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof BookingRequestInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof BookingRequestInput | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    // Honeypot preenchido: responder como sucesso para não ensinar o robô.
    if (fieldErrors.website) return { status: "success" };
    return { status: "invalid", fieldErrors };
  }

  if (!deps.locallyAllowed) {
    return {
      status: "rate_limited",
      message: "Recebemos muitos envios a partir desta conexão. Aguarde alguns minutos e tente novamente.",
    };
  }

  if (!deps.client) return { status: "unavailable", message: UNAVAILABLE };

  const data = parsed.data;
  const { error } = await deps.client.rpc("request_booking", {
    p_full_name: data.fullName,
    p_phone: data.phone,
    p_email: data.email ?? null,
    p_service_interest: data.serviceInterest || null,
    p_preferred_period: data.preferredPeriod,
    p_message: data.message || null,
    p_consent_version: PRIVACY_POLICY_VERSION,
  });

  if (!error) return { status: "success" };

  if (error.message?.includes("rate_limited")) {
    return {
      status: "rate_limited",
      message: "Já recebemos pedidos recentes com este telefone. A equipe entrará em contato; não é preciso reenviar.",
    };
  }

  deps.log?.("booking_request.failed", { code: error.code ?? "unknown" });
  return {
    status: "error",
    message: "Não foi possível registrar seu pedido agora. Tente novamente em instantes.",
  };
}
