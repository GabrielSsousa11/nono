import { useId, type ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
  className?: string;
}

/** Campo de formulário acessível: rótulo, dica e erro associados via aria-describedby. */
export function Field({ label, hint, error, optional, children, className = "" }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-olive">
        {label}
        {optional && <span className="font-normal text-mist"> (opcional)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-mist">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-none border-0 border-b border-onyx/25 bg-transparent px-0 py-3 text-base text-onyx placeholder:text-mist/70 transition-colors duration-300 hover:border-onyx/50 focus:border-olive focus:outline-none focus-visible:outline-none focus:ring-0 aria-[invalid=true]:border-danger";
