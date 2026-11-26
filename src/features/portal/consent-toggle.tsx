"use client";

import { useActionState } from "react";
import { setConsent, type ConsentActionState } from "./consent-actions";

export function ConsentToggle({
  patientId,
  kind,
  active,
  title,
}: {
  patientId: string;
  kind: string;
  active: boolean;
  title: string;
}) {
  const [state, action, pending] = useActionState<ConsentActionState, FormData>(setConsent, { status: "idle" });
  const current = state.status === "saved" ? state.granted : active;
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="granted" value={String(!current)} />
      <button
        type="submit"
        role="switch"
        aria-checked={current}
        aria-label={title}
        disabled={pending}
        className={`relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors duration-300 disabled:opacity-60 ${
          current ? "border-olive bg-olive" : "border-mist bg-transparent"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 left-0.5 size-6 rounded-full transition-transform duration-300 ease-silk ${
            current ? "translate-x-6 bg-ivory" : "bg-mist"
          }`}
        />
      </button>
      <span aria-live="polite" className="text-xs">
        {state.status === "saved" && <span className="text-olive">{state.granted ? "Autorizado" : "Revogado"}</span>}
        {state.status === "error" && <span className="text-danger">{state.message}</span>}
      </span>
    </form>
  );
}
