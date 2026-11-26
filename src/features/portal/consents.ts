/** Consentimentos que a própria pessoa (ou responsável) pode conceder/revogar no portal. */
export const SELF_SERVICE_CONSENTS = [
  "privacy_policy",
  "communications_email",
  "communications_whatsapp",
  "birthday_messages",
  "clinical_photos",
] as const;
export type SelfServiceConsent = (typeof SELF_SERVICE_CONSENTS)[number];

/** Versão do texto dos consentimentos exibidos no portal. Mude quando o texto mudar. */
export const PORTAL_CONSENT_VERSION = "portal-2026-11";

export const consentText: Record<SelfServiceConsent, { title: string; description: string }> = {
  privacy_policy: {
    title: "Ciência da política de privacidade",
    description: "Li a política de privacidade e entendi como meus dados são tratados pela clínica.",
  },
  communications_email: {
    title: "Lembretes e orientações por e-mail",
    description: "Consultas, retornos e orientações de cuidado enviados ao e-mail cadastrado.",
  },
  communications_whatsapp: {
    title: "Contato por WhatsApp",
    description: "Lembretes e orientações pelo WhatsApp cadastrado, quando o canal for ativado pela clínica.",
  },
  birthday_messages: {
    title: "Mensagem de aniversário",
    description: "Uma mensagem da clínica no dia do aniversário.",
  },
  clinical_photos: {
    title: "Fotografias clínicas do tratamento",
    description:
      "Registro fotográfico para acompanhamento clínico, visível apenas para mim, meus responsáveis e a equipe clínica. Nunca usado em divulgação.",
  },
};

export interface ConsentRow {
  kind: string;
  granted: boolean;
  revoked_at: string | null;
  recorded_at: string;
}

/** Estado atual (ativo/inativo) de cada consentimento a partir do histórico. */
export function currentConsents(
  rows: ConsentRow[],
): Record<SelfServiceConsent, { active: boolean; since: string | null }> {
  const result = Object.fromEntries(SELF_SERVICE_CONSENTS.map((k) => [k, { active: false, since: null }])) as Record<
    SelfServiceConsent,
    { active: boolean; since: string | null }
  >;
  for (const row of rows) {
    if (!(SELF_SERVICE_CONSENTS as readonly string[]).includes(row.kind)) continue;
    if (row.granted && row.revoked_at === null)
      result[row.kind as SelfServiceConsent] = { active: true, since: row.recorded_at };
  }
  return result;
}
