import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { InvoiceList, type InvoiceRow } from "@/features/finance/invoice-list";
import { requirePortal } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Financeiro" };

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const { data } = await portal.supabase
    .from("invoices")
    .select("id, patient_id, description, amount_cents, due_date, status, payments(amount_cents, paid_on, method)")
    .eq("patient_id", portal.current.id)
    .neq("status", "cancelled")
    .order("due_date", { ascending: false });
  return <InvoiceList invoices={(data ?? []) as unknown as InvoiceRow[]} canWrite={false} />;
}

export default function PortalFinancePage() {
  return (
    <>
      <PortalHeading
        title="Financeiro"
        intro="Cobranças e pagamentos registrados pela clínica. Dúvidas? Use Mensagens."
      />
      <Suspense fallback={<PortalLoading />}>
        <Content />
      </Suspense>
    </>
  );
}
