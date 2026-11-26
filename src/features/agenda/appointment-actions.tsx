import { ActionForm, Input } from "@/components/ui/action-form";
import { setAppointmentStatus } from "./actions";
import { RescheduleWidget } from "./booking-widgets";

const NEXT: Record<string, { status: string; label: string }[]> = {
  scheduled: [
    { status: "confirmed", label: "Confirmar" },
    { status: "checked_in", label: "Registrar chegada" },
    { status: "no_show", label: "Marcar falta" },
  ],
  confirmed: [
    { status: "checked_in", label: "Registrar chegada" },
    { status: "no_show", label: "Marcar falta" },
  ],
  checked_in: [{ status: "completed", label: "Concluir atendimento" }],
  no_show: [{ status: "scheduled", label: "Desfazer falta" }],
  cancelled: [{ status: "scheduled", label: "Reabrir" }],
};

/** Ações da equipe sobre uma consulta (o banco valida cada transição). */
export function StaffAppointmentActions({
  id,
  status,
  professionalId,
  serviceId,
  canWrite,
}: {
  id: string;
  status: string;
  professionalId: string;
  serviceId: string;
  canWrite: boolean;
}) {
  if (!canWrite) return null;
  const active = status === "scheduled" || status === "confirmed";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {(NEXT[status] ?? []).map((n) => (
          <ActionForm
            key={n.status}
            action={setAppointmentStatus}
            hidden={{ id, status: n.status }}
            variant="ghost"
            submitLabel={n.label}
          />
        ))}
      </div>
      {active && (
        <div className="flex flex-wrap gap-6">
          <details>
            <summary className="cursor-pointer text-sm text-olive">Remarcar</summary>
            <div className="mt-4">
              <RescheduleWidget appointmentId={id} professionalId={professionalId} serviceId={serviceId} />
            </div>
          </details>
          <details>
            <summary className="cursor-pointer text-sm text-danger">Cancelar</summary>
            <ActionForm
              action={setAppointmentStatus}
              hidden={{ id, status: "cancelled" }}
              submitLabel="Cancelar consulta"
              variant="outline"
              className="mt-4 max-w-sm"
            >
              <Input label="Motivo do cancelamento" name="reason" required />
            </ActionForm>
          </details>
        </div>
      )}
    </div>
  );
}
