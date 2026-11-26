import { PageShell } from "@/components/ui/page-shell";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex max-w-xl flex-col gap-6 pt-10">
        <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-none">Página não encontrada.</h1>
        <p className="text-mist">O endereço pode ter mudado. Volte para a página inicial para continuar.</p>
        <ButtonLink href="/" className="self-start">
          Ir para a página inicial
        </ButtonLink>
      </div>
    </PageShell>
  );
}
