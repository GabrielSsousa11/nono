import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { Badge, Empty, NotAllowed } from "@/components/ui/empty";
import { StaffAppointmentActions } from "@/features/agenda/appointment-actions";
import { BookingWidget } from "@/features/agenda/booking-widgets";
import { appointmentStatusLabel } from "@/features/agenda/labels";
import { can } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import {
  addDays,
  daysInMonth,
  fmtDateLong,
  fmtPlainDate,
  fmtTime,
  isIsoDate,
  localDate,
  startOfMonth,
  startOfWeek,
  weekday,
  zonedToUtc,
} from "@/lib/datetime";

export const metadata: Metadata = { title: "Agenda" };

type View = "dia" | "semana" | "mes";
interface Appt {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  professional_id: string;
  service_id: string;
  patient_id: string;
  source: string;
  patients: { full_name: string; social_name: string | null } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
}
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const tone = (s: string) =>
  (s === "cancelled" || s === "no_show"
    ? "bad"
    : s === "completed"
      ? "good"
      : s === "confirmed" || s === "checked_in"
        ? "warn"
        : "neutral") as "bad" | "good" | "warn" | "neutral";

async function Agenda({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireStaff("agenda.read");
  if (!ctx) return <NotAllowed />;
  const sp = await searchParams;
  const view: View = sp.v === "semana" || sp.v === "mes" ? sp.v : "dia";
  const day = isIsoDate(sp.d) ? sp.d : localDate(new Date());
  const pro = sp.p && /^[0-9a-f-]{36}$/.test(sp.p) ? sp.p : "";
  const from = view === "dia" ? day : view === "semana" ? startOfWeek(day) : startOfMonth(day);
  const to = view === "dia" ? addDays(day, 1) : view === "semana" ? addDays(from, 7) : addDays(from, daysInMonth(day));
  const canWrite = can(ctx.access, "agenda.write");

  let q = ctx.supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, professional_id, service_id, patient_id, source, patients(full_name, social_name), services(name), professionals(display_name)",
    )
    .gte("starts_at", zonedToUtc(from).toISOString())
    .lt("starts_at", zonedToUtc(to).toISOString())
    .order("starts_at");
  if (pro) q = q.eq("professional_id", pro);
  const [appts, pros, services, blocks, request] = await Promise.all([
    q,
    ctx.supabase.from("professionals").select("id, display_name").eq("active", true).order("display_name"),
    ctx.supabase.from("services").select("id, name, duration_minutes").eq("active", true).order("name"),
    ctx.supabase
      .from("schedule_blocks")
      .select("id, kind, starts_at, ends_at, reason, professional_id")
      .lt("starts_at", zonedToUtc(to).toISOString())
      .gt("ends_at", zonedToUtc(from).toISOString()),
    sp.pedido && /^[0-9a-f-]{36}$/.test(sp.pedido)
      ? ctx.supabase
          .from("booking_requests")
          .select("id, full_name, phone_digits, service_interest")
          .eq("id", sp.pedido)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const list = (appts.data ?? []) as unknown as Appt[];
  const blockList = (blocks.data ?? []) as {
    id: string;
    kind: string;
    starts_at: string;
    ends_at: string;
    reason: string | null;
  }[];
  const step = view === "dia" ? 1 : view === "semana" ? 7 : daysInMonth(day);
  const link = (o: Partial<{ v: View; d: string; p: string }>) => {
    const params = new URLSearchParams({ v: o.v ?? view, d: o.d ?? day, ...((o.p ?? pro) ? { p: o.p ?? pro } : {}) });
    return `/studio/agenda?${params}`;
  };
  const name = (a: Appt) => a.patients?.social_name || a.patients?.full_name || "Paciente";
  const req = request.data as {
    id: string;
    full_name: string;
    phone_digits: string;
    service_interest: string | null;
  } | null;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Visão da agenda" className="flex gap-2">
          {(["dia", "semana", "mes"] as View[]).map((v) => (
            <Link
              key={v}
              href={link({ v })}
              aria-current={v === view ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm ${v === view ? "border-olive bg-olive text-ivory" : "border-onyx/15"}`}
            >
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href={link({ d: addDays(day, -step) })}
            className="inline-flex min-h-10 items-center rounded-full border border-onyx/15 px-4 text-sm"
            aria-label="Período anterior"
          >
            Anterior
          </Link>
          <Link href={link({ d: localDate(new Date()) })} className="text-sm text-olive underline underline-offset-4">
            Hoje
          </Link>
          <Link
            href={link({ d: addDays(day, step) })}
            className="inline-flex min-h-10 items-center rounded-full border border-onyx/15 px-4 text-sm"
            aria-label="Próximo período"
          >
            Próximo
          </Link>
        </div>
        <form className="flex items-center gap-2">
          <input type="hidden" name="v" value={view} />
          <input type="hidden" name="d" value={day} />
          <label htmlFor="p" className="sr-only">
            Profissional
          </label>
          <select
            id="p"
            name="p"
            defaultValue={pro}
            className="min-h-10 rounded-full border border-onyx/15 bg-transparent px-3 text-sm"
          >
            <option value="">Todos os profissionais</option>
            {((pros.data ?? []) as { id: string; display_name: string }[]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
          <button type="submit" className="min-h-10 rounded-full bg-olive px-4 text-sm text-ivory">
            Filtrar
          </button>
        </form>
      </div>

      <h2 className="font-display text-3xl first-letter:uppercase">
        {view === "dia"
          ? fmtDateLong(zonedToUtc(day, "12:00"))
          : view === "semana"
            ? `Semana de ${fmtPlainDate(from)} a ${fmtPlainDate(addDays(from, 6))}`
            : new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
                new Date(`${from}T12:00:00Z`),
              )}
      </h2>

      {blockList.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {blockList.map((b) => (
            <li key={b.id}>
              <Badge tone="warn">
                {b.kind === "holiday" ? "Feriado" : b.kind === "absence" ? "Ausência" : "Bloqueio"}
              </Badge>{" "}
              {fmtTime(b.starts_at)}–{fmtTime(b.ends_at)} {b.reason}
            </li>
          ))}
        </ul>
      )}

      {view === "dia" &&
        (list.length === 0 ? (
          <Empty>Nenhuma consulta neste dia.</Empty>
        ) : (
          <ol className="flex flex-col">
            {list.map((a) => (
              <li
                key={a.id}
                className={`grid gap-4 border-b border-onyx/10 py-5 md:grid-cols-[7rem_minmax(0,1fr)] ${a.status === "cancelled" ? "opacity-60" : ""}`}
              >
                <p className="font-display text-2xl leading-none">
                  {fmtTime(a.starts_at)}
                  <span className="block text-sm text-mist">até {fmtTime(a.ends_at)}</span>
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/studio/pacientes/${a.patient_id}`} className="font-semibold hover:underline">
                      {name(a)}
                    </Link>
                    <Badge tone={tone(a.status)}>{appointmentStatusLabel[a.status]}</Badge>
                    {a.source !== "studio" && (
                      <Badge>
                        {a.source === "portal"
                          ? "Pelo portal"
                          : a.source === "waitlist"
                            ? "Lista de espera"
                            : "Pedido do site"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-mist">
                    {a.services?.name}, {a.professionals?.display_name}
                  </p>
                  <StaffAppointmentActions
                    id={a.id}
                    status={a.status}
                    professionalId={a.professional_id}
                    serviceId={a.service_id}
                    canWrite={canWrite}
                  />
                </div>
              </li>
            ))}
          </ol>
        ))}

      {view === "semana" && (
        <div className="grid gap-4 md:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => {
            const items = list.filter((a) => localDate(new Date(a.starts_at)) === d);
            return (
              <section
                key={d}
                aria-label={fmtPlainDate(d)}
                className="flex min-h-40 flex-col gap-2 border-t border-onyx/15 pt-3"
              >
                <Link
                  href={link({ v: "dia", d })}
                  className={`text-sm font-semibold ${d === localDate(new Date()) ? "text-olive underline" : ""}`}
                >
                  {WD[weekday(d)]} {d.slice(8)}
                </Link>
                {items.length === 0 && <p className="text-xs text-mist">Livre</p>}
                {items.map((a) => (
                  <Link
                    key={a.id}
                    href={link({ v: "dia", d })}
                    className={`rounded border-l-2 bg-porcelain px-2 py-1.5 text-xs ${a.status === "cancelled" ? "border-danger line-through opacity-60" : "border-olive"}`}
                  >
                    <strong>{fmtTime(a.starts_at)}</strong> {name(a)}
                    <span className="block text-mist">{a.services?.name}</span>
                  </Link>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {view === "mes" && (
        <div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-mist" aria-hidden>
            {WD.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <ol className="mt-2 grid grid-cols-7 gap-1">
            {Array.from({ length: weekday(from) }, (_, i) => (
              <li key={`e${i}`} aria-hidden />
            ))}
            {Array.from({ length: daysInMonth(day) }, (_, i) => addDays(from, i)).map((d) => {
              const n = list.filter((a) => localDate(new Date(a.starts_at)) === d && a.status !== "cancelled").length;
              return (
                <li key={d}>
                  <Link
                    href={link({ v: "dia", d })}
                    className={`flex aspect-square flex-col items-center justify-center rounded border text-sm ${d === localDate(new Date()) ? "border-olive" : "border-onyx/10"} ${n ? "bg-porcelain" : ""}`}
                    aria-label={`${fmtPlainDate(d)}: ${n} consultas`}
                  >
                    {Number(d.slice(8))}
                    {n > 0 && <span className="text-xs font-semibold text-olive">{n}</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {canWrite && (
        <section aria-labelledby="novo-title" className="flex flex-col gap-6 border-t border-gold/60 pt-8">
          <h2 id="novo-title" className="font-display text-3xl">
            Nova consulta
          </h2>
          {req && (
            <p className="text-sm">
              Agendando o pedido de <strong>{req.full_name}</strong>
              {req.service_interest && ` (${req.service_interest})`}. Encontre ou cadastre o paciente e escolha o
              horário; o pedido será marcado como agendado.
            </p>
          )}
          {(services.data ?? []).length === 0 ? (
            <Empty>Cadastre serviços, profissionais e horários em Serviços e horários.</Empty>
          ) : (
            <BookingWidget
              allowSearch
              services={((services.data ?? []) as { id: string; name: string; duration_minutes: number }[]).map(
                (s) => ({ id: s.id, name: s.name, duration: s.duration_minutes }),
              )}
              bookingRequestId={req?.id}
            />
          )}
        </section>
      )}
    </div>
  );
}

export default function AgendaPage({ searchParams }: PageProps<"/studio/agenda">) {
  return (
    <>
      <StudioPageHeader title="Agenda" />
      <Suspense fallback={<LoadingRows />}>
        <Agenda searchParams={searchParams as Promise<Record<string, string | undefined>>} />
      </Suspense>
    </>
  );
}
