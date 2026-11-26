"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { PORTAL_CONSENT_VERSION, SELF_SERVICE_CONSENTS } from "./consents";

const schema = z.object({
  patientId: z.uuid(),
  kind: z.enum(SELF_SERVICE_CONSENTS),
  granted: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export type ConsentActionState =
  { status: "idle" } | { status: "saved"; granted: boolean } | { status: "error"; message: string };

export async function setConsent(_prev: ConsentActionState, formData: FormData): Promise<ConsentActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const { supabase, user } = await getSessionContext();
  if (!supabase || !user) return { status: "error", message: "Sua sessão expirou. Entre novamente." };
  const { error } = await supabase.rpc("set_my_consent", {
    p_patient: parsed.data.patientId,
    p_kind: parsed.data.kind,
    p_granted: parsed.data.granted,
    p_version: PORTAL_CONSENT_VERSION,
  });
  if (error) return { status: "error", message: "Não foi possível registrar sua escolha. Tente novamente." };
  revalidatePath("/portal/privacidade");
  return { status: "saved", granted: parsed.data.granted };
}
