/**
 * Modelo de conteúdo institucional.
 *
 * Regra do projeto: todo campo factual sobre a clínica (CRO, endereço, contatos,
 * especialidades, serviços, horários, fotografias, perguntas sobre políticas da
 * clínica) é `null` ou lista vazia até ser confirmado pela clínica. Componentes
 * NÃO exibem nada no lugar de dados ausentes em produção.
 *
 * Na Fase 10 este modelo passa a ser carregado da tabela `website_content`
 * (CG Studio → Gestão de conteúdo) sem mudar os componentes.
 */

export interface Professional {
  name: string;
  /** Ex.: "CRO-SP 00000". Exigência de publicidade odontológica — obrigatório antes de publicar. */
  cro: string | null;
  role: string | null;
  bio: string[];
  specialties: string[];
  photo: Photo | null;
}

export interface Photo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface ServiceStep {
  title: string;
  description: string;
}

/** Região ilustrada no diagrama esquemático do dente. */
export type ToothRegion = "enamel" | "crown" | "gum" | "root" | "arch" | "whole";

export interface Service {
  slug: string;
  name: string;
  summary: string;
  /** Explicação educativa geral, revisada pela profissional responsável. */
  explanation: string;
  steps: ServiceStep[];
  region: ToothRegion;
}

export interface OpeningHours {
  /** 0 = domingo … 6 = sábado */
  days: number[];
  opens: string; // "08:00"
  closes: string; // "18:00"
}

export interface Address {
  street: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  mapsUrl: string | null;
}

export interface Contact {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SiteContent {
  clinicName: string;
  tagline: string;
  professional: Professional;
  contact: Contact;
  address: Address | null;
  hours: OpeningHours[];
  services: Service[];
  /** Perguntas sobre políticas da clínica (convênios, pagamentos, etc.). */
  clinicFaq: FaqItem[];
  spacePhotos: Photo[];
  /** Razão social / CNPJ do controlador de dados (LGPD). */
  legal: { companyName: string | null; cnpj: string | null; dpoContact: string | null };
}

export interface LoadedContent {
  content: SiteContent;
  /** true quando os dados exibidos são sintéticos (apenas desenvolvimento). */
  synthetic: boolean;
}
