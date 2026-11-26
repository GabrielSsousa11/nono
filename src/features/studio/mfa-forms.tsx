"use client";

import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import {
  confirmTotpEnrollment,
  startTotpEnrollment,
  verifyTotp,
  type EnrollState,
  type VerifyState,
} from "./mfa-actions";

function CodeField({ error }: { error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="totp-code" className="text-sm font-medium text-olive">
        Código de 6 números
      </label>
      <input
        id="totp-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        className={`${inputClass} max-w-48 text-2xl tracking-[0.4em]`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "totp-error" : undefined}
      />
      {error && (
        <p id="totp-error" role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function EnrollTotp() {
  const [enroll, setEnroll] = useState<EnrollState>({ status: "idle" });
  const [starting, startTransition] = useTransition();
  const [verify, verifyAction, verifying] = useActionState<VerifyState, FormData>(confirmTotpEnrollment, {
    status: "idle",
  });

  if (enroll.status !== "ready") {
    return (
      <div className="flex flex-col items-start gap-4">
        {enroll.status === "error" && (
          <p role="alert" className="text-sm font-medium text-danger">
            {enroll.message}
          </p>
        )}
        <button
          type="button"
          className={buttonClass("solid")}
          disabled={starting}
          onClick={() => startTransition(async () => setEnroll(await startTotpEnrollment()))}
        >
          {starting ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <KeyRound aria-hidden className="size-4" />
          )}
          {starting ? "Gerando QR Code" : "Gerar QR Code"}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-10 md:grid-cols-[auto_1fr]">
      <figure className="flex flex-col gap-3">
        {/* QR Code em SVG (data URL) gerado pelo Supabase Auth. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enroll.qrCode}
          alt="QR Code para cadastrar o CG Studio no aplicativo autenticador"
          className="size-52 bg-white p-2"
        />
        <figcaption className="max-w-52 text-xs text-mist">
          Não consegue ler? Digite a chave no aplicativo:
          <code className="mt-1 block font-mono text-xs break-all text-onyx select-all">{enroll.secret}</code>
        </figcaption>
      </figure>
      <form action={verifyAction} className="flex flex-col gap-6">
        <input type="hidden" name="factorId" value={enroll.factorId} />
        <ol className="list-decimal space-y-2 pl-5 text-sm text-onyx/85">
          <li>Abra um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
          <li>Leia o QR Code ao lado.</li>
          <li>Digite o código de 6 números que aparecer.</li>
        </ol>
        <CodeField error={verify.status === "error" ? verify.message : undefined} />
        <button type="submit" className={buttonClass("solid", "self-start")} disabled={verifying}>
          {verifying ? (
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
          ) : (
            <ShieldCheck aria-hidden className="size-4" />
          )}
          {verifying ? "Confirmando" : "Confirmar e entrar"}
        </button>
      </form>
    </div>
  );
}

export function VerifyTotpForm() {
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyTotp, { status: "idle" });
  return (
    <form action={action} className="flex flex-col gap-6">
      <CodeField error={state.status === "error" ? state.message : undefined} />
      <button type="submit" className={buttonClass("solid", "self-start")} disabled={pending}>
        {pending ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : (
          <ShieldCheck aria-hidden className="size-4" />
        )}
        {pending ? "Verificando" : "Verificar"}
      </button>
    </form>
  );
}
