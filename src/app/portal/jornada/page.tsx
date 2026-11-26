import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { Empty } from "@/components/ui/empty";
import { JourneyTimeline, type Plan, type Stage } from "@/features/clinical/journey";
import { requirePortal } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Jornada" };

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const pid = portal.current.id;
  const [plans, stages] = await Promise.all([
    portal.supabase
      .from("treatment_plans")
      .select("id, title, goals, status, estimated_end, created_at")
      .eq("patient_id", pid)
      .order("created_at", { ascending: false }),
    portal.supabase
      .from("treatment_stages")
      .select("id, plan_id, position, title, description, guidance, status, estimated_date, completed_at")
      .eq("patient_id", pid)
      .order("position"),
  ]);
  const all = (stages.data ?? []) as (Stage & { plan_id: string })[];
  const list: Plan[] = ((plans.data ?? []) as Omit<Plan, "stages">[]).map((p) => ({
    ...p,
    stages: all.filter((s) => s.plan_id === p.id),
  }));
  if (list.length === 0)
    return (
      <Empty>Quando a dentista registrar seu plano de tratamento, ele aparece aqui com cada etapa e orientação.</Empty>
    );
  return (
    <div className="flex flex-col gap-16">
      {list.map((p) => (
        <JourneyTimeline key={p.id} plan={p} />
      ))}
    </div>
  );
}

export default function JourneyPage() {
  return (
    <>
      <PortalHeading
        title="CG Journey"
        intro="Sua linha do tempo de tratamento: etapas concluídas, próximas etapas e orientações da dentista."
      />
      <Suspense fallback={<PortalLoading />}>
        <Content />
      </Suspense>
    </>
  );
}
