"use client";

import { useMemo, useState } from "react";
import { ActionForm, Checkbox, Input, Select, TextArea } from "@/components/ui/action-form";
import { Badge, Empty } from "@/components/ui/empty";
import { fmtPlainDate } from "@/lib/datetime";
import { addToothRecord, supersedeToothRecord } from "./actions";
import { SmileChart } from "./smile-chart";
import { SURFACES, stateLabel, toothName, toothSummary, type ToothRecord } from "./teeth";

/** CG Smile 3D com histórico por dente; `editable` habilita o registro pela equipe clínica. */
export function OdontogramPanel({
  records,
  patientId,
  editable = false,
  dentition = "permanent",
}: {
  records: ToothRecord[];
  patientId?: string;
  editable?: boolean;
  dentition?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const summary = useMemo(() => Object.fromEntries(toothSummary(records)), [records]);
  const history = records.filter((r) => r.tooth_fdi === selected).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <SmileChart summary={summary} selected={selected} onSelect={setSelected} dentition={dentition} />
      <div aria-live="polite" className="flex flex-col gap-5">
        {selected === null ? (
          <Empty>Selecione um dente para ver o histórico{editable ? " e registrar procedimentos" : ""}.</Empty>
        ) : (
          <>
            <h3 className="font-display text-2xl">Dente {selected}<span className="block text-base text-mist">{toothName(selected)}</span></h3>
            {history.length === 0 ? <Empty>Nenhum registro neste dente.</Empty> : (
              <ul className="flex flex-col">
                {history.map((r) => (
                  <li key={r.id} className={`flex flex-col gap-1 border-b border-onyx/10 py-3 text-sm ${r.superseded_at ? "opacity-55" : ""}`}>
                    <span className="flex flex-wrap items-center gap-2 font-semibold">{r.procedure} <Badge tone={r.state === "completed" ? "good" : r.state === "planned" ? "warn" : "neutral"}>{stateLabel[r.state]}</Badge>{r.superseded_at && <Badge>Substituído</Badge>}{editable && r.visible_to_patient === false && <Badge>Oculto ao paciente</Badge>}</span>
                    <span className="text-mist">{r.surfaces.length > 0 && `Faces: ${r.surfaces.join(", ")}. `}{r.performed_on ? `Realizado em ${fmtPlainDate(r.performed_on)}.` : `Registrado em ${fmtPlainDate(r.recorded_at.slice(0, 10))}.`}</span>
                    {r.notes && <span>{r.notes}</span>}
                    {editable && !r.superseded_at && patientId && (
                      <ActionForm action={supersedeToothRecord} hidden={{ id: r.id, patientId }} variant="ghost" submitLabel="Marcar como substituído" />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && patientId && (
              <ActionForm key={selected} action={addToothRecord} hidden={{ patientId, tooth: String(selected) }} submitLabel={`Registrar no dente ${selected}`} resetOnSuccess>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select label="Situação" name="state" options={[{ value: "planned", label: "Planejado" }, { value: "completed", label: "Realizado" }, { value: "observation", label: "Em observação" }, { value: "existing", label: "Preexistente" }]} />
                  <Input label="Data de realização" name="performedOn" type="date" />
                  <Input label="Procedimento ou condição" name="procedure" required className="sm:col-span-2" />
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-2 text-sm font-medium text-olive">Faces</legend>
                    <div className="flex flex-wrap gap-3">
                      {SURFACES.map((s) => (
                        <label key={s.value} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="surfaces" value={s.value} className="accent-olive" />{s.label}</label>
                      ))}
                    </div>
                  </fieldset>
                  <TextArea label="Observações" name="notes" className="sm:col-span-2" />
                  <Checkbox label="Ocultar este registro do paciente" name="hidden" />
                </div>
              </ActionForm>
            )}
          </>
        )}
      </div>
    </div>
  );
}
