# Hospedagem, dependências e custos

> Condições comerciais mudam com frequência. Os pontos abaixo refletem o conhecimento disponível na data desta
> análise (nov/2026) e **devem ser conferidos nas páginas oficiais antes de qualquer contratação**.
> Nenhum serviço pago foi contratado. Toda contratação exige autorização explícita.

## Dependências de software

Todas open-source e gratuitas: Next.js, React, Tailwind, Motion, three.js, React Three Fiber/drei, Zod,
React Hook Form, Lucide, Supabase JS, Vitest, Playwright, axe-core. Recharts entra na Fase 10.

## Backend — Supabase

| Plano                   | Pontos relevantes para uma clínica                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free                    | Bom para desenvolvimento/homologação. Limites de banco e storage pequenos, projetos **pausados por inatividade** e **sem backups gerenciados acessíveis**. Inadequado para prontuários reais. |
| Pro (pago, por projeto) | Sem pausa, backups diários, opção de PITR (adicional), mais storage. Recomendado para produção com dados de saúde.                                                                            |
| Auto-hospedado (Docker) | Gratuito em licença, mas exige servidor, backups, atualizações e monitoramento por conta própria.                                                                                             |

Região: escolher **São Paulo (sa-east-1)** para reduzir transferência internacional de dados (LGPD art. 33).

## Hospedagem do Next.js

| Opção                              | Observação                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Vercel Hobby                       | Termos restringem a uso pessoal/não comercial — **não serve para a clínica**.                                     |
| Vercel Pro (pago)                  | Integração mais simples com Next.js 16.                                                                           |
| Cloudflare Workers (OpenNext)      | Plano gratuito permite uso comercial; requer validar compatibilidade do adaptador com Next 16 + Cache Components. |
| VPS com Docker (pago, baixo custo) | `Dockerfile` pronto (standalone). Exige manutenção de servidor.                                                   |

## E-mail transacional (links de acesso)

O SMTP padrão do Supabase tem limites baixos e é só para testes. Produção precisa de SMTP próprio (há provedores com
camada gratuita). WhatsApp Business API é paga por conversa — fica como integração opcional (Fase 9).

## Decisão registrada (26/11/2026)

A responsável pelo projeto autorizou **apenas serviços gratuitos**, ciente das limitações. Consequências:

- Supabase Free: sem backups gerenciados, pausa por inatividade, limites de armazenamento. Adequado para
  **apresentação e homologação com dados sintéticos**. Antes de dados reais de pacientes, esta decisão deve ser revista.
- Hospedagem gratuita para a demonstração (ver `docs/DEPLOY.md`).
- Integrações pagas (WhatsApp Business API, SMS) permanecem como módulos opcionais desligados.

## Recomendação original (para operação real)

1. Agora: Supabase Free para homologação **apenas com dados sintéticos**.
2. Antes de dados reais: Supabase Pro em sa-east-1 + hospedagem comercial (Vercel Pro, Cloudflare ou VPS) +
   SMTP próprio. **Requer autorização de custo.**
