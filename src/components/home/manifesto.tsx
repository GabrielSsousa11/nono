import { Container } from "./section";

/**
 * Manifesto — texto de marca escrito a partir do conceito "Beyond the Smile".
 * Não contém afirmações factuais sobre a clínica; requer aprovação final
 * (docs/CONTENT_VERIFICATION.md).
 */
export function Manifesto() {
  return (
    <section id="manifesto" aria-labelledby="manifesto-title" className="stone on-dark bg-olive text-ivory">
      <Container className="grid gap-12 py-28 sm:py-36 lg:grid-cols-12 lg:py-44">
        <div className="lg:col-span-3">
          <span className="gold-rule" aria-hidden />
          <h2 id="manifesto-title" className="font-display mt-6 text-2xl text-champagne">
            Manifesto
          </h2>
        </div>
        <div className="lg:col-span-8 lg:col-start-5">
          <p className="font-display text-[clamp(1.75rem,3.4vw,3.05rem)] leading-[1.18] tracking-[-0.01em] text-ivory">
            Um sorriso guarda conversas, viagens, retratos de família e silêncios. Antes de qualquer procedimento,
            existe uma pessoa e a história que ela carrega no rosto.
          </p>
          <div className="mt-14 grid gap-10 text-base text-champagne sm:grid-cols-2 sm:gap-12">
            <p>
              Por isso o cuidado começa pela escuta. Cada decisão é explicada com calma, cada etapa tem um porquê, e
              nada é feito sem que você entenda o caminho.
            </p>
            <p>
              Precisão técnica e acolhimento não disputam espaço: um sustenta o outro. É o que chamamos de ir além do
              sorriso.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
