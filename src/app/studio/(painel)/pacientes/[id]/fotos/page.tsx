import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows } from "@/components/studio/page-header";
import { ActionForm, Checkbox, Input, Select, TextArea } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import { setPhotoVisibility } from "@/features/clinical/actions";
import { EvolutionViewer } from "@/features/clinical/compare-slider";
import { ClinicalUpload } from "@/features/clinical/photo-upload";
import { can } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime, fmtPlainDate } from "@/lib/datetime";
import { signedUrls } from "@/lib/storage";

export const metadata: Metadata = { title: "Fotos e documentos" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaff("clinical.read");
  if (!ctx) return <NotAllowed />;
  const write = can(ctx.access, "clinical.write");
  const [ph, docs, consent] = await Promise.all([
    ctx.supabase.from("clinical_photos").select("id, storage_path, taken_on, view_label, professional_notes, visible_to_patient").eq("patient_id", id).order("taken_on"),
    ctx.supabase.from("documents").select("id, kind, title, storage_path, visible_to_patient, created_at").eq("patient_id", id).order("created_at", { ascending: false }),
    ctx.supabase.from("consents").select("kind").eq("patient_id", id).eq("granted", true).is("revoked_at", null).in("kind", ["clinical_photos", "photo_publicity"]),
  ]);
  const photos = (ph.data ?? []) as { id: string; storage_path: string; taken_on: string; view_label: string | null; professional_notes: string | null; visible_to_patient: boolean }[];
  const documents = (docs.data ?? []) as { id: string; kind: string; title: string; storage_path: string; visible_to_patient: boolean; created_at: string }[];
  const kinds = new Set(((consent.data ?? []) as { kind: string }[]).map((c) => c.kind));
  const [photoUrls, docUrls] = await Promise.all([
    signedUrls(ctx.supabase, "clinical-photos", photos.map((p) => p.storage_path)),
    signedUrls(ctx.supabase, "documents", documents.map((d) => d.storage_path)),
  ]);

  return (
    <div className="flex flex-col gap-14">
      <Section title="CG Evolution — diário fotográfico">
        <div className="flex flex-wrap gap-2">
          {kinds.has("clinical_photos") ? <Badge tone="good">Consentimento para fotos clínicas ativo</Badge> : <Badge tone="bad">Sem consentimento para fotos clínicas</Badge>}
          {kinds.has("photo_publicity") ? <Badge tone="warn">Autorizou uso em divulgação (verificar normas do CFO)</Badge> : <Badge>Sem autorização para divulgação</Badge>}
        </div>
        <EvolutionViewer photos={photos.map((p) => ({ ...p, url: photoUrls[p.storage_path] ?? null }))} />
        {write && photos.length > 0 && (
          <ul className="flex flex-col text-sm">
            {photos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-2">
                <span>{fmtPlainDate(p.taken_on)}{p.view_label && `, ${p.view_label}`} {p.visible_to_patient ? <Badge tone="good">Visível ao paciente</Badge> : <Badge>Oculta</Badge>}</span>
                <ActionForm action={setPhotoVisibility} hidden={{ id: p.id, patientId: id, visible: String(!p.visible_to_patient) }} variant="ghost" submitLabel={p.visible_to_patient ? "Ocultar do paciente" : "Liberar ao paciente"} />
              </li>
            ))}
          </ul>
        )}
        {write && (kinds.has("clinical_photos") ? (
          <ClinicalUpload patientId={id} target="photo">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Data da foto" name="takenOn" type="date" required />
              <Input label="Vista" name="viewLabel" placeholder="Ex.: frontal, sorriso" />
              <TextArea label="Observações da profissional" name="notes" className="sm:col-span-2" />
              <Checkbox label="Visível ao paciente" name="visible" defaultChecked />
            </div>
          </ClinicalUpload>
        ) : <Empty>Registre o consentimento para fotografias clínicas (aba Cadastro) antes de enviar fotos.</Empty>)}
      </Section>

      <Section title="Documentos">
        {documents.length === 0 ? <Empty>Nenhum documento.</Empty> : (
          <ul className="flex flex-col text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-3">
                <span>{d.title} <span className="text-mist">({fmtDateTime(d.created_at)})</span> {d.visible_to_patient && <Badge tone="good">Visível ao paciente</Badge>}</span>
                {docUrls[d.storage_path] && <a href={docUrls[d.storage_path]} target="_blank" rel="noopener noreferrer" className="text-olive underline underline-offset-4">Abrir (link válido por 5 min)</a>}
              </li>
            ))}
          </ul>
        )}
        {write && (
          <ClinicalUpload patientId={id} target="document">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Título" name="title" required />
              <Select label="Tipo" name="kind" options={[{ value: "exam", label: "Exame" }, { value: "report", label: "Relatório" }, { value: "consent_form", label: "Termo de consentimento" }, { value: "guidance", label: "Orientação" }, { value: "other", label: "Outro" }]} />
              <Checkbox label="Visível ao paciente" name="visible" />
            </div>
          </ClinicalUpload>
        )}
      </Section>
    </div>
  );
}

export default function PhotosPage({ params }: PageProps<"/studio/pacientes/[id]/fotos">) {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Content params={params} />
    </Suspense>
  );
}
