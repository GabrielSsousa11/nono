import { AtSign, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteContent } from "@/lib/content";
import { formatHours, telHref, whatsappHref } from "@/lib/content/format";
import { Container, PendingNotice, SectionHeading } from "./section";

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-5 border-t border-onyx/10 py-6">
      <span className="mt-1 text-gold-ink" aria-hidden>
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-mist">{label}</dt>
        <dd className="text-lg text-onyx">{children}</dd>
      </div>
    </div>
  );
}

export function hasContactInfo(content: SiteContent) {
  const c = content.contact;
  return Boolean(content.address || c.phone || c.whatsapp || c.email || c.instagram || content.hours.length);
}

/** Localização e contato — somente dados verificados. */
export function Contact({ content }: { content: SiteContent }) {
  if (!hasContactInfo(content)) {
    return (
      <Container className="py-16">
        <PendingNotice>
          Endereço, telefone, WhatsApp, e-mail e horários aparecem aqui quando confirmados. Em produção a seção fica
          oculta.
        </PendingNotice>
      </Container>
    );
  }

  const { address, contact, hours } = content;
  const addressLine = address
    ? `${address.street}, ${address.district}, ${address.city} – ${address.state}, ${address.postalCode}`
    : null;

  return (
    <section id="contato" aria-labelledby="contato-title" className="bg-stone">
      <Container className="grid gap-14 py-28 sm:py-36 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHeading id="contato-title" title="Localização e contato" />
        </div>
        <dl className="lg:col-span-7 lg:col-start-6">
          {addressLine && (
            <Row icon={<MapPin className="size-5" />} label="Endereço">
              <address className="not-italic">{addressLine}</address>
              {address?.mapsUrl && (
                <a
                  href={address.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-olive underline decoration-gold underline-offset-4"
                >
                  Abrir no mapa (nova aba)
                </a>
              )}
            </Row>
          )}
          {hours.length > 0 && (
            <Row icon={<Clock className="size-5" />} label="Horário de atendimento">
              <ul>
                {hours.map((h) => (
                  <li key={h.days.join("-")}>{formatHours(h)}</li>
                ))}
              </ul>
            </Row>
          )}
          {contact.phone && (
            <Row icon={<Phone className="size-5" />} label="Telefone">
              <a href={telHref(contact.phone)} className="hover:text-olive">
                {contact.phone}
              </a>
            </Row>
          )}
          {contact.whatsapp && (
            <Row icon={<MessageCircle className="size-5" />} label="WhatsApp">
              <a
                href={whatsappHref(contact.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-olive"
              >
                {contact.whatsapp}
              </a>
            </Row>
          )}
          {contact.email && (
            <Row icon={<Mail className="size-5" />} label="E-mail">
              <a href={`mailto:${contact.email}`} className="break-all hover:text-olive">
                {contact.email}
              </a>
            </Row>
          )}
          {contact.instagram && (
            <Row icon={<AtSign className="size-5" />} label="Instagram">
              <a
                href={`https://instagram.com/${contact.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-olive"
              >
                {contact.instagram}
              </a>
            </Row>
          )}
        </dl>
      </Container>
    </section>
  );
}
