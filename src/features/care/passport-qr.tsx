"use client";

/* eslint-disable @next/next/no-img-element -- QR Code gerado na hora como SVG */
import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { fmtTime } from "@/lib/datetime";
import { issueCheckin } from "./actions";

export function PassportQr({ appointmentId }: { appointmentId: string }) {
  const [state, action, pending] = useActionState(issueCheckin, { status: "idle" } as ActionState);
  const data = state.status === "success" ? (state.data as { svg: string; expiresAt: string; code: string }) : null;
  return (
    <div className="flex flex-col items-start gap-4">
      {data ? (
        <figure className="flex flex-col items-start gap-2">
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(data.svg)}`}
            alt="QR Code de check-in"
            className="size-56 rounded bg-white p-2"
          />
          <figcaption className="text-sm text-mist">
            Mostre na recepção. Válido até {fmtTime(data.expiresAt)}. O código não contém dados pessoais.
          </figcaption>
        </figure>
      ) : null}
      <form action={action}>
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <button type="submit" disabled={pending} className={buttonClass(data ? "outline" : "solid", "min-h-11")}>
          {pending ? "Gerando" : data ? "Gerar novo código" : "Gerar QR Code de check-in"}
        </button>
      </form>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}
