import Link from "next/link";
import { ActionForm, Input, Select } from "@/components/ui/action-form";
import { Badge, Empty } from "@/components/ui/empty";
import { fmtMoney, fmtPlainDate, localDate } from "@/lib/datetime";
import { cancelInvoice, recordPayment } from "./actions";
import { invoiceStatusLabel, methodOptions } from "./labels";

export interface InvoiceRow {
  id: string;
  patient_id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: string;
  payments: { amount_cents: number; paid_on: string; method: string }[];
  patients?: { full_name: string; social_name: string | null } | null;
}

export function InvoiceList({
  invoices,
  canWrite,
  showPatient = false,
}: {
  invoices: InvoiceRow[];
  canWrite: boolean;
  showPatient?: boolean;
}) {
  if (invoices.length === 0) return <Empty>Nenhuma cobrança.</Empty>;
  const today = localDate(new Date());
  return (
    <ul className="flex flex-col">
      {invoices.map((i) => {
        const paid = i.payments.reduce((s, p) => s + p.amount_cents, 0);
        const overdue = (i.status === "open" || i.status === "partially_paid") && i.due_date < today;
        return (
          <li key={i.id} className="flex flex-col gap-3 border-b border-onyx/10 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {showPatient && i.patients && (
                  <Link href={`/studio/pacientes/${i.patient_id}`} className="font-semibold hover:underline">
                    {i.patients.social_name || i.patients.full_name}:{" "}
                  </Link>
                )}
                {i.description}
                <span className="block text-sm text-mist">
                  Vence {fmtPlainDate(i.due_date)}, pago {fmtMoney(paid)} de {fmtMoney(i.amount_cents)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <strong>{fmtMoney(i.amount_cents - paid)}</strong>
                <Badge
                  tone={i.status === "paid" ? "good" : overdue ? "bad" : i.status === "cancelled" ? "neutral" : "warn"}
                >
                  {overdue ? "Vencida" : invoiceStatusLabel[i.status]}
                </Badge>
              </span>
            </div>
            {canWrite && (i.status === "open" || i.status === "partially_paid") && (
              <div className="flex flex-wrap gap-6">
                <details>
                  <summary className="cursor-pointer text-sm text-olive">Registrar pagamento</summary>
                  <ActionForm
                    action={recordPayment}
                    hidden={{ invoiceId: i.id }}
                    submitLabel="Registrar"
                    className="mt-3 max-w-xl"
                  >
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Input
                        label="Valor (R$)"
                        name="amount"
                        inputMode="decimal"
                        required
                        defaultValue={((i.amount_cents - paid) / 100).toFixed(2).replace(".", ",")}
                      />
                      <Input label="Data" name="paidOn" type="date" required defaultValue={today} />
                      <Select label="Forma" name="method" options={methodOptions} />
                    </div>
                  </ActionForm>
                </details>
                {i.status === "open" && (
                  <ActionForm
                    action={cancelInvoice}
                    hidden={{ id: i.id }}
                    variant="ghost"
                    submitLabel="Cancelar cobrança"
                    confirm="Cancelar esta cobrança?"
                  />
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
