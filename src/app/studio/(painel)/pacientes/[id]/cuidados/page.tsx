import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows } from "@/components/studio/page-header";
import { ActionForm, Input, Select, TextArea } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import { assignProtocol, saveHabitGoal, stopReminder } from "@/features/care/actions";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime, fmtPlainDate } from "@/lib/datetime";

export const metadata: Metadata = { title: "Cuidados do paciente" };

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaff("care.manage");
  if (!ctx) return <NotAllowed />;
  const [goal, summary, protocols, reminders] = await Promise.all([
    ctx.supabase.from("habit_goals").select("brushing_per_day, flossing_per_day, brushing_seconds, note").eq("patient_id", id).maybeSingle(),
    ctx.supabase.rpc("daily_summary", { p_patient: id }),
    ctx.supabase.from("care_protocols").select("id, title").eq("active", true).not("approved_at", "is", null).order("title"),
    ctx.supabase.from("care_reminders").select("id, personal_note, next_due_on, interval_days, acknowledged_at, active, created_at, care_protocols(title)").eq("patient_id", id).order("created_at", { ascending: false }),
  ]);
  const g = goal.data as { brushing_per_day: number; flossing_per_day: number; brushing_seconds: number; note: string | null } | null;
  const s = summary.data as { current_streak: number; adherence_percent: number | null; level: string; total_goal_days: number } | null;
  const rem = (reminders.data ?? []) as unknown as { id: string; personal_note: string | null; next_due_on: string | null; interval_days: number | null; acknowledged_at: string | null; active: boolean; created_at: string; care_protocols: { title: string } | null }[];
  const prot = (protocols.data ?? []) as { id: string; title: string }[];

  return (
    <div className="flex flex-col gap-14">
      <Section title="CG Daily — metas">
        {s && <p className="text-sm">Sequência atual: <strong>{s.current_streak} dias</strong>. Nível: {s.level}. Adesão (não diagnóstica): {s.adherence_percent === null ? "sem registros" : `${s.adherence_percent}%`}.</p>}
        <ActionForm action={saveHabitGoal} hidden={{ patientId: id }} submitLabel="Salvar metas" className="max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Escovações por dia" name="brushing" type="number" min={1} max={3} defaultValue={g?.brushing_per_day ?? 2} />
            <Input label="Fio dental por dia" name="flossing" type="number" min={0} max={2} defaultValue={g?.flossing_per_day ?? 1} />
            <Input label="Tempo de escovação (s)" name="seconds" type="number" min={60} max={240} defaultValue={g?.brushing_seconds ?? 120} />
            <TextArea label="Orientação personalizada" name="note" defaultValue={g?.note ?? ""} className="sm:col-span-3" />
          </div>
        </ActionForm>
      </Section>
      <Section title="CG Care — orientações e lembretes">
        {rem.length === 0 ? <Empty>Nenhuma orientação enviada.</Empty> : (
          <ul className="flex flex-col text-sm">
            {rem.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-3">
                <span>
                  <strong>{r.care_protocols?.title}</strong>, enviado em {fmtDateTime(r.created_at)}
                  {r.next_due_on && r.active && `, próximo lembrete ${fmtPlainDate(r.next_due_on)}`}{" "}
                  {r.acknowledged_at ? <Badge tone="good">Lido em {fmtDateTime(r.acknowledged_at)}</Badge> : <Badge tone="warn">Não lido</Badge>}
                  {!r.active && <Badge>Encerrado</Badge>}
                </span>
                {r.active && <ActionForm action={stopReminder} hidden={{ id: r.id, patientId: id }} variant="ghost" submitLabel="Encerrar" />}
              </li>
            ))}
          </ul>
        )}
        {prot.length === 0 ? <Empty>Nenhum protocolo aprovado. Cadastre em Protocolos de cuidado.</Empty> : (
          <ActionForm action={assignProtocol} hidden={{ patientId: id }} submitLabel="Enviar orientação" resetOnSuccess className="max-w-2xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Protocolo aprovado" name="protocolId" options={prot.map((p) => ({ value: p.id, label: p.title }))} className="sm:col-span-2" />
              <Input label="Repetir a cada (dias)" name="interval" type="number" min={1} max={730} hint="Vazio = padrão do protocolo" />
              <Input label="Primeiro lembrete em" name="firstDue" type="date" />
              <Input label="Encerrar em" name="ends" type="date" />
              <TextArea label="Nota personalizada" name="note" className="sm:col-span-2" />
            </div>
          </ActionForm>
        )}
      </Section>
    </div>
  );
}

export default function PatientCarePage({ params }: PageProps<"/studio/pacientes/[id]/cuidados">) {
  return <Suspense fallback={<LoadingRows />}><Content params={params} /></Suspense>;
}
