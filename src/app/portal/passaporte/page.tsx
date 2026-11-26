import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { Monogram } from "@/components/ui/monogram";
import { Badge, Empty, Section } from "@/components/ui/empty";
import { appointmentStatusLabel } from "@/features/agenda/labels";
import { PassportQr } from "@/features/care/passport-qr";
import { requirePortal } from "@/lib/auth/guards";
import { fmtDateLong, fmtPlainDate, fmtTime, isoFromNow, localDate } from "@/lib/datetime";

export const metadata: Metadata = { title: "CG Passport" };

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const pid = portal.current.id;
  const [next, hist, plan, pat] = await Promise.all([
    portal.supabase
      .from("appointments")
      .select("id, starts_at, status, professionals(display_name, cro_number, cro_state), services(name)")
      .eq("patient_id", pid)
      .in("status", ["scheduled", "confirmed"])
      .gte("starts_at", isoFromNow(-2))
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    portal.supabase
      .from("appointments")
      .select("status")
      .eq("patient_id", pid)
      .lt("starts_at", new Date().toISOString()),
    portal.supabase
      .from("treatment_plans")
      .select("title")
      .eq("patient_id", pid)
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    portal.supabase
      .from("patients")
      .select("full_name, social_name, birth_date, professionals:responsible_professional_id(display_name)")
      .eq("id", pid)
      .maybeSingle(),
  ]);
  const a = next.data as unknown as {
    id: string;
    starts_at: string;
    status: string;
    professionals: { display_name: string } | null;
    services: { name: string } | null;
  } | null;
  const statuses = ((hist.data ?? []) as { status: string }[]).map((h) => h.status);
  const attended = statuses.filter((s) => s === "completed" || s === "checked_in").length;
  const missed = statuses.filter((s) => s === "no_show").length;
  const p = pat.data as unknown as {
    full_name: string;
    social_name: string | null;
    birth_date: string | null;
    professionals: { display_name: string } | null;
  } | null;
  const isToday = a && localDate(new Date(a.starts_at)) === localDate(new Date());

  return (
    <div className="flex flex-col gap-12">
      <article
        aria-label="Carteira digital"
        className="stone on-dark relative flex max-w-md flex-col gap-6 overflow-hidden rounded-2xl bg-olive p-7 text-ivory shadow-[0_20px_50px_-20px_rgb(32_36_32/0.6)]"
      >
        <div className="flex items-center justify-between">
          <Monogram className="size-10 text-ivory" />
          <span className="text-xs tracking-[0.2em] text-champagne">CG Passport</span>
        </div>
        <div>
          <p className="font-display text-3xl leading-tight">{p?.social_name || p?.full_name}</p>
          {p?.birth_date && <p className="text-sm text-champagne">Nascimento: {fmtPlainDate(p.birth_date)}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-champagne">Profissional responsável</dt>
            <dd>{p?.professionals?.display_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-champagne">Tratamento</dt>
            <dd>{(plan.data as { title: string } | null)?.title ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-champagne">Comparecimentos</dt>
            <dd>{attended}</dd>
          </div>
          <div>
            <dt className="text-champagne">Faltas</dt>
            <dd>{missed}</dd>
          </div>
        </dl>
      </article>

      <Section title="Próxima consulta">
        {a ? (
          <div className="flex flex-col gap-5">
            <p className="font-display text-2xl first-letter:uppercase">
              {fmtDateLong(a.starts_at)}, {fmtTime(a.starts_at)}
            </p>
            <p className="text-sm text-mist">
              {a.services?.name} com {a.professionals?.display_name} <Badge>{appointmentStatusLabel[a.status]}</Badge>
            </p>
            {isToday ? (
              <PassportQr appointmentId={a.id} />
            ) : (
              <p className="text-sm text-mist">O QR Code de check-in fica disponível no dia da consulta.</p>
            )}
          </div>
        ) : (
          <Empty>
            Nenhuma consulta marcada.{" "}
            <Link href="/portal/agenda" className="text-olive underline">
              Ver consultas
            </Link>
          </Empty>
        )}
      </Section>
      <p className="text-xs text-mist">
        Acesso rápido:{" "}
        <Link href="/portal/jornada" className="underline">
          jornada
        </Link>
        ,{" "}
        <Link href="/portal/cuidados" className="underline">
          cuidados
        </Link>
        ,{" "}
        <Link href="/portal/agenda" className="underline">
          consultas
        </Link>
        .
      </p>
    </div>
  );
}

export default function PassportPage() {
  return (
    <>
      <PortalHeading title="CG Passport" intro="Sua carteira digital da clínica." />
      <Suspense fallback={<PortalLoading />}>
        <Content />
      </Suspense>
    </>
  );
}
