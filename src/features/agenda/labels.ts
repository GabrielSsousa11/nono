export const appointmentStatusLabel: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  checked_in: "Paciente chegou",
  completed: "Concluída",
  cancelled: "Cancelada",
  no_show: "Falta",
};

export const waitlistStatusLabel: Record<string, string> = {
  waiting: "Aguardando",
  offered: "Vaga oferecida",
  booked: "Agendado",
  expired: "Expirado",
  removed: "Removido",
};

export const periodOptions = [
  { value: "any", label: "Qualquer período" },
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
];
