import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { PageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = { title: "Sem conexão", robots: { index: false } };

/** Exibida pelo service worker quando não há conexão. Não contém dados pessoais. */
export default function OfflinePage() {
  return (
    <PageShell>
      <div className="flex max-w-xl flex-col gap-6 pt-10">
        <WifiOff aria-hidden className="size-8 text-gold-ink" />
        <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-none">Você está sem conexão.</h1>
        <p className="text-mist">
          Verifique o Wi-Fi ou os dados móveis e tente novamente. Por segurança, informações do seu tratamento não ficam
          salvas no aparelho e só aparecem com conexão.
        </p>
        {/* <a> intencional: recarga completa da página ao voltar a conexão. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="self-start text-olive underline decoration-gold underline-offset-4">
          Tentar novamente
        </a>
      </div>
    </PageShell>
  );
}
