import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { ActionForm, Input, Select } from "@/components/ui/action-form";
import { Badge, Empty, Section } from "@/components/ui/empty";
import {
  acceptWaitlistOffer,
  joinWaitingList,
  leaveWaitingList,
  setAppointmentStatus,
} from "@/features/agenda/actions";
import { BookingWidget, RescheduleWidget } from "@/features/agenda/booking-widgets";
import { appointmentStatusLabel, periodOptions, waitlistStatusLabel } from "@/features/agenda/labels";
import { requirePortal } from "@/lib/auth/guards";
import { fmtDateLong, fmtDateTime, fmtTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Consultas" };

interface Appt {
  id: string;
  starts_at: string;
  status: string;
  professional_id: string;
  service_id: string;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
}

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const pid = portal.current.id;
  const now = new Date().toISOString();
  const [up, past, services, wl] = await Promise.all([
    portal.supabase
      .from("appointments")
      .select("id, starts_at, status, professional_id, service_id, services(name), professionals(display_name)")
      .eq("patient_id", pid)
      .gte("starts_at", now)
      .order("starts_at"),
    portal.supabase
      .from("appointments")
      .select("id, starts_at, status, professional_id, service_id, services(name), professionals(display_name)")
      .eq("patient_id", pid)
      .lt("starts_at", now)
      .order("starts_at", { ascending: false })
      .limit(20),
    portal.supabase
      .from("services")
      .select("id, name, duration_minutes, self_booking")
      .eq("active", true)
      .order("name"),
    portal.supabase
      .from("waiting_list")
      .select("id, status, preferred_period, offer_starts_at, offer_expires_at, services(name)")
      .eq("patient_id", pid)
      .in("status", ["waiting", "offered"]),
  ]);
  const upcoming = (up.data ?? []) as unknown as Appt[];
  const history = (past.data ?? []) as unknown as Appt[];
  const allServices = (services.data ?? []) as {
    id: string;
    name: string;
    duration_minutes: number;
    self_booking: boolean;
  }[];
  const bookable = allServices.filter((s) => s.self_booking);
  const waits = (wl.data ?? []) as unknown as {
    id: string;
    status: string;
    preferred_period: string;
    offer_starts_at: string | null;
    offer_expires_at: string | null;
    services: { name: string } | null;
  }[];

  return (
    <div className="flex flex-col gap-14">
      {waits.some((w) => w.status === "offered") && (
        <Section title="Vaga disponível para você">
          {waits
            .filter((w) => w.status === "offered")
            .map((w) => (
              <div key={w.id} className="flex flex-col gap-3 border-l-2 border-gold pl-4">
                <p>
                  {w.services?.name}:{" "}
                  <strong>
                    {fmtDateLong(w.offer_starts_at!)}, {fmtTime(w.offer_starts_at!)}
                  </strong>
                </p>
                <p className="text-sm text-mist">
                  Oferta válida até {fmtDateTime(w.offer_expires_at!)}. Quem confirmar primeiro fica com a vaga.
                </p>
                <ActionForm
                  action={acceptWaitlistOffer}
                  hidden={{ id: w.id }}
                  submitLabel="Quero esta vaga"
                  pendingLabel="Confirmando"
                />
              </div>
            ))}
        </Section>
      )}

      <Section title="Próximas consultas">
        {upcoming.length === 0 ? (
          <Empty>Nenhuma consulta marcada.</Empty>
        ) : (
          <ul className="flex flex-col">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 border-b border-onyx/10 py-5">
                <p className="font-display text-2xl first-letter:uppercase">
                  {fmtDateLong(a.starts_at)}, {fmtTime(a.starts_at)}
                </p>
                <p className="text-sm text-mist">
                  {a.services?.name} com {a.professionals?.display_name}{" "}
                  <Badge tone={a.status === "confirmed" ? "good" : a.status === "cancelled" ? "bad" : "neutral"}>
                    {appointmentStatusLabel[a.status]}
                  </Badge>
                </p>
                {(a.status === "scheduled" || a.status === "confirmed") && (
                  <div className="flex flex-wrap gap-6">
                    {a.status === "scheduled" && (
                      <ActionForm
                        action={setAppointmentStatus}
                        hidden={{ id: a.id, status: "confirmed" }}
                        submitLabel="Confirmar presença"
                      />
                    )}
                    <details>
                      <summary className="cursor-pointer py-2 text-sm text-olive">Remarcar</summary>
                      <div className="mt-3">
                        <RescheduleWidget
                          appointmentId={a.id}
                          professionalId={a.professional_id}
                          serviceId={a.service_id}
                        />
                      </div>
                    </details>
                    <details>
                      <summary className="cursor-pointer py-2 text-sm text-danger">Cancelar</summary>
                      <ActionForm
                        action={setAppointmentStatus}
                        hidden={{ id: a.id, status: "cancelled" }}
                        submitLabel="Cancelar consulta"
                        variant="outline"
                        className="mt-3 max-w-sm"
                      >
                        <Input label="Motivo" name="reason" required />
                      </ActionForm>
                    </details>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-mist">
          Cancelamentos e remarcações em cima da hora devem ser combinados diretamente com a clínica.
        </p>
      </Section>

      <Section title="Agendar">
        {bookable.length === 0 ? (
          <Empty>No momento, os agendamentos são feitos pela clínica. Use Mensagens para pedir um horário.</Empty>
        ) : (
          <BookingWidget
            services={bookable.map((s) => ({ id: s.id, name: s.name, duration: s.duration_minutes }))}
            patients={[{ id: portal.current.id, name: portal.current.name }]}
          />
        )}
      </Section>

      <Section title="Lista de espera">
        {waits
          .filter((w) => w.status === "waiting")
          .map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-3 text-sm"
            >
              <span>
                {w.services?.name}, {periodOptions.find((o) => o.value === w.preferred_period)?.label}{" "}
                <Badge>{waitlistStatusLabel[w.status]}</Badge>
              </span>
              <ActionForm action={leaveWaitingList} hidden={{ id: w.id }} variant="ghost" submitLabel="Sair da lista" />
            </div>
          ))}
        <p className="text-sm text-mist">
          Sem horário que sirva? Entre na lista e avisamos quando abrir uma vaga compatível.
        </p>
        {allServices.length > 0 && (
          <ActionForm
            action={joinWaitingList}
            hidden={{ patientId: pid }}
            submitLabel="Entrar na lista de espera"
            className="max-w-2xl"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Select
                label="Serviço"
                name="serviceId"
                options={allServices.map((s) => ({ value: s.id, label: s.name }))}
              />
              <Select label="Período preferido" name="period" options={periodOptions} />
            </div>
          </ActionForm>
        )}
      </Section>

      <Section title="Histórico">
        {history.length === 0 ? (
          <Empty>Sem consultas anteriores.</Empty>
        ) : (
          <ul className="flex flex-col text-sm">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-3 border-b border-onyx/10 py-3">
                <span>
                  {fmtDateTime(a.starts_at)}, {a.services?.name}
                </span>
                <Badge tone={a.status === "completed" ? "good" : a.status === "no_show" ? "bad" : "neutral"}>
                  {appointmentStatusLabel[a.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default function PortalAgendaPage() {
  return (
    <>
      <PortalHeading title="Consultas" />
      <Suspense fallback={<PortalLoading />}>
        <Content />
      </Suspense>
    </>
  );
}
