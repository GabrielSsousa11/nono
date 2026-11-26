"use client";

import { useActionState } from "react";
import { updateBookingRequestStatus, type StatusUpdateState } from "./booking-requests";
import { BOOKING_STATUSES, bookingStatusLabel, type BookingStatus } from "./booking-status";

export function BookingStatusForm({ id, status, label }: { id: string; status: BookingStatus; label: string }) {
  const [state, action, pending] = useActionState<StatusUpdateState, FormData>(updateBookingRequestStatus, {
    status: "idle",
  });
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`status-${id}`}>
        Situação do pedido de {label}
      </label>
      <select
        id={`status-${id}`}
        name="status"
        defaultValue={status}
        className="min-h-10 cursor-pointer rounded-full border border-onyx/20 bg-transparent px-3 text-sm"
      >
        {BOOKING_STATUSES.map((s) => (
          <option key={s} value={s}>
            {bookingStatusLabel[s]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="min-h-10 rounded-full bg-olive px-4 text-sm text-ivory disabled:opacity-50"
      >
        {pending ? "Salvando" : "Salvar"}
      </button>
      <span aria-live="polite" className="text-xs">
        {state.status === "saved" && <span className="text-olive">Salvo</span>}
        {state.status === "error" && <span className="text-danger">{state.message}</span>}
      </span>
    </form>
  );
}
