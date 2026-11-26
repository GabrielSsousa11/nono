"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { CLINIC_TZ, fmtTime, localDate } from "@/lib/datetime";
import { bookAppointment, getSlots, professionalsFor, rescheduleAppointment, searchPatients } from "./actions";

const fieldClass =
  "w-full cursor-pointer rounded-none border-0 border-b border-onyx/25 bg-transparent px-0 py-2.5 text-base focus:border-olive focus:ring-0 focus:outline-none";

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm ${state.status === "error" ? "font-medium text-danger" : "text-olive"}`}
    >
      {state.message}
    </p>
  );
}

/** Lista de horários livres como botões de rádio acessíveis. */
function SlotPicker({
  professionalId,
  serviceId,
  name = "startsAt",
}: {
  professionalId: string;
  serviceId: string;
  name?: string;
}) {
  const today = localDate(new Date());
  const [day, setDay] = useState(today);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, start] = useTransition();

  useEffect(() => {
    if (!professionalId || !serviceId || !day) return;
    start(async () => {
      const r = await getSlots(professionalId, serviceId, day);
      setSlots(r.slots);
      setError(r.error);
    });
  }, [professionalId, serviceId, day]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-xs flex-col gap-1.5">
        <label htmlFor={`${name}-day`} className="text-sm font-medium text-olive">
          Data
        </label>
        <input
          id={`${name}-day`}
          type="date"
          min={today}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className={fieldClass}
        />
      </div>
      <fieldset aria-busy={loading} className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-olive">Horários livres (horário de Brasília)</legend>
        {loading && (
          <p className="flex items-center gap-2 text-sm text-mist">
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> Buscando horários…
          </p>
        )}
        {!loading && error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        {!loading && !error && slots?.length === 0 && (
          <p className="text-sm text-mist">Nenhum horário livre nesta data. Tente outro dia.</p>
        )}
        {!loading && slots && slots.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <label key={s} className="cursor-pointer">
                <input type="radio" name={name} value={s} required className="peer sr-only" />
                <span className="inline-flex min-h-10 items-center rounded-full border border-onyx/20 px-4 text-sm peer-checked:border-olive peer-checked:bg-olive peer-checked:text-ivory peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-ink">
                  {fmtTime(s)}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
}

export function BookingWidget({
  services,
  patients,
  allowSearch = false,
  bookingRequestId,
  submitLabel = "Agendar consulta",
}: {
  services: { id: string; name: string; duration: number }[];
  /** Pacientes fixos (portal: a pessoa e dependentes). */
  patients?: { id: string; name: string }[];
  /** Busca de pacientes (Studio). */
  allowSearch?: boolean;
  bookingRequestId?: string;
  submitLabel?: string;
}) {
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(
    async (prev: ActionState, fd: FormData) => {
      const result = await bookAppointment(prev, fd);
      if (result.status === "success") setFormKey((k) => k + 1);
      return result;
    },
    { status: "idle" } as ActionState,
  );
  const [serviceId, setServiceId] = useState("");
  const [pros, setPros] = useState<{ id: string; name: string }[]>([]);
  const [professionalId, setProfessionalId] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; detail: string }[]>([]);
  const [patientId, setPatientId] = useState(patients?.length === 1 ? patients[0].id : "");
  const [, start] = useTransition();

  useEffect(() => {
    if (!serviceId) return;
    start(async () => {
      const list = await professionalsFor(serviceId);
      setPros(list);
      setProfessionalId(list.length === 1 ? list[0].id : "");
    });
  }, [serviceId]);

  useEffect(() => {
    if (!allowSearch || query.trim().length < 2) return;
    const t = setTimeout(() => start(async () => setFound(await searchPatients(query))), 250);
    return () => clearTimeout(t);
  }, [query, allowSearch]);

  return (
    <form key={formKey} action={action} className="flex flex-col gap-6">
      {bookingRequestId && <input type="hidden" name="bookingRequestId" value={bookingRequestId} />}
      <input type="hidden" name="patientId" value={patientId} />
      {allowSearch && (
        <div className="flex flex-col gap-2">
          <label htmlFor="patient-search" className="text-sm font-medium text-olive">
            Paciente
          </label>
          <input
            id="patient-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPatientId("");
            }}
            placeholder="Digite nome ou telefone"
            autoComplete="off"
            className={fieldClass}
          />
          {!patientId && found.length > 0 && (
            <ul role="listbox" aria-label="Pacientes encontrados" className="flex flex-col border border-onyx/10">
              {found.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-stone"
                    onClick={() => {
                      setPatientId(p.id);
                      setQuery(p.name);
                      setFound([]);
                    }}
                  >
                    {p.name} <span className="text-mist">{p.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {allowSearch && query.length >= 2 && !patientId && found.length === 0 && (
            <p className="text-xs text-mist">Nenhum paciente encontrado. Cadastre em Pacientes.</p>
          )}
        </div>
      )}
      {patients && patients.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="patient-fixed" className="text-sm font-medium text-olive">
            Para quem é a consulta
          </label>
          <select
            id="patient-fixed"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className={fieldClass}
            required
          >
            <option value="" disabled>
              Escolha
            </option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="service" className="text-sm font-medium text-olive">
            Serviço
          </label>
          <select
            id="service"
            name="serviceId"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={fieldClass}
            required
          >
            <option value="" disabled>
              Escolha
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration} min)
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="professional" className="text-sm font-medium text-olive">
            Profissional
          </label>
          <select
            id="professional"
            name="professionalId"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            className={fieldClass}
            required
            disabled={!serviceId}
          >
            <option value="" disabled>
              {serviceId && pros.length === 0 ? "Nenhum profissional para este serviço" : "Escolha"}
            </option>
            {pros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {serviceId && professionalId && <SlotPicker professionalId={professionalId} serviceId={serviceId} />}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending || !patientId || !professionalId}
          className={buttonClass("solid", "min-h-11")}
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {pending ? "Agendando" : submitLabel}
        </button>
        <Feedback state={state} />
      </div>
      <p className="text-xs text-mist">Horários exibidos no fuso {CLINIC_TZ.replace("_", " ")}.</p>
    </form>
  );
}

export function RescheduleWidget({
  appointmentId,
  professionalId,
  serviceId,
}: {
  appointmentId: string;
  professionalId: string;
  serviceId: string;
}) {
  const [state, action, pending] = useActionState(rescheduleAppointment, { status: "idle" } as ActionState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={appointmentId} />
      <SlotPicker professionalId={professionalId} serviceId={serviceId} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={buttonClass("outline", "min-h-11")}>
          {pending ? "Remarcando" : "Confirmar novo horário"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
