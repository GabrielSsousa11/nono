"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { roleLabel, STAFF_ROLES, type StaffRole } from "@/lib/auth/access";
import { changeStaffRole, inviteStaff, resetStaffMfa } from "./team-actions";
import type { TeamActionState } from "./team-schema";

const idle: TeamActionState = { status: "idle" };

function Feedback({ state }: { state: TeamActionState }) {
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

export function InviteStaffForm({ adminApiReady }: { adminApiReady: boolean }) {
  const [state, action, pending] = useActionState(inviteStaff, idle);
  if (!adminApiReady) {
    return (
      <p role="status" className="border-l-2 border-gold pl-4 text-sm text-mist">
        Convites ficam disponíveis quando a chave administrativa do servidor (SUPABASE_SERVICE_ROLE_KEY) for configurada
        no ambiente de hospedagem.
      </p>
    );
  }
  return (
    <form
      action={action}
      className="grid gap-6 sm:grid-cols-2"
      key={state.status === "success" ? state.message : "form"}
    >
      <Field label="Nome completo">
        {({ id }) => <input id={id} name="fullName" required autoComplete="off" className={inputClass} />}
      </Field>
      <Field label="E-mail">
        {({ id }) => <input id={id} name="email" type="email" required autoComplete="off" className={inputClass} />}
      </Field>
      <Field label="Função">
        {({ id }) => (
          <select id={id} name="role" required defaultValue="" className={`${inputClass} cursor-pointer`}>
            <option value="" disabled>
              Escolha
            </option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="flex items-end">
        <button type="submit" className={buttonClass("solid")} disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {pending ? "Enviando convite" : "Enviar convite"}
        </button>
      </div>
      <div className="sm:col-span-2" aria-live="polite">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RoleToggles({ userId, roles, name }: { userId: string; roles: StaffRole[]; name: string }) {
  const [state, action, pending] = useActionState(changeStaffRole, idle);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-mist">Toque em uma função para adicioná-la ou removê-la.</p>
      <div role="group" aria-label={`Funções de ${name}`} className="flex flex-wrap gap-2">
        {STAFF_ROLES.map((r) => {
          const has = roles.includes(r);
          return (
            <form key={r} action={action}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="role" value={r} />
              <input type="hidden" name="grant" value={String(!has)} />
              <button
                type="submit"
                disabled={pending}
                aria-pressed={has}
                aria-label={`${roleLabel[r]}: ${has ? "remover" : "adicionar"}`}
                className={`min-h-9 rounded-full border px-3 text-xs transition-colors disabled:opacity-50 ${
                  has ? "border-olive bg-olive text-ivory" : "border-onyx/20 text-mist hover:border-onyx/50"
                }`}
              >
                {roleLabel[r]}
              </button>
            </form>
          );
        })}
      </div>
      <Feedback state={state} />
    </div>
  );
}

export function ResetMfaButton({
  userId,
  name,
  adminApiReady,
}: {
  userId: string;
  name: string;
  adminApiReady: boolean;
}) {
  const [state, action, pending] = useActionState(resetStaffMfa, idle);
  if (!adminApiReady) return null;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !window.confirm(`Redefinir a verificação em duas etapas de ${name}? O autenticador atual deixa de funcionar.`)
        )
          e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="self-start text-xs text-olive underline decoration-gold underline-offset-4"
      >
        {pending ? "Redefinindo…" : "Redefinir verificação em duas etapas"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
