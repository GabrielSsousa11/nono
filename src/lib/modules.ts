/**
 * Registro dos módulos da plataforma e seu estado REAL de implantação.
 * A seção "Portal" da página inicial e o portal do paciente leem daqui,
 * para nunca anunciar como disponível algo que ainda não funciona.
 * Atualize o status somente quando o critério de aceitação da fase for cumprido.
 */
export type ModuleStatus = "available" | "in_development" | "planned";

export interface PlatformModule {
  id: string;
  name: string;
  /** O que a pessoa paciente consegue fazer — linguagem simples. */
  description: string;
  status: ModuleStatus;
  phase: number;
}

export const platformModules: PlatformModule[] = [
  {
    id: "journey",
    name: "CG Journey",
    description: "Sua linha do tempo de tratamento: etapas concluídas, próximas consultas e orientações.",
    status: "planned",
    phase: 6,
  },
  {
    id: "daily",
    name: "CG Daily",
    description: "Registro diário de escovação e fio dental, com cronômetro guiado e metas definidas pela dentista.",
    status: "planned",
    phase: 6,
  },
  {
    id: "smile3d",
    name: "CG Smile 3D",
    description: "Odontograma interativo com os procedimentos realizados e planejados em cada dente.",
    status: "planned",
    phase: 7,
  },
  {
    id: "evolution",
    name: "CG Evolution",
    description: "Diário fotográfico privado para comparar o antes e o depois, com seu consentimento.",
    status: "planned",
    phase: 7,
  },
  {
    id: "care",
    name: "CG Care",
    description: "Orientações pós-consulta aprovadas pela dentista e lembretes de manutenção e retorno.",
    status: "planned",
    phase: 8,
  },
  {
    id: "passport",
    name: "CG Passport",
    description: "Carteira digital com sua próxima consulta e check-in por QR Code temporário.",
    status: "planned",
    phase: 8,
  },
  {
    id: "family",
    name: "CG Family",
    description: "Responsáveis autorizados acompanham os perfis de dependentes, cada um com seu histórico.",
    status: "planned",
    phase: 8,
  },
  {
    id: "concierge",
    name: "CG Concierge",
    description: "Recepção digital para dúvidas administrativas, horários e pedidos de reagendamento.",
    status: "planned",
    phase: 9,
  },
];

export const statusLabel: Record<ModuleStatus, string> = {
  available: "Disponível",
  in_development: "Em desenvolvimento",
  planned: "Em implantação",
};
