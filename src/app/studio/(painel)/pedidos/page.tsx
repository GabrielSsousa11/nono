import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { BookingStatusForm } from "@/features/studio/booking-status-form";
import { periodLabel, type BookingStatus } from "@/features/studio/booking-status";
import { can } from "@/lib/auth/access";
import { getSessionContext } from "@/lib/auth/session";
import { maskPhone } from "@/features/booking/schema";

export const metadata: Metadata = { title: "Pedidos de agendamento" };

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

async function Requests() {
  const { gate, access, supabase } = await getSessionContext();
  if (gate !== "ok") return null;
  if (!can(access, "booking_requests.manage")) return <p className="text-mist">Sem permissão para ver pedidos.</p>;

  const { data, error } = await supabase!
    .from("booking_requests")
    .select("id, created_at, full_name, phone_digits, email, service_interest, preferred_period, message, status")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar os pedidos. Atualize a página.
      </p>
    );
  if (!data?.length) return <p className="text-mist">Nenhum pedido recebido pelo site até agora.</p>;

  return (
    <ul className="flex flex-col">
      {data.map((r) => (
        <li key={r.id} className="grid gap-4 border-t border-onyx/10 py-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold">{r.full_name}</p>
            <p className="text-sm">
              <a
                href={`tel:+55${r.phone_digits.replace(/^55/, "")}`}
                className="text-olive underline decoration-gold underline-offset-4"
              >
                {maskPhone(r.phone_digits.replace(/^55/, ""))}
              </a>
              {r.email && <span className="text-mist"> · {r.email}</span>}
            </p>
            <p className="text-xs text-mist">
              Recebido em {dateFmt.format(new Date(r.created_at))} ·{" "}
              {periodLabel[r.preferred_period] ?? r.preferred_period}
              {r.service_interest && ` · ${r.service_interest}`}
            </p>
            {r.message && <p className="mt-2 max-w-2xl text-sm text-onyx/85">{r.message}</p>}
          </div>
          <div className="flex flex-col items-start gap-2">
            <BookingStatusForm id={r.id} status={r.status as BookingStatus} label={r.full_name} />
            {r.status !== "scheduled" && can(access, "agenda.write") && (
              <Link
                href={`/studio/agenda?pedido=${r.id}`}
                className="text-sm text-olive underline decoration-gold underline-offset-4"
              >
                Agendar este pedido
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function RequestsPage() {
  return (
    <>
      <StudioPageHeader
        title="Pedidos de agendamento"
        intro="Pedidos enviados pelo site. Entre em contato, combine o horário e atualize a situação. Pedidos não agendados são apagados automaticamente após 12 meses."
      />
      <Suspense fallback={<LoadingRows />}>
        <Requests />
      </Suspense>
    </>
  );
}
