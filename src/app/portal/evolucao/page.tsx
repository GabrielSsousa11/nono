import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { Empty } from "@/components/ui/empty";
import { EvolutionViewer } from "@/features/clinical/compare-slider";
import { requirePortal } from "@/lib/auth/guards";
import { signedUrls } from "@/lib/storage";

export const metadata: Metadata = { title: "Evolução" };

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const { data } = await portal.supabase
    .from("clinical_photos")
    .select("id, storage_path, taken_on, view_label, professional_notes")
    .eq("patient_id", portal.current.id)
    .order("taken_on");
  const photos = (data ?? []) as {
    id: string;
    storage_path: string;
    taken_on: string;
    view_label: string | null;
    professional_notes: string | null;
  }[];
  if (photos.length === 0)
    return (
      <Empty>
        Quando houver fotografias do seu tratamento liberadas pela dentista, elas aparecem aqui. As fotos são privadas e
        exigem sua autorização.
      </Empty>
    );
  const urls = await signedUrls(
    portal.supabase,
    "clinical-photos",
    photos.map((p) => p.storage_path),
  );
  return <EvolutionViewer photos={photos.map((p) => ({ ...p, url: urls[p.storage_path] ?? null }))} />;
}

export default function EvolutionPage() {
  return (
    <>
      <PortalHeading
        title="CG Evolution"
        intro="Seu diário fotográfico privado. Compare o antes e o depois deslizando o controle."
      />
      <Suspense fallback={<PortalLoading />}>
        <Content />
      </Suspense>
    </>
  );
}
