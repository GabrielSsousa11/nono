import type { ReactNode } from "react";

export function StudioPageHeader({ title, intro }: { title: string; intro?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-col gap-4">
      <span className="gold-rule" aria-hidden />
      <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] leading-none tracking-[-0.02em]">{title}</h1>
      {intro && <p className="max-w-2xl text-mist">{intro}</p>}
    </header>
  );
}

export function LoadingRows() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse bg-stone/70" />
      ))}
    </div>
  );
}
