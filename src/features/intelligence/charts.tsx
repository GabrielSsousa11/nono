"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Paleta validada (scripts do skill dataviz): passa em CVD, contraste e separação.
const INCOME = "#3b7d48";
const EXPENSE = "#b8862a";
const AXIS = { fontSize: 12, fill: "#5d655b" };
const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

export function CashFlowChart({ data }: { data: { month: string; income_cents: number; expense_cents: number }[] }) {
  const rows = data.map((d) => ({
    ...d,
    label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
      new Date(`${d.month}-15T12:00:00Z`),
    ),
  }));
  return (
    <figure className="flex flex-col gap-3">
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={rows} barGap={2} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e9e3d7" />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={brl} tick={AXIS} axisLine={false} tickLine={false} width={80} />
            <Tooltip
              formatter={(v, name) => [brl(Number(v)), name === "income_cents" ? "Receitas" : "Despesas"]}
              cursor={{ fill: "rgb(32 36 32 / 0.04)" }}
            />
            <Legend
              formatter={(v) => (v === "income_cents" ? "Receitas" : "Despesas")}
              wrapperStyle={{ fontSize: 13, color: "#202420" }}
            />
            <Bar dataKey="income_cents" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expense_cents" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-olive">Ver como tabela</summary>
        <table className="mt-2 w-full max-w-lg text-left text-sm">
          <thead>
            <tr className="text-mist">
              <th className="font-normal">Mês</th>
              <th className="font-normal">Receitas</th>
              <th className="font-normal">Despesas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-t border-onyx/10">
                <td className="py-1.5">{r.label}</td>
                <td>{brl(r.income_cents)}</td>
                <td>{brl(r.expense_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function BusiestChart({ data }: { data: { weekday: number; hour: number; n: number }[] }) {
  const rows = data.map((d) => ({ label: `${WD[d.weekday]} ${String(d.hour).padStart(2, "0")}h`, n: d.n }));
  return (
    <figure className="flex flex-col gap-3">
      <div className="w-full" style={{ height: Math.max(160, rows.length * 34) }}>
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#e9e3d7" />
            <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" tick={AXIS} axisLine={false} tickLine={false} width={72} />
            <Tooltip formatter={(v) => [`${v} consultas`, "Atendimentos"]} cursor={{ fill: "rgb(32 36 32 / 0.04)" }} />
            <Bar dataKey="n" fill={INCOME} radius={[0, 4, 4, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-olive">Ver como tabela</summary>
        <table className="mt-2 text-left text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-onyx/10">
                <td className="py-1.5 pr-6">{r.label}</td>
                <td>{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
