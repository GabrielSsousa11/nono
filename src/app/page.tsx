import { BookingSection } from "@/components/home/booking-section";
import { Contact, hasContactInfo } from "@/components/home/contact";
import { Experience } from "@/components/home/experience";
import { Faq } from "@/components/home/faq";
import { Hero } from "@/components/home/hero";
import { Journey } from "@/components/home/journey";
import { Manifesto } from "@/components/home/manifesto";
import { Portal } from "@/components/home/portal";
import { Professional } from "@/components/home/professional";
import { Container, PendingNotice, SectionHeading } from "@/components/home/section";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader, type NavItem } from "@/components/home/site-header";
import { Space } from "@/components/home/space";
import { SyntheticBanner } from "@/components/home/synthetic-banner";
import { Treatments } from "@/components/home/treatments";
import { ConciergeWidget } from "@/features/concierge/concierge-widget";
import { getSiteContent, type SiteContent } from "@/lib/content";
import { siteUrl } from "@/lib/env";

/** Dados estruturados apenas com informações verificadas — campos ausentes são omitidos. */
function structuredData(content: SiteContent) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Dentist",
    name: content.clinicName,
    url: siteUrl(),
    slogan: content.tagline,
  };
  if (content.contact.phone) data.telephone = content.contact.phone;
  if (content.contact.email) data.email = content.contact.email;
  if (content.address) {
    data.address = {
      "@type": "PostalAddress",
      streetAddress: content.address.street,
      addressLocality: content.address.city,
      addressRegion: content.address.state,
      postalCode: content.address.postalCode,
      addressCountry: "BR",
    };
  }
  return data;
}

export default function HomePage() {
  const { content, synthetic } = getSiteContent();

  const nav: NavItem[] = [
    { href: "#manifesto", label: "Manifesto" },
    ...(content.professional.bio.length ? [{ href: "#profissional", label: "A profissional" }] : []),
    ...(content.services.length ? [{ href: "#tratamentos", label: "Tratamentos" }] : []),
    { href: "#jornada", label: "Jornada" },
    { href: "#portal", label: "Portal" },
    { href: "#duvidas", label: "Dúvidas" },
    ...(hasContactInfo(content) ? [{ href: "#contato", label: "Contato" }] : []),
  ];

  return (
    <>
      <SiteHeader nav={nav} />
      <main id="conteudo">
        <Hero clinicName={content.clinicName} />
        <Manifesto />
        <Professional data={content.professional} />
        <Experience />

        {content.services.length > 0 ? (
          <section id="tratamentos" aria-labelledby="tratamentos-title" className="bg-porcelain">
            <Container className="flex flex-col gap-16 py-28 sm:py-36">
              <SectionHeading
                id="tratamentos-title"
                title="Tratamentos"
                intro="Escolha um tratamento para ver como ele funciona, etapa por etapa. As informações são educativas e não substituem a avaliação individual."
              />
              <Treatments services={content.services} />
            </Container>
          </section>
        ) : (
          <Container className="py-16">
            <PendingNotice>
              A lista de tratamentos realizados pela clínica, com explicações revisadas pela profissional, aparece aqui.
              Em produção a seção fica oculta até a confirmação.
            </PendingNotice>
          </Container>
        )}

        <Journey />
        <Space photos={content.spacePhotos} />
        <Portal />
        <Faq clinicFaq={content.clinicFaq} />
        <Contact content={content} />
        <BookingSection content={content} />
      </main>
      <SiteFooter content={content} nav={nav} />
      <ConciergeWidget />
      {synthetic && <SyntheticBanner />}
      {!synthetic && (
        <script
          type="application/ld+json"
          // Conteúdo serializado por nós, sem entrada do usuário.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(content)).replace(/</g, "\\u003c") }}
        />
      )}
    </>
  );
}
