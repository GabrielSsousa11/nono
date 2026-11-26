import type { ReactNode } from "react";

/** Cabeçalho editorial de seção: fio dourado + título serifado + abertura opcional. */
export function SectionHeading({
  id,
  title,
  intro,
  tone = "light",
  className = "",
}: {
  id: string;
  title: ReactNode;
  intro?: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <span className="gold-rule" aria-hidden />
      <h2
        id={id}
        className={`font-display text-[clamp(2.25rem,4.6vw,4rem)] leading-[1.02] tracking-[-0.02em] ${
          tone === "dark" ? "text-ivory" : "text-onyx"
        }`}
      >
        {title}
      </h2>
      {intro && (
        <p className={`max-w-[34rem] text-base ${tone === "dark" ? "text-champagne" : "text-mist"}`}>{intro}</p>
      )}
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[88rem] px-5 sm:px-8 lg:px-12 ${className}`}>{children}</div>;
}

/**
 * Aviso visível SOMENTE fora de produção: indica conteúdo aguardando dados
 * oficiais. Em produção a seção correspondente simplesmente não é renderizada.
 */
export function PendingNotice({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <div className="border border-dashed border-gold-ink/50 bg-porcelain/60 px-5 py-4 text-sm text-gold-ink">
      <strong className="font-semibold">Pendente de dados oficiais.</strong> {children}
    </div>
  );
}
