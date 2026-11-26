import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { FaqItem } from "@/lib/content";
import { Container, SectionHeading } from "./section";

/**
 * Perguntas sobre o funcionamento da plataforma — verdadeiras por construção,
 * pois descrevem o próprio sistema. Perguntas sobre políticas da clínica vêm
 * do conteúdo verificado (`clinicFaq`).
 */
const PLATFORM_FAQ: { question: string; answer: ReactNode }[] = [
  {
    question: "Como funciona o pedido de agendamento pelo site?",
    answer:
      "Você informa nome, telefone e o período de sua preferência. A equipe da clínica entra em contato para confirmar dia e horário. O pedido não garante a consulta até essa confirmação.",
  },
  {
    question: "Como acesso a área do paciente?",
    answer:
      "O acesso é liberado pela clínica para pacientes cadastrados. Você recebe um link de entrada no e-mail informado no cadastro, sem precisar criar ou lembrar senha.",
  },
  {
    question: "Como meus dados são protegidos?",
    answer: (
      <>
        Dados de saúde são dados pessoais sensíveis pela LGPD. A plataforma restringe o acesso por função, mantém
        documentos em armazenamento privado e registra quem acessou cada informação. Os detalhes estão na{" "}
        <Link href="/privacidade" className="underline decoration-gold underline-offset-4">
          política de privacidade
        </Link>
        .
      </>
    ),
  },
  {
    question: "Posso instalar o portal no celular?",
    answer:
      "Sim. No navegador do celular, abra o menu e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”. O portal abre como um aplicativo, sem passar por lojas.",
  },
];

export function Faq({ clinicFaq }: { clinicFaq: FaqItem[] }) {
  const items = [...clinicFaq.map((f) => ({ question: f.question, answer: f.answer as ReactNode })), ...PLATFORM_FAQ];
  return (
    <section id="duvidas" aria-labelledby="duvidas-title" className="paper">
      <Container className="grid gap-14 py-28 sm:py-36 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHeading id="duvidas-title" title="Perguntas frequentes" />
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          {items.map((item) => (
            <details key={item.question} className="group border-t border-onyx/10 last:border-b">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
                <span className="font-display text-[1.6rem] leading-snug text-onyx">{item.question}</span>
                <Plus
                  aria-hidden
                  className="mt-2 size-5 shrink-0 text-gold-ink transition-transform duration-500 ease-silk group-open:rotate-45"
                />
              </summary>
              <div className="max-w-[38rem] pb-8 text-onyx/80">{item.answer}</div>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
