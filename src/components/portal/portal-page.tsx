import type { ReactNode } from "react";

export function PortalHeading({ title, intro, who }: { title: string; intro?: ReactNode; who?: string | null }) {
  return (
    <header className="mb-10 flex flex-col gap-3">
      <span className="gold-rule" aria-hidden />
      <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-none tracking-[-0.02em]">{title}</h1>
      {who && <p className="text-sm text-mist">Acompanhando: {who}</p>}
      {intro && <p className="max-w-2xl text-mist">{intro}</p>}
    </header>
  );
}

export function NoPatientLinked() {
  return (
    <p className="max-w-xl text-mist">
      Sua conta ainda não está vinculada a um cadastro de paciente. A clínica faz esse vínculo; se você já é paciente,
      fale com a recepção.
    </p>
  );
}

export function PortalLoading() {
  return (
    <div aria-busy="true" className="h-40 animate-pulse bg-stone/60">
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
