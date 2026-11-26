export const invoiceStatusLabel: Record<string, string> = {
  open: "Em aberto",
  partially_paid: "Parcialmente paga",
  paid: "Paga",
  cancelled: "Cancelada",
};
export const methodOptions = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "debit", label: "Débito" },
  { value: "credit", label: "Crédito" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];
