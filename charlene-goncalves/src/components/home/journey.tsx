import { Container, SectionHeading } from "./section";

/**
 * Jornada do paciente. Os passos 1–2 descrevem exatamente como o pedido pelo
 * site funciona; os demais, o fluxo clínico geral (sem promessa de resultado).
 */
const STEPS = [
  {
    title: "Pedido de agendamento",
    text: "Você envia seus dados de contato e o melhor período pelo site, em menos de um minuto.",
  },
  {
    title: "Confirmação pela equipe",
    text: "A clínica entra em contato para combinar dia e horário. A consulta só está marcada após essa confirmação.",
  },
  {
    title: "Avaliação",
    text: "Conversa, exame clínico e, se necessário, exames complementares. Nada é decidido às pressas.",
  },
  {
    title: "Plano de tratamento",
    text: "As alternativas são explicadas com etapas, prazos estimados e cuidados. A decisão é sua.",
  },
  {
    title: "Tratamento",
    text: "Cada etapa concluída é registrada, e você recebe orientações específicas para cada fase.",
  },
  {
    title: "Manutenção",
    text: "Retornos periódicos ajudam a preservar o que foi conquistado, no intervalo indicado para o seu caso.",
  },
];

export function Journey() {
  return (
    <section id="jornada" aria-labelledby="jornada-title" className="bg-stone">
      <Container className="grid gap-16 py-28 sm:py-36 lg:grid-cols-12">
        <div className="lg:sticky lg:top-32 lg:col-span-4 lg:self-start">
          <SectionHeading
            id="jornada-title"
            title="A jornada do paciente"
            intro="Do primeiro contato à manutenção, você sabe sempre onde está e qual é o próximo passo."
          />
        </div>
        <ol className="journey-track relative lg:col-span-7 lg:col-start-6">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="relative grid grid-cols-[3.5rem_1fr] gap-4 pb-14 last:pb-0 sm:grid-cols-[5rem_1fr]"
            >
              <span
                aria-hidden
                className="font-display relative z-10 grid size-12 place-items-center rounded-full border border-gold bg-stone text-xl text-olive sm:size-14"
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-2 pt-2 sm:pt-3">
                <h3 className="font-display text-[1.75rem] leading-tight text-onyx">{step.title}</h3>
                <p className="max-w-md text-mist">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
