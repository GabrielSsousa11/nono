import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { Badge, Empty } from "@/components/ui/empty";
import { appointmentStatusLabel } from "@/features/agenda/labels";
import { markNotificationsRead } from "@/features/portal/portal-actions";
import { PushToggle } from "@/features/automations/push-toggle";
import { requirePortal } from "@/lib/auth/guards";
import { fmtDateLong, fmtDateTime, fmtTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Portal", robots: { index: false, follow: false } };

async function Home() {
  const portal = await requirePortal();
  if (!portal) return null;
  const firstName = portal.current?.name.split(" ")[0];
  if (!portal.current) {
    return (
      <>
        <PortalHeading title="Seu portal" />
        <NoPatientLinked />
      </>
    );
  }
  const pid = portal.current.id;
  const [next, notes, daily] = await Promise.all([
    portal.supabase.from("appointments").select("id, starts_at, status, services(name), professionals(display_name)").eq("patient_id", pid).in("status", ["scheduled", "confirmed"]).gte("starts_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle(),
    portal.supabase.from("notifications").select("id, title, body, link, created_at, read_at").order("created_at", { ascending: false }).limit(8),
    portal.supabase.rpc("daily_summary", { p_patient: pid }),
  ]);
  const appt = next.data as unknown as { id: string; starts_at: string; status: string; services: { name: string } | null; professionals: { display_name: string } | null } | null;
  const notifications = (notes.data ?? []) as { id: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }[];
  const summary = daily.data as { current_streak: number; level: string } | null;
  const unread = notifications.some((n) => !n.read_at);

  return (
    <>
      <PortalHeading title={portal.current.isSelf ? `Olá, ${firstName}` : portal.current.name} who={portal.current.isSelf ? null : portal.current.name} />
      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="proxima" className="flex flex-col gap-4 border-t border-gold/60 pt-6">
          <h2 id="proxima" className="text-sm font-semibold text-olive">Próxima consulta</h2>
          {appt ? (
            <>
              <p className="font-display text-3xl leading-tight first-letter:uppercase">{fmtDateLong(appt.starts_at)}, {fmtTime(appt.starts_at)}</p>
              <p className="text-mist">{appt.services?.name} com {appt.professionals?.display_name} <Badge tone={appt.status === "confirmed" ? "good" : "neutral"}>{appointmentStatusLabel[appt.status]}</Badge></p>
              <Link href="/portal/agenda" className="self-start text-sm text-olive underline decoration-gold underline-offset-4">Confirmar, remarcar ou cancelar</Link>
            </>
          ) : (
            <Empty>Nenhuma consulta marcada. <Link href="/portal/agenda" className="text-olive underline">Agendar</Link></Empty>
          )}
        </section>
        <section aria-labelledby="daily" className="flex flex-col gap-4 border-t border-onyx/10 pt-6">
          <h2 id="daily" className="text-sm font-semibold text-olive">CG Daily</h2>
          {summary ? (
            <p className="font-display text-3xl">{summary.current_streak} {summary.current_streak === 1 ? "dia seguido" : "dias seguidos"}<span className="block text-base text-mist">Nível: {summary.level}</span></p>
          ) : <Empty>Comece registrando sua escovação de hoje.</Empty>}
          <Link href="/portal/daily" className="self-start text-sm text-olive underline decoration-gold underline-offset-4">Registrar cuidados de hoje</Link>
        </section>
      </div>

      <section id="avisos" aria-labelledby="avisos-title" className="mt-14 flex flex-col gap-4 border-t border-onyx/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="avisos-title" className="font-display text-2xl">Avisos</h2>
          <PushToggle />
          {unread && <form action={markNotificationsRead}><button type="submit" className="text-sm text-olive underline underline-offset-4">Marcar todos como lidos</button></form>}
        </div>
        {notifications.length === 0 ? <Empty>Nenhum aviso por enquanto.</Empty> : (
          <ul className="flex flex-col">
            {notifications.map((n) => (
              <li key={n.id} className="border-b border-onyx/10">
                <Link href={n.link ?? "/portal"} className="flex items-start justify-between gap-4 py-4">
                  <span>
                    <span className={`block ${n.read_at ? "" : "font-semibold"}`}>{n.title}</span>
                    {n.body && <span className="text-sm text-mist">{n.body}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-mist">{fmtDateTime(n.created_at)} <ArrowRight aria-hidden className="size-4" /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function PortalHome() {
  return (
    <Suspense fallback={<PortalLoading />}>
      <Home />
    </Suspense>
  );
}
