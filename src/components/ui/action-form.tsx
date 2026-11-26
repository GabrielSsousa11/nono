"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { buttonClass } from "./button";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Formulário padrão das áreas logadas: envia para uma Server Action, mostra
 * carregamento, sucesso e erro (anunciados a leitores de tela) e limpa os
 * campos após sucesso quando `resetOnSuccess`.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className = "",
  resetOnSuccess = false,
  variant = "solid",
  confirm,
  hidden,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  variant?: "solid" | "outline" | "ghost";
  confirm?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success" && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={`flex flex-col gap-5 ${className}`}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass(variant, variant === "ghost" ? "" : "min-h-11")}
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {pending ? (pendingLabel ?? "Salvando") : submitLabel}
        </button>
        <span aria-live="polite" className="text-sm">
          {state.status === "success" && <span className="text-olive">{state.message}</span>}
          {state.status === "error" && (
            <span role="alert" className="font-medium text-danger">
              {state.message}
            </span>
          )}
        </span>
      </div>
    </form>
  );
}

/** Campo simples com rótulo (para formulários de ActionForm). */
export function Input({
  label,
  name,
  hint,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string }) {
  const id = `f-${name}-${props.id ?? ""}`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-olive">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="w-full rounded-none border-0 border-b border-onyx/25 bg-transparent px-0 py-2.5 text-base text-onyx focus:border-olive focus:ring-0 focus:outline-none"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-mist">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  name: string;
  options: { value: string; label: string }[];
}) {
  const id = `f-${name}-${props.id ?? ""}`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-olive">
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="w-full cursor-pointer rounded-none border-0 border-b border-onyx/25 bg-transparent px-0 py-2.5 text-base text-onyx focus:border-olive focus:ring-0 focus:outline-none"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function TextArea({
  label,
  name,
  hint,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string; hint?: string }) {
  const id = `f-${name}-${props.id ?? ""}`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-olive">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        className="w-full resize-y rounded-none border-0 border-b border-onyx/25 bg-transparent px-0 py-2.5 text-base text-onyx focus:border-olive focus:ring-0 focus:outline-none"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-mist">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  name,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-onyx">
      <input type="checkbox" name={name} value="on" className="mt-0.5 size-4 shrink-0 accent-olive" {...props} />
      <span>{label}</span>
    </label>
  );
}
