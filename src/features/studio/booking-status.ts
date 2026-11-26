export const BOOKING_STATUSES = ["new", "contacted", "scheduled", "declined", "spam"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const bookingStatusLabel: Record<BookingStatus, string> = {
  new: "Novo",
  contacted: "Contato feito",
  scheduled: "Agendado",
  declined: "Não agendado",
  spam: "Spam",
};

export const periodLabel: Record<string, string> = {
  any: "Sem preferência",
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite",
};
