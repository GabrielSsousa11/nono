import type { ReactNode } from "react";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border-l-2 border-gold/70 py-1 pl-4 text-sm text-mist">{children}</p>;
}

export function Section({ title, children, aside, id }: { title: string; children: ReactNode; aside?: ReactNode; id?: string }) {
  const hid = id ?? `s-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={hid} className="flex flex-col gap-5 border-t border-onyx/10 pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={hid} className="font-display text-[1.75rem] leading-tight">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "border-onyx/20 text-mist",
    good: "border-olive bg-olive text-ivory",
    warn: "border-gold-ink text-gold-ink",
    bad: "border-danger text-danger",
  };
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

export function NotAllowed() {
  return <p className="text-mist">Você não tem permissão para acessar esta área.</p>;
}
