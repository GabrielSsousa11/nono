import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, Input } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import { PatientPicker } from "@/features/agenda/patient-picker";
import { createExpense, createInvoice, payExpense } from "@/features/finance/actions";
import { InvoiceList, type InvoiceRow } from "@/features/finance/invoice-list";
import { can } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import { fmtMoney, fmtPlainDate, localDate } from "@/lib/datetime";

export const metadata: Metadata = { title: "Financeiro" };

async function Content() {
  const ctx = await requireStaff("finance.read");
  if (!ctx) return <NotAllowed />;
  const write = can(ctx.access, "finance.write");
  const today = localDate(new Date());
  const [inv, exp] = await Promise.all([
    ctx.supabase
      .from("invoices")
      .select(
        "id, patient_id, description, amount_cents, due_date, status, payments(amount_cents, paid_on, method), patients(full_name, social_name)",
      )
      .in("status", ["open", "partially_paid"])
      .order("due_date"),
    ctx.supabase
      .from("expenses")
      .select("id, description, category, amount_cents, due_date, paid_on")
      .order("due_date", { ascending: false })
      .limit(40),
  ]);
  const invoices = (inv.data ?? []) as unknown as InvoiceRow[];
  const expenses = (exp.data ?? []) as {
    id: string;
    description: string;
    category: string;
    amount_cents: number;
    due_date: string;
    paid_on: string | null;
  }[];
  const pending = invoices.reduce((s, i) => s + i.amount_cents - i.payments.reduce((a, p) => a + p.amount_cents, 0), 0);
  const overdue = invoices
    .filter((i) => i.due_date < today)
    .reduce((s, i) => s + i.amount_cents - i.payments.reduce((a, p) => a + p.amount_cents, 0), 0);
  const expensesOpen = expenses.filter((e) => !e.paid_on).reduce((s, e) => s + e.amount_cents, 0);

  return (
    <div className="flex flex-col gap-12">
      <dl className="grid gap-6 sm:grid-cols-3">
        <div className="border-t border-gold/60 pt-4">
          <dt className="text-sm text-mist">A receber</dt>
          <dd className="font-display text-4xl">{fmtMoney(pending)}</dd>
        </div>
        <div className="border-t border-gold/60 pt-4">
          <dt className="text-sm text-mist">Vencido</dt>
          <dd className="font-display text-4xl">{fmtMoney(overdue)}</dd>
        </div>
        <div className="border-t border-gold/60 pt-4">
          <dt className="text-sm text-mist">Despesas a pagar</dt>
          <dd className="font-display text-4xl">{fmtMoney(expensesOpen)}</dd>
        </div>
      </dl>
      <Section title="Cobranças em aberto">
        <InvoiceList invoices={invoices} canWrite={write} showPatient />
        {write && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-olive">Nova cobrança</summary>
            <ActionForm
              action={createInvoice}
              submitLabel="Registrar cobrança"
              resetOnSuccess
              className="mt-4 max-w-2xl"
            >
              <PatientPicker />
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Descrição" name="description" required className="sm:col-span-3" />
                <Input label="Valor (R$)" name="amount" inputMode="decimal" required />
                <Input label="Vencimento" name="dueDate" type="date" required defaultValue={today} />
              </div>
            </ActionForm>
          </details>
        )}
      </Section>
      <Section title="Despesas">
        {expenses.length === 0 ? (
          <Empty>Nenhuma despesa registrada.</Empty>
        ) : (
          <ul className="flex flex-col text-sm">
            {expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-3">
                <span>
                  {e.description}{" "}
                  <span className="text-mist">
                    ({e.category}), vence {fmtPlainDate(e.due_date)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <strong>{fmtMoney(e.amount_cents)}</strong>
                  {e.paid_on ? (
                    <Badge tone="good">Paga em {fmtPlainDate(e.paid_on)}</Badge>
                  ) : write ? (
                    <ActionForm
                      action={payExpense}
                      hidden={{ id: e.id, paidOn: today }}
                      variant="ghost"
                      submitLabel="Marcar como paga hoje"
                    />
                  ) : (
                    <Badge tone="warn">A pagar</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {write && (
          <ActionForm action={createExpense} submitLabel="Registrar despesa" resetOnSuccess className="max-w-3xl">
            <div className="grid gap-4 sm:grid-cols-4">
              <Input label="Descrição" name="description" required className="sm:col-span-2" />
              <Input label="Categoria" name="category" required placeholder="Ex.: materiais" />
              <Input label="Valor (R$)" name="amount" inputMode="decimal" required />
              <Input label="Vencimento" name="dueDate" type="date" required defaultValue={today} />
              <Input label="Paga em" name="paidOn" type="date" />
            </div>
          </ActionForm>
        )}
      </Section>
    </div>
  );
}

export default function FinancePage() {
  return (
    <>
      <StudioPageHeader
        title="Financeiro"
        intro="Cobranças, pagamentos e despesas. O setor financeiro não acessa informações clínicas."
      />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}
