"use client";

import { LoaderCircle, MailCheck } from "lucide-react";
import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { sendMagicLink, type MagicLinkState } from "./actions";

export function MagicLinkForm() {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col gap-4">
        <MailCheck aria-hidden className="size-8 text-olive" />
        <p className="font-display text-2xl text-onyx">Verifique seu e-mail.</p>
        <p className="text-mist">
          Se este endereço estiver cadastrado na clínica, você receberá um link de acesso válido por alguns minutos.
          Abra-o neste mesmo aparelho.
        </p>
      </div>
    );
  }

  const message = state.status === "idle" ? null : state.message;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium text-olive">
          E-mail cadastrado na clínica
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className={inputClass}
          aria-invalid={state.status === "invalid"}
          aria-describedby={message ? "login-message" : undefined}
        />
      </div>
      {message && (
        <p id="login-message" role="alert" className="text-sm font-medium text-danger">
          {message}
        </p>
      )}
      <button type="submit" className={buttonClass("solid")} disabled={pending}>
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {pending ? "Enviando link" : "Receber link de acesso"}
      </button>
    </form>
  );
}
