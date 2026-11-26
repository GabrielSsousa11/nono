import Link from "next/link";
import { Monogram } from "@/components/ui/monogram";
import type { SiteContent } from "@/lib/content";
import { telHref, whatsappHref } from "@/lib/content/format";
import type { NavItem } from "./site-header";

const BUILD_YEAR = process.env.CG_BUILD_YEAR ?? "";

export function SiteFooter({ content, nav }: { content: SiteContent; nav: NavItem[] }) {
  const { professional, contact, address, legal } = content;
  return (
    <footer className="stone on-dark bg-olive-deep text-champagne">
      <div className="mx-auto grid max-w-[88rem] gap-14 px-5 pt-24 pb-10 sm:px-8 lg:grid-cols-12 lg:px-12">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <Monogram className="size-12 text-ivory" />
          <p className="font-display text-3xl leading-tight text-ivory">{content.clinicName}</p>
          <p className="font-display max-w-sm text-xl text-champagne">{content.tagline}</p>
        </div>

        <nav aria-label="Rodapé" className="lg:col-span-3 lg:col-start-7">
          <h2 className="mb-5 text-sm font-semibold text-ivory">Navegação</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={`/${item.href}`} className="hover:text-ivory">
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/entrar" className="hover:text-ivory">
                Área do paciente
              </Link>
            </li>
          </ul>
        </nav>

        <div className="flex flex-col gap-8 text-sm lg:col-span-3">
          {(contact.phone || contact.whatsapp || contact.email || address) && (
            <div>
              <h2 className="mb-5 font-semibold text-ivory">Contato</h2>
              <ul className="flex flex-col gap-3">
                {contact.phone && (
                  <li>
                    <a href={telHref(contact.phone)} className="hover:text-ivory">
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.whatsapp && (
                  <li>
                    <a
                      href={whatsappHref(contact.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-ivory"
                    >
                      WhatsApp {contact.whatsapp}
                    </a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className="break-all hover:text-ivory">
                      {contact.email}
                    </a>
                  </li>
                )}
                {address && (
                  <li>
                    {address.street}, {address.district}, {address.city} – {address.state}
                  </li>
                )}
              </ul>
            </div>
          )}
          <div>
            <h2 className="mb-5 font-semibold text-ivory">Privacidade</h2>
            <ul className="flex flex-col gap-3">
              <li>
                <Link href="/privacidade" className="hover:text-ivory">
                  Política de privacidade
                </Link>
              </li>
              <li>
                <Link href="/privacidade#direitos" className="hover:text-ivory">
                  Seus direitos sobre os dados
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-ivory/15 pt-8 text-xs text-champagne/90 lg:col-span-12 lg:flex-row lg:justify-between">
          <p>
            {professional.cro
              ? `Responsável técnica: ${professional.name}, ${professional.cro}`
              : `© ${BUILD_YEAR} ${content.clinicName}`}
          </p>
          <p>
            {legal.companyName && `${legal.companyName}`}
            {legal.cnpj && `, CNPJ ${legal.cnpj}`}
            {professional.cro && ` © ${BUILD_YEAR}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
