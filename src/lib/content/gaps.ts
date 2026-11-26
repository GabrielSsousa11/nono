import type { SiteContent } from "./types";

export interface ContentGap {
  field: string;
  reason: string;
  blocking: boolean;
}

/**
 * Lista o que falta para publicação. `blocking` = exigência legal ou de
 * funcionamento básico (ex.: CRO do responsável técnico na publicidade).
 */
export function findContentGaps(content: SiteContent): ContentGap[] {
  const gaps: ContentGap[] = [];
  const add = (field: string, reason: string, blocking = false) => gaps.push({ field, reason, blocking });

  if (!content.professional.cro)
    add("professional.cro", "Nome e CRO do responsável técnico são exigidos na publicidade odontológica.", true);
  if (content.professional.bio.length === 0) add("professional.bio", "Seção da profissional fica oculta.");
  if (!content.contact.phone && !content.contact.whatsapp && !content.contact.email)
    add("contact", "Nenhum canal de contato publicado.", true);
  if (!content.address) add("address", "Seção de localização fica oculta.");
  if (content.hours.length === 0) add("hours", "Horários de funcionamento não publicados.");
  if (content.services.length === 0) add("services", "Seção de tratamentos fica oculta.");
  if (content.spacePhotos.length === 0) add("spacePhotos", "Seção 'Conheça o espaço' fica oculta.");
  if (!content.legal.companyName)
    add("legal.companyName", "Controlador de dados não identificado na política de privacidade.", true);
  if (!content.legal.dpoContact)
    add("legal.dpoContact", "Canal do encarregado (DPO) não informado na política de privacidade.", true);
  return gaps;
}
