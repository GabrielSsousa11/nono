import type { SiteContent } from "./types";

/**
 * CONTEÚDO OFICIAL — somente informações confirmadas.
 *
 * Fonte das informações abaixo: briefing do projeto (nome da clínica, conceito e frase
 * do hero). Todo o resto aguarda confirmação da clínica — ver docs/CONTENT_VERIFICATION.md.
 * Não preencha campos com suposições.
 */
export const officialContent: SiteContent = {
  clinicName: "Charlene Gonçalves Odontologia",
  tagline: "Cuidar do seu sorriso é cuidar da sua história.",
  professional: {
    name: "Charlene Gonçalves",
    cro: null,
    role: null,
    bio: [],
    specialties: [],
    photo: null,
  },
  contact: { phone: null, whatsapp: null, email: null, instagram: null },
  address: null,
  hours: [],
  services: [],
  clinicFaq: [],
  spacePhotos: [],
  legal: { companyName: null, cnpj: null, dpoContact: null },
};
