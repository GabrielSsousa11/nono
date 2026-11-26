export interface SettingSpec {
  key: string;
  label: string;
  type: "number" | "boolean";
  min?: number;
  max?: number;
  hint?: string;
}

export const SETTINGS_SPEC: SettingSpec[] = [
  {
    key: "agenda.slot_step_minutes",
    label: "Intervalo entre horários oferecidos (min)",
    type: "number",
    min: 5,
    max: 120,
  },
  {
    key: "agenda.min_notice_hours",
    label: "Antecedência mínima para agendar pelo portal (h)",
    type: "number",
    min: 0,
    max: 168,
  },
  {
    key: "agenda.cancel_notice_hours",
    label: "Antecedência mínima para cancelar/remarcar pelo portal (h)",
    type: "number",
    min: 0,
    max: 168,
  },
  { key: "agenda.max_days_ahead", label: "Dias à frente visíveis no portal", type: "number", min: 1, max: 365 },
  { key: "waitlist.auto_offer", label: "Oferecer vagas canceladas automaticamente à lista de espera", type: "boolean" },
  { key: "waitlist.offer_hours", label: "Validade da oferta de vaga (h)", type: "number", min: 1, max: 72 },
  { key: "waitlist.max_offers", label: "Pessoas que recebem a mesma oferta", type: "number", min: 1, max: 10 },
];
