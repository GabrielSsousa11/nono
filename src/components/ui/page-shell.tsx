import Link from "next/link";
import type { ReactNode } from "react";
import { Monogram } from "./monogram";

/** Moldura das páginas internas simples (login, privacidade, offline). */
export function PageShell({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="paper flex min-h-dvh flex-col">
      <header className="mx-auto flex h-[var(--header-h)] w-full max-w-[88rem] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3 text-onyx" aria-label="Voltar para a página inicial">
          <Monogram className="size-9" />
          <span className="font-display text-[1.35rem]">Charlene Gonçalves</span>
        </Link>
        {aside}
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-[88rem] flex-1 px-5 pt-12 pb-24 sm:px-8 lg:px-12">
        {children}
      </main>
    </div>
  );
}
