import type { SiteContent } from "./types";
import { officialContent } from "./official";

/**
 * DADOS SINTÉTICOS — USO EXCLUSIVO EM DESENVOLVIMENTO.
 *
 * Existem apenas para validar layout e interações enquanto a clínica não envia
 * o conteúdo oficial. Todos os valores são deliberadamente identificáveis como
 * falsos (telefones 0000, "sintético" nos textos). O build de produção falha se
 * CG_CONTENT_SOURCE=fixtures (ver next.config.ts) e a interface exibe um aviso.
 */
export const devFixtures: SiteContent = {
  ...officialContent,
  professional: {
    name: officialContent.professional.name,
    cro: "CRO-XX 00000 (sintético)",
    role: "Cirurgiã-dentista (texto sintético)",
    bio: [
      "Parágrafo sintético de apresentação. Substituir pela biografia aprovada pela profissional.",
      "Segundo parágrafo sintético, para validar o ritmo tipográfico da seção.",
    ],
    specialties: ["Especialidade sintética A", "Especialidade sintética B"],
    photo: null,
  },
  contact: {
    phone: "(00) 0000-0000",
    whatsapp: "(00) 00000-0000",
    email: "contato@exemplo.invalid",
    instagram: null,
  },
  address: {
    street: "Endereço sintético, 000",
    district: "Bairro sintético",
    city: "Cidade",
    state: "UF",
    postalCode: "00000-000",
    mapsUrl: null,
  },
  hours: [
    { days: [1, 2, 3, 4, 5], opens: "08:00", closes: "18:00" },
    { days: [6], opens: "08:00", closes: "12:00" },
  ],
  services: [
    {
      slug: "avaliacao",
      name: "Avaliação inicial",
      summary: "Uma conversa sem pressa e um exame cuidadoso para entender o seu momento.",
      explanation:
        "Na primeira consulta, a dentista ouve suas expectativas, examina dentes, gengivas e mordida e, quando necessário, solicita exames complementares. O plano de tratamento só é proposto depois dessa avaliação.",
      steps: [
        { title: "Conversa", description: "Histórico, hábitos e o que você deseja para o seu sorriso." },
        { title: "Exame clínico", description: "Avaliação de dentes, gengivas, articulação e mordida." },
        { title: "Plano", description: "Opções explicadas com clareza, incluindo prazos e cuidados." },
      ],
      region: "whole",
    },
    {
      slug: "clareamento",
      name: "Clareamento dental",
      summary: "Tons mais claros com acompanhamento profissional e sensibilidade controlada.",
      explanation:
        "O clareamento utiliza géis à base de peróxido que atuam na estrutura do esmalte e da dentina. Pode ser feito em consultório, em casa com moldeiras supervisionadas ou combinando os dois. Restaurações e próteses não mudam de cor.",
      steps: [
        { title: "Indicação", description: "Avaliação da saúde bucal e registro da cor inicial." },
        { title: "Aplicação", description: "Sessões em consultório e/ou uso de moldeiras em casa." },
        { title: "Manutenção", description: "Orientações de hábitos e reavaliação periódica." },
      ],
      region: "enamel",
    },
    {
      slug: "restauracoes",
      name: "Restaurações estéticas",
      summary: "Recuperar forma e função com materiais na cor do dente.",
      explanation:
        "Restaurações em resina composta ou cerâmica substituem partes do dente perdidas por cárie, fratura ou desgaste, devolvendo a anatomia e a função mastigatória.",
      steps: [
        { title: "Diagnóstico", description: "Identificação da extensão da lesão." },
        { title: "Preparo", description: "Remoção do tecido comprometido com preservação máxima." },
        { title: "Escultura", description: "Reconstrução em camadas e acabamento." },
      ],
      region: "crown",
    },
    {
      slug: "periodontia",
      name: "Saúde gengival",
      summary: "Gengivas saudáveis sustentam todo o resto.",
      explanation:
        "O tratamento periodontal controla a inflamação da gengiva e dos tecidos de suporte do dente por meio de raspagem, orientação de higiene e acompanhamento.",
      steps: [
        { title: "Sondagem", description: "Medição das bolsas gengivais." },
        { title: "Tratamento", description: "Remoção de placa e tártaro acima e abaixo da gengiva." },
        { title: "Manutenção", description: "Retornos regulares conforme o risco individual." },
      ],
      region: "gum",
    },
  ],
  clinicFaq: [
    {
      question: "Pergunta sintética sobre convênios?",
      answer: "Resposta sintética. Substituir pela política real da clínica.",
    },
  ],
  spacePhotos: [],
  legal: { companyName: "Razão social sintética", cnpj: null, dpoContact: null },
};
