import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { Empty, NotAllowed, Section } from "@/components/ui/empty";
import { BusiestChart, CashFlowChart } from "@/features/intelligence/charts";
import { requireStaff } from "@/lib/auth/guards";
import { addDays, fmtMoney, localDate } from "@/lib/datetime";

export const metadata: Metadata = { title: "Indicadores" };

interface Indicators {
  min_sample: number;
  appointments?: { total: number; completed: number; cancelled: number; no_show: number };
  cancellation_rate?: number | null;
  no_show_rate?: number | null;
  occupancy_rate?: number | null;
  available_hours?: number;
  new_patients?: number;
  returning_patients?: number;
  booking_requests?: { total: number; scheduled: number; conversion_rate: number | null };
  busiest_slots?: { weekday: number; hour: number; n: number }[];
  satisfaction?: { answers: number; average: number | null; nps: number | null };
  revenue_cents?: number;
  pending_cents?: number;
  overdue_cents?: number;
  expenses_cents?: number;
  cash_flow?: { month: string; income_cents: number; expense_cents: number }[];
}

function Tile({ label, value, base }: { label: string; value: string | null; base?: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-onyx/15 pt-4">
      <dt className="text-sm text-mist">{label}</dt>
      <dd className="font-display text-4xl leading-none">
        {value ?? <span className="text-xl text-mist">Dados insuficientes</span>}
      </dd>
      {base && <dd className="text-xs text-mist">{base}</dd>}
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const ctx = await requireStaff("reports.read");
  if (!ctx) return <NotAllowed />;
  const days = [30, 90, 365].includes(Number((await searchParams).dias)) ? Number((await searchParams).dias) : 90;
  const to = localDate(new Date());
  const from = addDays(to, -days + 1);
  const { data, error } = await ctx.supabase.rpc("clinic_indicators", { p_from: from, p_to: to });
  if (error)
    return (
      <p role="alert" className="text-danger">
        Não foi possível calcular os indicadores.
      </p>
    );
  const k = data as Indicators;
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? null : `${v.toLocaleString("pt-BR")}%`;
  return (
    <div className="flex flex-col gap-12">
      <nav aria-label="Período" className="flex gap-2">
        {[30, 90, 365].map((d) => (
          <Link
            key={d}
            href={`/studio/indicadores?dias=${d}`}
            aria-current={d === days ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm ${d === days ? "border-olive bg-olive text-ivory" : "border-onyx/15"}`}
          >
            {d === 365 ? "12 meses" : `${d} dias`}
          </Link>
        ))}
      </nav>
      <p className="text-xs text-mist">
        Calculados a partir dos registros reais do sistema. Percentuais só aparecem com pelo menos {k.min_sample} casos
        na base.
      </p>
      {k.appointments && (
        <Section title="Atendimento">
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              label="Taxa de ocupação"
              value={pct(k.occupancy_rate)}
              base={`${k.available_hours ?? 0} h disponíveis na grade`}
            />
            <Tile
              label="Consultas realizadas"
              value={String(k.appointments.completed)}
              base={`${k.appointments.total} agendadas no período`}
            />
            <Tile
              label="Cancelamentos"
              value={pct(k.cancellation_rate)}
              base={`${k.appointments.cancelled} de ${k.appointments.total}`}
            />
            <Tile label="Faltas" value={pct(k.no_show_rate)} base={`${k.appointments.no_show} faltas`} />
            <Tile
              label="Novos pacientes"
              value={String(k.new_patients ?? 0)}
              base="primeira consulta concluída no período"
            />
            <Tile
              label="Pacientes que retornaram"
              value={String(k.returning_patients ?? 0)}
              base="duas ou mais consultas concluídas"
            />
            <Tile
              label="Conversão de pedidos do site"
              value={pct(k.booking_requests?.conversion_rate)}
              base={`${k.booking_requests?.scheduled ?? 0} agendados de ${k.booking_requests?.total ?? 0} pedidos`}
            />
            <Tile
              label="Satisfação (NPS)"
              value={
                k.satisfaction?.nps === null || k.satisfaction?.nps === undefined ? null : String(k.satisfaction.nps)
              }
              base={`${k.satisfaction?.answers ?? 0} respostas${k.satisfaction?.average != null ? `, média ${k.satisfaction.average}` : ""}`}
            />
          </dl>
          <h3 className="mt-6 text-sm font-semibold text-olive">Horários de maior demanda</h3>
          {k.busiest_slots && k.busiest_slots.length > 0 ? (
            <BusiestChart data={k.busiest_slots} />
          ) : (
            <Empty>Sem consultas no período.</Empty>
          )}
        </Section>
      )}
      {k.revenue_cents !== undefined && (
        <Section title="Financeiro">
          <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Receita recebida" value={fmtMoney(k.revenue_cents)} />
            <Tile label="Valores pendentes" value={fmtMoney(k.pending_cents ?? 0)} base="cobranças em aberto (todas)" />
            <Tile label="Vencidos" value={fmtMoney(k.overdue_cents ?? 0)} />
            <Tile label="Despesas" value={fmtMoney(k.expenses_cents ?? 0)} />
          </dl>
          <h3 className="mt-6 text-sm font-semibold text-olive">Fluxo de caixa mensal</h3>
          {k.cash_flow?.some((m) => m.income_cents || m.expense_cents) ? (
            <CashFlowChart data={k.cash_flow} />
          ) : (
            <Empty>Sem movimentações no período.</Empty>
          )}
        </Section>
      )}
    </div>
  );
}

export default function IndicatorsPage({ searchParams }: PageProps<"/studio/indicadores">) {
  return (
    <>
      <StudioPageHeader title="Indicadores" />
      <Suspense fallback={<LoadingRows />}>
        <Content searchParams={searchParams as Promise<{ dias?: string }>} />
      </Suspense>
    </>
  );
}
