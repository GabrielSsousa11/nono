import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, Checkbox, Input, Select, TextArea } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import {
  addAvailability,
  addBlock,
  createProfessional,
  createService,
  removeAvailability,
  removeBlock,
  toggleProfessionalService,
  toggleService,
} from "@/features/studio/services-actions";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime, fmtMoney } from "@/lib/datetime";

export const metadata: Metadata = { title: "Serviços e horários" };

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const BLOCK_KIND: Record<string, string> = { holiday: "Feriado", absence: "Ausência", block: "Bloqueio" };

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  buffer_minutes: number;
  price_cents: number | null;
  self_booking: boolean;
  active: boolean;
}
interface Professional {
  id: string;
  display_name: string;
  cro_number: string | null;
  cro_state: string | null;
  active: boolean;
}
interface Avail {
  id: string;
  professional_id: string;
  weekday: number;
  starts: string;
  ends: string;
}
interface Block {
  id: string;
  professional_id: string | null;
  kind: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}

async function Content() {
  const ctx = await requireStaff("services.manage");
  if (!ctx) return <NotAllowed />;
  const [s, p, ps, a, b] = await Promise.all([
    ctx.supabase
      .from("services")
      .select("id, name, duration_minutes, buffer_minutes, price_cents, self_booking, active")
      .order("name"),
    ctx.supabase.from("professionals").select("id, display_name, cro_number, cro_state, active").order("display_name"),
    ctx.supabase.from("professional_services").select("professional_id, service_id"),
    ctx.supabase
      .from("availability")
      .select("id, professional_id, weekday, starts, ends")
      .order("weekday")
      .order("starts"),
    ctx.supabase
      .from("schedule_blocks")
      .select("id, professional_id, kind, starts_at, ends_at, reason")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);
  const services = (s.data ?? []) as Service[];
  const pros = (p.data ?? []) as Professional[];
  const links = new Set(
    ((ps.data ?? []) as { professional_id: string; service_id: string }[]).map(
      (l) => `${l.professional_id}:${l.service_id}`,
    ),
  );
  const avail = (a.data ?? []) as Avail[];
  const blocks = (b.data ?? []) as Block[];
  const proName = (id: string | null) => (id ? (pros.find((x) => x.id === id)?.display_name ?? "—") : "Clínica toda");
  const proOptions = pros.filter((x) => x.active).map((x) => ({ value: x.id, label: x.display_name }));

  return (
    <div className="flex flex-col gap-14">
      <Section title="Serviços">
        {services.length === 0 && (
          <Empty>Nenhum serviço cadastrado. Cadastre os procedimentos realizados pela clínica.</Empty>
        )}
        <ul className="flex flex-col">
          {services.map((sv) => (
            <li key={sv.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-onyx/10 py-4">
              <div>
                <p className="font-semibold">
                  {sv.name} {!sv.active && <Badge>Inativo</Badge>}
                </p>
                <p className="text-sm text-mist">
                  {sv.duration_minutes} min{sv.buffer_minutes ? ` + ${sv.buffer_minutes} min de intervalo` : ""}
                  {sv.price_cents !== null && `, ${fmtMoney(sv.price_cents)}`}
                  {sv.self_booking ? ", agendável pelo portal" : ", agendado pela clínica"}
                </p>
              </div>
              <div className="flex gap-4">
                <ActionForm
                  action={toggleService}
                  hidden={{ id: sv.id, field: "self_booking", value: String(!sv.self_booking) }}
                  variant="ghost"
                  submitLabel={sv.self_booking ? "Tirar do portal" : "Liberar no portal"}
                />
                <ActionForm
                  action={toggleService}
                  hidden={{ id: sv.id, field: "active", value: String(!sv.active) }}
                  variant="ghost"
                  submitLabel={sv.active ? "Desativar" : "Reativar"}
                />
              </div>
            </li>
          ))}
        </ul>
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-olive">Cadastrar serviço</summary>
          <ActionForm action={createService} submitLabel="Cadastrar serviço" resetOnSuccess className="mt-6 max-w-2xl">
            <div className="grid gap-5 sm:grid-cols-2">
              <Input label="Nome" name="name" required className="sm:col-span-2" />
              <Input
                label="Duração (minutos)"
                name="duration"
                type="number"
                min={5}
                max={480}
                required
                defaultValue={60}
              />
              <Input label="Intervalo após (minutos)" name="buffer" type="number" min={0} max={120} defaultValue={0} />
              <Input label="Valor de referência (R$)" name="price" inputMode="decimal" placeholder="opcional" />
              <TextArea label="Descrição interna" name="description" className="sm:col-span-2" />
              <Checkbox label="Paciente pode agendar sozinho pelo portal" name="selfBooking" />
            </div>
          </ActionForm>
        </details>
      </Section>

      <Section title="Profissionais">
        {pros.length === 0 && <Empty>Cadastre ao menos um profissional para abrir a agenda.</Empty>}
        <ul className="flex flex-col">
          {pros.map((pr) => (
            <li key={pr.id} className="flex flex-col gap-3 border-b border-onyx/10 py-5">
              <p className="font-semibold">
                {pr.display_name}
                {pr.cro_number && (
                  <span className="font-normal text-mist">
                    , CRO-{pr.cro_state} {pr.cro_number}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={`Serviços de ${pr.display_name}`}>
                {services
                  .filter((x) => x.active)
                  .map((sv) => {
                    const linked = links.has(`${pr.id}:${sv.id}`);
                    return (
                      <form
                        key={sv.id}
                        action={async (fd) => {
                          "use server";
                          await toggleProfessionalService({ status: "idle" }, fd);
                        }}
                      >
                        <input type="hidden" name="professionalId" value={pr.id} />
                        <input type="hidden" name="serviceId" value={sv.id} />
                        <input type="hidden" name="link" value={String(!linked)} />
                        <button
                          type="submit"
                          aria-pressed={linked}
                          className={`min-h-9 rounded-full border px-3 text-xs ${linked ? "border-olive bg-olive text-ivory" : "border-onyx/20 text-mist hover:border-onyx/50"}`}
                        >
                          {sv.name}
                        </button>
                      </form>
                    );
                  })}
              </div>
            </li>
          ))}
        </ul>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-olive">Cadastrar profissional</summary>
          <ActionForm
            action={createProfessional}
            submitLabel="Cadastrar profissional"
            resetOnSuccess
            className="mt-6 max-w-2xl"
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Input label="Nome de exibição" name="displayName" required className="sm:col-span-3" />
              <Input label="Número do CRO" name="croNumber" inputMode="numeric" />
              <Input label="UF do CRO" name="croState" maxLength={2} />
            </div>
          </ActionForm>
        </details>
      </Section>

      <Section title="Horários de atendimento">
        <p className="text-sm text-mist">
          Grade semanal de cada profissional, no horário de Brasília. Os horários oferecidos respeitam esta grade,
          bloqueios e consultas marcadas.
        </p>
        {avail.length === 0 ? (
          <Empty>Nenhum horário cadastrado.</Empty>
        ) : (
          <ul className="flex flex-col">
            {avail.map((av) => (
              <li
                key={av.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-3 text-sm"
              >
                <span>
                  <strong className="font-semibold">{proName(av.professional_id)}</strong>, {WEEKDAYS[av.weekday]},{" "}
                  {av.starts.slice(0, 5)} às {av.ends.slice(0, 5)}
                </span>
                <ActionForm action={removeAvailability} hidden={{ id: av.id }} variant="ghost" submitLabel="Remover" />
              </li>
            ))}
          </ul>
        )}
        {proOptions.length > 0 && (
          <ActionForm action={addAvailability} submitLabel="Adicionar horário" className="max-w-3xl">
            <div className="grid gap-5 sm:grid-cols-4">
              <Select label="Profissional" name="professionalId" options={proOptions} />
              <Select
                label="Dia"
                name="weekday"
                options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
                defaultValue="1"
              />
              <Input label="Início" name="starts" type="time" defaultValue="08:00" required />
              <Input label="Fim" name="ends" type="time" defaultValue="12:00" required />
            </div>
          </ActionForm>
        )}
      </Section>

      <Section title="Feriados, ausências e bloqueios">
        {blocks.length === 0 ? (
          <Empty>Nenhum bloqueio futuro.</Empty>
        ) : (
          <ul className="flex flex-col">
            {blocks.map((bl) => (
              <li
                key={bl.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-3 text-sm"
              >
                <span>
                  <Badge tone="warn">{BLOCK_KIND[bl.kind]}</Badge>{" "}
                  <strong className="font-semibold">{proName(bl.professional_id)}</strong>, {fmtDateTime(bl.starts_at)}{" "}
                  até {fmtDateTime(bl.ends_at)}
                  {bl.reason && <span className="text-mist"> ({bl.reason})</span>}
                </span>
                <ActionForm action={removeBlock} hidden={{ id: bl.id }} variant="ghost" submitLabel="Remover" />
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addBlock} submitLabel="Registrar bloqueio" resetOnSuccess className="max-w-3xl">
          <div className="grid gap-5 sm:grid-cols-4">
            <Select
              label="Quem"
              name="professionalId"
              options={[{ value: "", label: "Clínica toda" }, ...proOptions]}
              className="sm:col-span-2"
            />
            <Select
              label="Tipo"
              name="kind"
              options={[
                { value: "holiday", label: "Feriado" },
                { value: "absence", label: "Ausência" },
                { value: "block", label: "Bloqueio" },
              ]}
              className="sm:col-span-2"
            />
            <Input label="Data inicial" name="startDate" type="date" required />
            <Input label="Hora inicial" name="startTime" type="time" hint="Vazio = dia todo" />
            <Input label="Data final" name="endDate" type="date" required />
            <Input label="Hora final" name="endTime" type="time" />
            <Input label="Motivo" name="reason" className="sm:col-span-4" />
          </div>
        </ActionForm>
      </Section>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <>
      <StudioPageHeader
        title="Serviços e horários"
        intro="Serviços oferecidos, profissionais, grade semanal e bloqueios da agenda."
      />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}
