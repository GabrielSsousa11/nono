import { Suspense } from "react";
import { LoadingRows } from "@/components/studio/page-header";
import { ActionForm, Input } from "@/components/ui/action-form";
import { NotAllowed, Section } from "@/components/ui/empty";
import { createInvoice } from "@/features/finance/actions";
import { InvoiceList, type InvoiceRow } from "@/features/finance/invoice-list";
import { can } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import { localDate } from "@/lib/datetime";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaff("finance.read");
  if (!ctx) return <NotAllowed />;
  const { data } = await ctx.supabase
    .from("invoices")
    .select("id, patient_id, description, amount_cents, due_date, status, payments(amount_cents, paid_on, method)")
    .eq("patient_id", id)
    .order("due_date", { ascending: false });
  const write = can(ctx.access, "finance.write");
  return (
    <Section title="Cobranças do paciente">
      <InvoiceList invoices={(data ?? []) as unknown as InvoiceRow[]} canWrite={write} />
      {write && (
        <ActionForm
          action={createInvoice}
          hidden={{ patientId: id }}
          submitLabel="Registrar cobrança"
          resetOnSuccess
          className="max-w-2xl"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Descrição" name="description" required className="sm:col-span-3" />
            <Input label="Valor (R$)" name="amount" inputMode="decimal" required />
            <Input label="Vencimento" name="dueDate" type="date" required defaultValue={localDate(new Date())} />
          </div>
        </ActionForm>
      )}
    </Section>
  );
}

export default function PatientFinancePage({ params }: PageProps<"/studio/pacientes/[id]/financeiro">) {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Content params={params} />
    </Suspense>
  );
}
