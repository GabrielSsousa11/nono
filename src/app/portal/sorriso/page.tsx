import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { Empty } from "@/components/ui/empty";
import { OdontogramPanel } from "@/features/clinical/odontogram-panel";
import type { ToothRecord } from "@/features/clinical/teeth";
import { requirePortal } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Sorriso 3D" };

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const pid = portal.current.id;
  const [teeth, chart] = await Promise.all([
    portal.supabase.from("tooth_records").select("id, tooth_fdi, state, procedure, surfaces, notes, performed_on, recorded_at, superseded_at").eq("patient_id", pid),
    portal.supabase.from("dental_charts").select("dentition").eq("patient_id", pid).maybeSingle(),
  ]);
  const records = (teeth.data ?? []) as ToothRecord[];
  return (
    <div className="flex flex-col gap-6">
      {records.length === 0 && <Empty>Nenhum procedimento liberado para visualização ainda. A representação abaixo é esquemática.</Empty>}
      <OdontogramPanel records={records} dentition={(chart.data as { dentition: string } | null)?.dentition ?? "permanent"} />
    </div>
  );
}

export default function SmilePage() {
  return (
    <>
      <PortalHeading title="CG Smile 3D" intro="Procedimentos realizados e planejados em cada dente, conforme liberado pela sua dentista." />
      <Suspense fallback={<PortalLoading />}><Content /></Suspense>
    </>
  );
}
