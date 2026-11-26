# Roadmap

Legenda: ✅ concluído e verificado · 🟡 parcial · ⬜ não iniciado. Uma tarefa só recebe ✅ quando interface, backend,
persistência, permissões, estados de carregamento/erro, mobile e testes estão prontos.

## Fase 1 — Arquitetura, design system e infraestrutura ✅

| Tarefa                                                                       | Status | Verificação                                                                                                   |
| ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Inspeção do repositório                                                      | ✅     | Repositório continha apenas um jogo Unity sem relação; plataforma isolada em `charlene-goncalves/` (ADR-001). |
| Next.js 16 + TS strict + Tailwind 4 + ESLint + Prettier                      | ✅     | `npm run lint`, `npm run typecheck`                                                                           |
| Design system (tokens, tipografia, contraste documentado)                    | ✅     | `src/app/globals.css`; axe WCAG 2.2 AA sem violações                                                          |
| Validação de variáveis de ambiente                                           | ✅     | `src/lib/env.ts`                                                                                              |
| Modelo de conteúdo verificável + fixtures bloqueadas em produção             | ✅     | testes `content.test.ts`; trava em `next.config.ts`                                                           |
| Migration de fundação (RLS, auditoria imutável, conteúdo, pedidos, retenção) | ✅     | `npm run test:db` (9 cenários)                                                                                |
| Cabeçalhos de segurança (CSP, HSTS, XFO, Permissions-Policy)                 | ✅     | E2E `envia cabeçalhos de segurança`                                                                           |
| Vitest + Playwright + axe                                                    | ✅     | 45 unitários, 40 E2E                                                                                          |
| PWA (manifest, ícones, SW sem dados privados, offline)                       | ✅     | E2E `PWA: …`                                                                                                  |
| Docker (imagem standalone + compose)                                         | 🟡     | Arquivos prontos; **build da imagem não testado** (ambiente sem daemon Docker).                               |
| CI GitHub Actions                                                            | 🟡     | Workflow criado; ainda não executado no GitHub.                                                               |
| Documentação (CLAUDE.md, arquitetura, ADRs, custos, LGPD, conteúdo)          | ✅     | `docs/`                                                                                                       |

## Fase 2 — Site institucional premium 🟡 (código pronto; aguarda conteúdo oficial)

| Seção                                                      | Status | Observação                                                          |
| ---------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| Hero com molar 3D procedural, scroll e fallback estático   | ✅     |                                                                     |
| Manifesto                                                  | 🟡     | Texto de marca aguarda aprovação da clínica.                        |
| Apresentação da profissional                               | 🟡     | Oculta até envio de bio/CRO/foto.                                   |
| Experiência de atendimento                                 | 🟡     | Texto de marca aguarda aprovação.                                   |
| Tratamentos interativos (abas acessíveis + diagrama)       | 🟡     | Componente pronto e testado com fixtures; oculto até lista oficial. |
| Jornada do paciente                                        | ✅     |                                                                     |
| Conheça o espaço                                           | 🟡     | Oculto até fotos reais.                                             |
| Portal exclusivo (status real dos módulos)                 | ✅     |                                                                     |
| Perguntas frequentes                                       | ✅     | Perguntas sobre políticas da clínica aguardam conteúdo.             |
| Localização e contato                                      | 🟡     | Oculto até dados oficiais.                                          |
| Pedido de agendamento (persistido, limitado, LGPD)         | ✅     | Requer projeto Supabase configurado para funcionar em produção.     |
| Rodapé, política de privacidade preliminar, 404, offline   | ✅     | Política exige revisão jurídica.                                    |
| Área do paciente: login por link mágico + portal protegido | 🟡     | Fluxo funcional; módulos do portal nas fases 5–9.                   |

## Fase 3 — Autenticação, banco e permissões ⬜

- [ ] Migrations: `profiles`, `roles`, `permissions`, `patients`, `professionals`, `patient_guardians`, `consents`, `audit` por trigger.
- [ ] Funções `private.has_role()`/`private.is_staff()` + políticas RLS por papel (admin, dentista, recepção, financeiro, paciente, responsável).
- [ ] MFA TOTP obrigatório para equipe (`aal2` em RLS e no proxy); tela de cadastro de fator.
- [ ] CSP com nonce nas áreas autenticadas (ADR-005).
- [ ] Testes SQL de cada política (matriz papel × tabela × operação).

## Fase 4 — Agendamento e CG Studio ⬜

- [ ] `services`, `availability`, `schedule_blocks`, `appointments` com `EXCLUDE USING gist (professional_id WITH =, tstzrange WITH &&)`.
- [ ] Histórico de status, confirmação, cancelamento, reagendamento, faltas, lista de espera com regras configuráveis.
- [ ] Agenda diária/semanal/mensal no Studio; conversão de `booking_requests` em consulta.

## Fases 5–12

5 Portal do paciente · 6 CG Daily e CG Journey · 7 CG Smile 3D e CG Evolution · 8 CG Care, Family e Passport ·
9 CG Concierge e automações (fila `automation_jobs` com idempotência) · 10 Financeiro, CG Intelligence e gestão de
conteúdo · 11 Testes, auditoria, segurança e otimização · 12 Homologação e implantação.

## Pendências que dependem da clínica

Ver `docs/CONTENT_VERIFICATION.md` (`npm run content:check`) e decisões de custo em `docs/HOSTING_AND_COSTS.md`.
