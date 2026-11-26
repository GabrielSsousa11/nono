import { Badge } from "@/components/ui/empty";
import { fmtPlainDate } from "@/lib/datetime";

export interface Stage { id: string; position: number; title: string; description: string | null; guidance: string | null; status: string; estimated_date: string | null; completed_at: string | null }
export interface Plan { id: string; title: string; goals: string | null; status: string; estimated_end: string | null; created_at: string; stages: Stage[] }

export const stageLabel: Record<string, string> = { pending: "Pendente", scheduled: "Agendada", in_progress: "Em andamento", completed: "Concluída", skipped: "Não será realizada" };
export const planLabel: Record<string, string> = { draft: "Rascunho", active: "Em andamento", completed: "Concluído", cancelled: "Cancelado" };

export function progressOf(stages: Stage[]) {
  const counted = stages.filter((s) => s.status !== "skipped");
  const done = counted.filter((s) => s.status === "completed").length;
  return { done, total: counted.length, percent: counted.length ? Math.round((100 * done) / counted.length) : 0 };
}

/** CG Journey: linha do tempo do plano. Progresso = etapas registradas, não garantia de resultado. */
export function JourneyTimeline({ plan, renderStageExtra }: { plan: Plan; renderStageExtra?: (s: Stage) => React.ReactNode }) {
  const p = progressOf(plan.stages);
  const next = plan.stages.find((s) => s.status !== "completed" && s.status !== "skipped");
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-3xl">{plan.title}</h3>
          <Badge tone={plan.status === "completed" ? "good" : plan.status === "cancelled" ? "bad" : plan.status === "draft" ? "neutral" : "warn"}>{planLabel[plan.status]}</Badge>
        </div>
        {plan.goals && <p className="max-w-2xl text-onyx/85">{plan.goals}</p>}
        <div className="flex max-w-xl flex-col gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-label="Etapas registradas como concluídas">
            <div className="h-full bg-olive transition-[width] duration-700" style={{ width: `${p.percent}%` }} />
          </div>
          <p className="text-xs text-mist">{p.done} de {p.total} etapas concluídas ({p.percent}%). O percentual mostra etapas registradas, não é garantia de resultado clínico.{plan.estimated_end && ` Previsão de término: ${fmtPlainDate(plan.estimated_end)}.`}</p>
        </div>
        {next && <p className="text-sm"><strong>Próxima etapa:</strong> {next.title}{next.estimated_date && `, previsão ${fmtPlainDate(next.estimated_date)}`}</p>}
      </header>
      <ol className="journey-track relative">
        {plan.stages.map((s) => (
          <li key={s.id} className="relative grid grid-cols-[3.5rem_1fr] gap-4 pb-10 last:pb-0">
            <span aria-hidden className={`font-display relative z-10 grid size-12 place-items-center rounded-full border text-lg ${s.status === "completed" ? "border-olive bg-olive text-ivory" : s.status === "skipped" ? "border-onyx/20 bg-ivory text-mist line-through" : "border-gold bg-ivory text-olive"}`}>{s.position}</span>
            <div className="flex flex-col gap-1.5 pt-1.5">
              <p className="flex flex-wrap items-center gap-2 font-semibold">{s.title} <Badge tone={s.status === "completed" ? "good" : s.status === "in_progress" ? "warn" : "neutral"}>{stageLabel[s.status]}</Badge></p>
              {s.description && <p className="text-sm text-onyx/85">{s.description}</p>}
              <p className="text-xs text-mist">{s.completed_at ? `Concluída em ${fmtPlainDate(s.completed_at.slice(0, 10))}` : s.estimated_date ? `Previsão: ${fmtPlainDate(s.estimated_date)}` : "Sem data prevista"}</p>
              {s.guidance && <p className="border-l-2 border-gold pl-3 text-sm"><strong>Orientações:</strong> {s.guidance}</p>}
              {renderStageExtra?.(s)}
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
