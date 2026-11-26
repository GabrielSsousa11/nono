import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows } from "@/components/studio/page-header";
import { ActionForm, Checkbox, Input, Select, TextArea } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import {
  addClinicalRecord,
  addStage,
  createPlan,
  ensureDentalChart,
  updatePlan,
  updateStage,
} from "@/features/clinical/actions";
import { JourneyTimeline, stageLabel, type Plan, type Stage } from "@/features/clinical/journey";
import { OdontogramPanel } from "@/features/clinical/odontogram-panel";
import type { ToothRecord } from "@/features/clinical/teeth";
import { can } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Prontuário" };

const KIND: Record<string, string> = { anamnesis: "Anamnese", evolution: "Evolução", exam: "Exame", note: "Anotação" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaff("clinical.read");
  if (!ctx) return <NotAllowed />;
  const write = can(ctx.access, "clinical.write");
  const [rec, teeth, chart, plans, stages] = await Promise.all([
    ctx.supabase
      .from("clinical_records")
      .select("id, kind, content, visible_to_patient, recorded_at, profiles:recorded_by(full_name)")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false }),
    ctx.supabase
      .from("tooth_records")
      .select(
        "id, tooth_fdi, state, procedure, surfaces, notes, performed_on, recorded_at, superseded_at, visible_to_patient",
      )
      .eq("patient_id", id),
    ctx.supabase.from("dental_charts").select("dentition").eq("patient_id", id).maybeSingle(),
    ctx.supabase
      .from("treatment_plans")
      .select("id, title, goals, status, estimated_end, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    ctx.supabase
      .from("treatment_stages")
      .select("id, plan_id, position, title, description, guidance, status, estimated_date, completed_at")
      .eq("patient_id", id)
      .order("position"),
  ]);
  const records = (rec.data ?? []) as unknown as {
    id: string;
    kind: string;
    content: string;
    visible_to_patient: boolean;
    recorded_at: string;
    profiles: { full_name: string } | null;
  }[];
  const dentition = (chart.data as { dentition: string } | null)?.dentition ?? "permanent";
  const allStages = (stages.data ?? []) as (Stage & { plan_id: string })[];
  const planList: Plan[] = ((plans.data ?? []) as Omit<Plan, "stages">[]).map((p) => ({
    ...p,
    stages: allStages.filter((s) => s.plan_id === p.id),
  }));

  return (
    <div className="flex flex-col gap-14">
      <Section title="CG Smile 3D — odontograma">
        {write && (
          <ActionForm
            action={ensureDentalChart}
            hidden={{ patientId: id }}
            submitLabel="Atualizar dentição"
            variant="outline"
            className="max-w-md"
          >
            <Select
              label="Dentição"
              name="dentition"
              defaultValue={dentition}
              options={[
                { value: "permanent", label: "Permanente" },
                { value: "mixed", label: "Mista" },
                { value: "deciduous", label: "Decídua" },
              ]}
            />
          </ActionForm>
        )}
        <OdontogramPanel
          records={(teeth.data ?? []) as ToothRecord[]}
          patientId={id}
          editable={write}
          dentition={dentition}
        />
      </Section>

      <Section title="CG Journey — planos de tratamento">
        {planList.length === 0 && <Empty>Nenhum plano de tratamento.</Empty>}
        {planList.map((plan) => (
          <div key={plan.id} className="flex flex-col gap-6 border-b border-onyx/10 pb-10">
            <JourneyTimeline
              plan={plan}
              renderStageExtra={
                write
                  ? (s) => (
                      <details>
                        <summary className="cursor-pointer text-sm text-olive">Atualizar etapa</summary>
                        <ActionForm
                          action={updateStage}
                          hidden={{ id: s.id, patientId: id }}
                          submitLabel="Salvar etapa"
                          className="mt-3 max-w-xl"
                        >
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Select
                              label="Situação"
                              name="status"
                              defaultValue={s.status}
                              options={Object.entries(stageLabel).map(([value, label]) => ({ value, label }))}
                            />
                            <Input
                              label="Data prevista"
                              name="estimatedDate"
                              type="date"
                              defaultValue={s.estimated_date ?? ""}
                            />
                            <TextArea
                              label="Orientações ao paciente"
                              name="guidance"
                              defaultValue={s.guidance ?? ""}
                              className="sm:col-span-2"
                            />
                          </div>
                        </ActionForm>
                      </details>
                    )
                  : undefined
              }
            />
            {write && (
              <div className="flex flex-wrap gap-8">
                <ActionForm
                  action={updatePlan}
                  hidden={{ id: plan.id, patientId: id }}
                  submitLabel="Salvar plano"
                  variant="outline"
                  className="max-w-md"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label="Situação do plano"
                      name="status"
                      defaultValue={plan.status}
                      options={[
                        { value: "draft", label: "Rascunho (oculto ao paciente)" },
                        { value: "active", label: "Em andamento" },
                        { value: "completed", label: "Concluído" },
                        { value: "cancelled", label: "Cancelado" },
                      ]}
                    />
                    <Input
                      label="Previsão de término"
                      name="estimatedEnd"
                      type="date"
                      defaultValue={plan.estimated_end ?? ""}
                    />
                  </div>
                </ActionForm>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-olive">Adicionar etapa</summary>
                  <ActionForm
                    action={addStage}
                    hidden={{ planId: plan.id, patientId: id }}
                    submitLabel="Adicionar etapa"
                    resetOnSuccess
                    className="mt-4 max-w-xl"
                  >
                    <Input label="Título" name="title" required />
                    <TextArea label="Descrição" name="description" />
                    <TextArea label="Orientações ao paciente" name="guidance" />
                    <Input label="Data prevista" name="estimatedDate" type="date" />
                  </ActionForm>
                </details>
              </div>
            )}
          </div>
        ))}
        {write && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-olive">Criar plano de tratamento</summary>
            <ActionForm
              action={createPlan}
              hidden={{ patientId: id }}
              submitLabel="Criar plano"
              resetOnSuccess
              className="mt-4 max-w-xl"
            >
              <Input label="Título" name="title" required />
              <TextArea label="Objetivos" name="goals" />
              <Input label="Previsão de término" name="estimatedEnd" type="date" />
            </ActionForm>
          </details>
        )}
      </Section>

      <Section title="Prontuário">
        <p className="text-xs text-mist">
          Registros não podem ser editados ou apagados; para corrigir, adicione um novo registro. Guarda mínima de 20
          anos.
        </p>
        {write && (
          <ActionForm
            action={addClinicalRecord}
            hidden={{ patientId: id }}
            submitLabel="Adicionar ao prontuário"
            resetOnSuccess
            className="max-w-3xl"
          >
            <Select
              label="Tipo"
              name="kind"
              options={Object.entries(KIND).map(([value, label]) => ({ value, label }))}
              className="max-w-xs"
            />
            <TextArea label="Registro" name="content" required rows={5} />
            <Checkbox label="Liberar para o paciente visualizar no portal" name="visible" />
          </ActionForm>
        )}
        {records.length === 0 ? (
          <Empty>Prontuário sem registros.</Empty>
        ) : (
          <ol className="flex flex-col">
            {records.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 border-b border-onyx/10 py-5">
                <p className="flex flex-wrap items-center gap-2 text-sm text-mist">
                  <Badge>{KIND[r.kind]}</Badge>
                  {fmtDateTime(r.recorded_at)}
                  {r.profiles?.full_name && `, ${r.profiles.full_name}`}
                  {r.visible_to_patient && <Badge tone="good">Visível ao paciente</Badge>}
                </p>
                <p className="whitespace-pre-line">{r.content}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

export default function ClinicalPage({ params }: PageProps<"/studio/pacientes/[id]/clinico">) {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Content params={params} />
    </Suspense>
  );
}
