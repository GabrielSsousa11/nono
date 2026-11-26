import { BookingForm } from "@/features/booking/booking-form";
import type { SiteContent } from "@/lib/content";
import { telHref, whatsappHref } from "@/lib/content/format";
import { isSupabaseConfigured } from "@/lib/env";
import { Container, SectionHeading } from "./section";

/**
 * Agendamento. Nesta fase é um PEDIDO de agendamento persistido no banco
 * (booking_requests); a agenda com horários reais chega na Fase 4.
 * Sem backend configurado, a seção informa isso com clareza — sem simular envio.
 */
export function BookingSection({ content }: { content: SiteContent }) {
  const available = isSupabaseConfigured();
  const { contact } = content;
  const directChannel = contact.whatsapp
    ? { href: whatsappHref(contact.whatsapp), label: `WhatsApp ${contact.whatsapp}` }
    : contact.phone
      ? { href: telHref(contact.phone), label: `Telefone ${contact.phone}` }
      : null;

  return (
    <section id="agendamento" aria-labelledby="agendamento-title" className="paper">
      <Container className="grid gap-16 py-28 sm:py-36 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-4">
          <SectionHeading
            id="agendamento-title"
            title="Agende sua avaliação"
            intro="Conte como prefere ser atendida ou atendido. A equipe retorna para confirmar o melhor horário."
          />
          {directChannel && (
            <p className="text-sm text-mist">
              Prefere falar agora?{" "}
              <a href={directChannel.href} className="text-olive underline decoration-gold underline-offset-4">
                {directChannel.label}
              </a>
            </p>
          )}
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          {available ? (
            <BookingForm services={content.services.map((s) => s.name)} />
          ) : (
            <div role="status" className="flex flex-col gap-4 border-t border-gold/60 pt-8">
              <p className="font-display text-2xl text-onyx">O pedido de agendamento online será ativado em breve.</p>
              <p className="max-w-md text-mist">
                {directChannel
                  ? "Enquanto isso, fale com a clínica pelo canal ao lado."
                  : "Enquanto isso, entre em contato diretamente com a clínica."}
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
