import { Container, SectionHeading } from "./section";

const MOMENTS = [
  {
    when: "Antes",
    title: "Tempo para ouvir",
    text: "Você chega sabendo o que esperar. A primeira conversa é sobre você, suas expectativas e o que incomoda — não sobre um pacote pronto.",
  },
  {
    when: "Durante",
    title: "Cada passo explicado",
    text: "O plano é apresentado com opções, prazos e cuidados. Você decide com informação, e cada etapa concluída fica registrada.",
  },
  {
    when: "Depois",
    title: "Cuidado que continua",
    text: "Orientações para casa, lembretes de retorno e um canal direto com a clínica para que o tratamento não termine na porta do consultório.",
  },
];

/** Experiência de atendimento — antes, durante e depois (é uma sequência real). */
export function Experience() {
  return (
    <section id="experiencia" aria-labelledby="experiencia-title" className="paper">
      <Container className="py-28 sm:py-36">
        <SectionHeading
          id="experiencia-title"
          title={
            <>
              Uma experiência pensada
              <br className="hidden sm:block" /> do primeiro contato ao retorno
            </>
          }
        />
        <ol className="mt-14 grid divide-onyx/10 max-md:divide-y sm:mt-20 md:grid-cols-3 md:divide-x">
          {MOMENTS.map((m) => (
            <li key={m.when} className="flex flex-col gap-6 py-10 md:px-10 md:py-2 md:first:pl-0 md:last:pr-0">
              <span className="font-display text-[clamp(3rem,5vw,4.5rem)] leading-none text-gold-ink">{m.when}</span>
              <h3 className="text-lg font-semibold text-onyx">{m.title}</h3>
              <p className="max-w-sm text-mist">{m.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
