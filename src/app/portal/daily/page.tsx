import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, Empty, Section } from "@/components/ui/empty";
import { completeMission, logHabit } from "@/features/daily/actions";
import { BrushingTimer } from "@/features/daily/brushing-timer";
import { Flame } from "@/features/daily/flame";
import { requirePortal } from "@/lib/auth/guards";
import { addDays, fmtPlainDate, weekday } from "@/lib/datetime";

export const metadata: Metadata = { title: "CG Daily" };

interface Summary {
  today: string;
  goal: { brushing_per_day: number; flossing_per_day: number; brushing_seconds: number; note: string | null } | null;
  today_counts: { brushing: number; flossing: number };
  current_streak: number;
  best_streak: number;
  total_goal_days: number;
  level: string;
  adherence_percent: number | null;
  adherence_window_days: number;
  calendar: { day: string; met: boolean }[];
}

const LEVELS = [
  ["Primeiro passo", 0],
  ["Sorriso consciente", 7],
  ["Guardião do sorriso", 30],
  ["Mestre do cuidado", 90],
  ["Embaixador do sorriso", 180],
] as const;

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const pid = portal.current.id;
  const [sum, ach, earned, missions, done, logs] = await Promise.all([
    portal.supabase.rpc("daily_summary", { p_patient: pid }),
    portal.supabase.from("achievements").select("key, title, description, position").order("position"),
    portal.supabase.from("patient_achievements").select("achievement_key, earned_at").eq("patient_id", pid),
    portal.supabase.from("education_missions").select("key, title, body, position").order("position"),
    portal.supabase.from("patient_missions").select("mission_key").eq("patient_id", pid),
    portal.supabase
      .from("brushing_logs")
      .select("local_date, kind")
      .eq("patient_id", pid)
      .gte("local_date", addDays(new Date().toISOString().slice(0, 10), -60)),
  ]);
  const s = sum.data as Summary | null;
  if (!s) return <Empty>Não foi possível carregar o CG Daily.</Empty>;
  const goalB = s.goal?.brushing_per_day ?? 2;
  const goalF = s.goal?.flossing_per_day ?? 1;
  const earnedSet = new Map(
    ((earned.data ?? []) as { achievement_key: string; earned_at: string }[]).map((e) => [
      e.achievement_key,
      e.earned_at,
    ]),
  );
  const doneSet = new Set(((done.data ?? []) as { mission_key: string }[]).map((d) => d.mission_key));
  const metDays = new Map(s.calendar.map((c) => [c.day, c.met]));
  const start = addDays(s.today, -41 - weekday(addDays(s.today, -41)));
  const calendarDays = Array.from({ length: 42 + weekday(addDays(s.today, -41)) }, (_, i) => addDays(start, i)).filter(
    (d) => d <= s.today,
  );
  const logRows = (logs.data ?? []) as { local_date: string; kind: string }[];
  const weeks = [0, 1, 2, 3].map((w) => {
    const end = addDays(s.today, -7 * w);
    const from = addDays(end, -6);
    const inWeek = logRows.filter((l) => l.local_date >= from && l.local_date <= end);
    return {
      label: `${fmtPlainDate(from, { day: "2-digit", month: "2-digit" })}–${fmtPlainDate(end, { day: "2-digit", month: "2-digit" })}`,
      brushing: inWeek.filter((l) => l.kind === "brushing").length,
      flossing: inWeek.filter((l) => l.kind === "flossing").length,
      met: s.calendar.filter((c) => c.met && c.day >= from && c.day <= end).length,
    };
  });
  const nextLevel = LEVELS.find(([, n]) => n > s.total_goal_days);

  return (
    <div className="flex flex-col gap-14">
      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="hoje" className="flex flex-col gap-6">
          <h2 id="hoje" className="font-display text-3xl">
            Hoje
          </h2>
          <Flame streak={s.current_streak} />
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 pb-3">
              <span>
                Escovação:{" "}
                <strong>
                  {Math.min(s.today_counts.brushing, goalB)} de {goalB}
                </strong>
                {s.today_counts.brushing >= goalB && " ✓"}
              </span>
              {s.today_counts.brushing < goalB + 1 && (
                <ActionForm
                  action={logHabit}
                  hidden={{ patientId: pid, kind: "brushing" }}
                  variant="outline"
                  submitLabel="Registrar escovação"
                />
              )}
            </li>
            {goalF > 0 && (
              <li className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 pb-3">
                <span>
                  Fio dental:{" "}
                  <strong>
                    {Math.min(s.today_counts.flossing, goalF)} de {goalF}
                  </strong>
                  {s.today_counts.flossing >= goalF && " ✓"}
                </span>
                <ActionForm
                  action={logHabit}
                  hidden={{ patientId: pid, kind: "flossing" }}
                  variant="outline"
                  submitLabel="Registrar fio dental"
                />
              </li>
            )}
          </ul>
          {s.goal?.note && <p className="border-l-2 border-gold pl-3 text-sm">Orientação da dentista: {s.goal.note}</p>}
          <p className="text-xs text-mist">
            Metas definidas pela sua dentista. Registrar mais vezes do que a meta não soma pontos: escovar em excesso
            pode desgastar dentes e gengiva.
          </p>
        </section>
        <section aria-labelledby="timer" className="flex flex-col gap-6">
          <h2 id="timer" className="font-display text-3xl">
            Escovação guiada
          </h2>
          <BrushingTimer patientId={pid} seconds={s.goal?.brushing_seconds ?? 120} />
        </section>
      </div>

      <Section title="Seu progresso">
        <dl className="grid gap-6 sm:grid-cols-4">
          <div>
            <dt className="text-sm text-mist">Nível</dt>
            <dd className="font-display text-2xl">{s.level}</dd>
            {nextLevel && (
              <dd className="text-xs text-mist">
                Próximo: {nextLevel[0]} em {nextLevel[1] - s.total_goal_days} dias com meta cumprida
              </dd>
            )}
          </div>
          <div>
            <dt className="text-sm text-mist">Recorde de sequência</dt>
            <dd className="font-display text-2xl">{s.best_streak} dias</dd>
          </div>
          <div>
            <dt className="text-sm text-mist">Dias com meta cumprida</dt>
            <dd className="font-display text-2xl">{s.total_goal_days}</dd>
          </div>
          <div>
            <dt className="text-sm text-mist">Índice de adesão</dt>
            <dd className="font-display text-2xl">{s.adherence_percent === null ? "—" : `${s.adherence_percent}%`}</dd>
            <dd className="text-xs text-mist">
              Dias com meta cumprida nos últimos {s.adherence_window_days || 30} dias. Mede registros,{" "}
              <strong>não é diagnóstico</strong> da sua saúde bucal.
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Calendário de hábitos">
        <div className="grid max-w-md grid-cols-7 gap-1.5" role="list" aria-label="Últimas seis semanas">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <span key={i} aria-hidden className="text-center text-xs text-mist">
              {d}
            </span>
          ))}
          {calendarDays.map((d) => {
            const met = metDays.get(d);
            return (
              <span
                key={d}
                role="listitem"
                aria-label={`${fmtPlainDate(d)}: ${met ? "meta cumprida" : met === false ? "registro parcial" : "sem registro"}`}
                className={`grid aspect-square place-items-center rounded text-xs ${met ? "bg-olive text-ivory" : met === false ? "bg-champagne" : "bg-stone text-mist"} ${d === s.today ? "ring-2 ring-gold-ink" : ""}`}
              >
                {Number(d.slice(8))}
              </span>
            );
          })}
        </div>
        <table className="mt-4 w-full max-w-xl text-left text-sm">
          <caption className="mb-2 text-left text-sm font-semibold text-olive">Histórico semanal</caption>
          <thead>
            <tr className="text-mist">
              <th className="py-1 font-normal">Semana</th>
              <th className="font-normal">Escovações</th>
              <th className="font-normal">Fio dental</th>
              <th className="font-normal">Dias com meta</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.label} className="border-t border-onyx/10">
                <td className="py-2">{w.label}</td>
                <td>{w.brushing}</td>
                <td>{w.flossing}</td>
                <td>{w.met} de 7</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Conquistas">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {((ach.data ?? []) as { key: string; title: string; description: string }[]).map((a) => {
            const at = earnedSet.get(a.key);
            return (
              <li
                key={a.key}
                className={`flex flex-col gap-1 border-t pt-3 ${at ? "border-olive" : "border-onyx/10 opacity-60"}`}
              >
                <span className="font-semibold">
                  {a.title} {at && <Badge tone="good">Conquistada</Badge>}
                </span>
                <span className="text-sm text-mist">{a.description}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-mist">Suas conquistas são só suas: não há ranking entre pacientes.</p>
      </Section>

      <Section title="Missões educativas">
        <ol className="flex flex-col">
          {((missions.data ?? []) as { key: string; title: string; body: string }[]).map((m) => (
            <li key={m.key} className="flex flex-col gap-2 border-b border-onyx/10 py-4">
              <p className="font-semibold">
                {m.title} {doneSet.has(m.key) && <Badge tone="good">Concluída</Badge>}
              </p>
              <p className="max-w-2xl text-sm text-onyx/85">{m.body}</p>
              {!doneSet.has(m.key) && (
                <ActionForm
                  action={completeMission}
                  hidden={{ patientId: pid, mission: m.key }}
                  variant="ghost"
                  submitLabel="Li e entendi"
                />
              )}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

export default function DailyPage() {
  return (
    <>
      <PortalHeading title="CG Daily" intro="Seus hábitos de escovação e fio dental, dia a dia." />
      <Suspense fallback={<PortalLoading />}>
        <Content />
      </Suspense>
    </>
  );
}
