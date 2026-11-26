"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { logHabit } from "./actions";

const AREAS = [
  "Arcada superior, lado direito",
  "Arcada superior, frente",
  "Arcada superior, lado esquerdo",
  "Arcada inferior, lado esquerdo",
  "Arcada inferior, frente",
  "Arcada inferior, lado direito",
];

/** Cronômetro de escovação guiada: percorre as regiões da boca no tempo combinado. */
export function BrushingTimer({ patientId, seconds }: { patientId: string; seconds: number }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [state, action, pending] = useActionState(logHabit, { status: "idle" } as ActionState);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const e = Math.min(seconds, Math.floor((Date.now() - startedAt.current) / 1000));
      setElapsed(e);
      if (e >= seconds) {
        setRunning(false);
        if ("vibrate" in navigator) navigator.vibrate?.(200);
      }
    }, 250);
    return () => clearInterval(t);
  }, [running, seconds]);

  const area = Math.min(AREAS.length - 1, Math.floor((elapsed / seconds) * AREAS.length));
  const remaining = seconds - elapsed;
  const done = elapsed >= seconds;
  const pct = (elapsed / seconds) * 100;

  return (
    <div className="flex flex-col items-start gap-5">
      <div className="relative grid size-44 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e9e3d7" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#414d40"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 282.7} 282.7`}
          />
        </svg>
        <p className="font-display text-4xl" role="timer" aria-live="off">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </p>
      </div>
      <p className="min-h-6 text-sm" aria-live="polite">
        {running
          ? AREAS[area]
          : done
            ? "Pronto! Tempo completo."
            : `Escovação guiada de ${Math.round(seconds / 60)} minutos pelas seis regiões da boca.`}
      </p>
      <div className="flex flex-wrap gap-3">
        {!running && !done && (
          <button
            type="button"
            className={buttonClass("solid", "min-h-11")}
            onClick={() => {
              startedAt.current = Date.now() - elapsed * 1000;
              setRunning(true);
            }}
          >
            {elapsed > 0 ? "Continuar" : "Iniciar escovação"}
          </button>
        )}
        {running && (
          <button type="button" className={buttonClass("outline", "min-h-11")} onClick={() => setRunning(false)}>
            Pausar
          </button>
        )}
        {(done || elapsed >= 30) && !running && (
          <form action={action}>
            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="kind" value="brushing" />
            <input type="hidden" name="guided" value={elapsed} />
            <button type="submit" disabled={pending} className={buttonClass("solid", "min-h-11")}>
              {pending ? "Registrando" : "Registrar escovação"}
            </button>
          </form>
        )}
        {elapsed > 0 && !running && (
          <button type="button" className="text-sm text-olive underline" onClick={() => setElapsed(0)}>
            Recomeçar
          </button>
        )}
      </div>
      <span aria-live="polite" className="text-sm">
        {state.status === "success" && <span className="text-olive">{state.message}</span>}
        {state.status === "error" && (
          <span role="alert" className="text-danger">
            {state.message}
          </span>
        )}
      </span>
    </div>
  );
}
