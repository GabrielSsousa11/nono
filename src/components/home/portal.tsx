import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Monogram } from "@/components/ui/monogram";
import { platformModules, statusLabel } from "@/lib/modules";
import { Container, SectionHeading } from "./section";

/** Apresentação do portal exclusivo — o status de cada módulo vem de src/lib/modules.ts. */
export function Portal() {
  return (
    <section id="portal" aria-labelledby="portal-title" className="stone on-dark bg-onyx text-ivory">
      <Container className="grid gap-16 py-28 sm:py-36 lg:grid-cols-12">
        <div className="flex flex-col gap-10 lg:col-span-5">
          <SectionHeading
            id="portal-title"
            tone="dark"
            title="Seu tratamento, também fora do consultório"
            intro="Um portal privado, exclusivo para pacientes da clínica, para acompanhar etapas, orientações e cuidados diários. Cada módulo é liberado pela clínica conforme o seu tratamento."
          />
          <div className="flex flex-col gap-3 xs:flex-row xs:items-center">
            <Link href="/entrar" className={buttonClass("light")}>
              Entrar na área do paciente
            </Link>
          </div>
          <p className="max-w-sm text-sm text-champagne/90">
            O acesso é liberado pela clínica para pacientes cadastrados. Dados de saúde ficam visíveis apenas para você,
            seus responsáveis autorizados e a equipe que cuida do seu tratamento.
          </p>
        </div>

        <ul className="grid gap-x-12 self-start sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          {platformModules.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 border-t border-ivory/15 py-7">
              <div className="flex items-center justify-between gap-4">
                <h3 className="flex items-center gap-3 text-base font-semibold text-ivory">
                  <Monogram className="size-6 text-gold" />
                  {m.name}
                </h3>
                <span
                  className={`shrink-0 rounded-full border px-3 py-0.5 text-xs ${
                    m.status === "available" ? "border-gold text-gold" : "border-ivory/20 text-champagne"
                  }`}
                >
                  {statusLabel[m.status]}
                </span>
              </div>
              <p className="text-sm text-champagne">{m.description}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
