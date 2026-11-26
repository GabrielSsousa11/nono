import Link from "next/link";
import { Fragment } from "react";
import { buttonClass } from "@/components/ui/button";
import { HeroTooth } from "@/components/three/hero-tooth";

const LINES = [
  { text: "Cuidar do seu", indent: "" },
  { text: "sorriso é cuidar", indent: "sm:pl-[12%]" },
  { text: "da sua história.", indent: "sm:pl-[4%]" },
];

/**
 * O único momento coreografado da página: as linhas do título sobem uma a uma
 * enquanto o molar de porcelana surge. Animação em CSS puro (não depende de
 * hidratação → não atrasa o LCP). O resto da página é deliberadamente quieto.
 */
export function Hero({ clinicName }: { clinicName: string }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="paper relative flex min-h-[100svh] flex-col overflow-hidden pt-[var(--header-h)]"
    >
      <div className="mx-auto grid w-full max-w-[88rem] flex-1 grid-cols-1 items-center gap-y-2 px-5 sm:px-8 lg:grid-cols-12 lg:px-12">
        <div className="relative z-10 order-2 pb-14 lg:order-1 lg:col-span-7 lg:pb-0">
          <h1
            id="hero-title"
            className="font-display text-[clamp(2.9rem,7.6vw,7.4rem)] leading-[0.96] tracking-[-0.025em] text-onyx"
          >
            {LINES.map((line, i) => (
              <Fragment key={line.text}>
                <span className={`block overflow-hidden pb-[0.08em] ${line.indent}`}>
                  <span className="hero-line block" style={{ animationDelay: `${120 + i * 130}ms` }}>
                    {line.text}
                  </span>
                </span>
                {/* Espaço real entre as linhas: leitores de tela e buscadores leem a frase corretamente. */}
                {i < LINES.length - 1 && " "}
              </Fragment>
            ))}
          </h1>

          <div
            className="hero-fade mt-10 flex max-w-xl flex-col gap-8 sm:mt-12 sm:pl-[4%]"
            style={{ animationDelay: "700ms" }}
          >
            <div className="flex items-center gap-4">
              <span className="gold-rule" aria-hidden />
              <p className="text-sm text-mist">{clinicName}</p>
            </div>
            <div className="flex flex-col gap-3 xs:flex-row xs:items-center xs:gap-6">
              <a href="#agendamento" className={buttonClass("solid")}>
                Agendar avaliação
              </a>
              <Link href="/entrar" className={buttonClass("ghost", "self-start xs:self-auto")}>
                Área do paciente
              </Link>
            </div>
          </div>
        </div>

        <div
          className="hero-rise relative order-1 -mx-5 h-[44svh] min-h-72 sm:mx-0 lg:order-2 lg:col-span-5 lg:h-[78svh]"
          style={{ animationDelay: "250ms" }}
        >
          <HeroTooth />
        </div>
      </div>

      <p
        aria-hidden
        className="font-display pointer-events-none absolute right-6 bottom-10 hidden text-lg tracking-[0.3em] text-gold-ink/80 [writing-mode:vertical-rl] lg:block xl:right-10"
      >
        Beyond the Smile
      </p>
    </section>
  );
}
