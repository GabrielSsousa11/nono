# Roadmap

Legenda: ✅ concluído e verificado · 🟡 parcial · ⬜ não iniciado. Uma tarefa só recebe ✅ quando interface, backend,
persistência, permissões, estados de carregamento/erro, mobile e testes estão prontos.

## Fase 1 — Arquitetura, design system e infraestrutura ✅

| Tarefa                                                                       | Status | Verificação                                                                      |
| ---------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Inspeção do repositório                                                      | ✅     | Projeto Unity sem relação removido; plataforma na raiz do repositório (ADR-001). |
| Next.js 16 + TS strict + Tailwind 4 + ESLint + Prettier                      | ✅     | `npm run lint`, `npm run typecheck`                                              |
| Design system (tokens, tipografia, contraste documentado)                    | ✅     | `src/app/globals.css`; axe WCAG 2.2 AA sem violações                             |
| Validação de variáveis de ambiente                                           | ✅     | `src/lib/env.ts`                                                                 |
| Modelo de conteúdo verificável + fixtures bloqueadas em produção             | ✅     | testes `content.test.ts`; trava em `next.config.ts`                              |
| Migration de fundação (RLS, auditoria imutável, conteúdo, pedidos, retenção) | ✅     | `npm run test:db` (9 cenários)                                                   |
| Cabeçalhos de segurança (CSP, HSTS, XFO, Permissions-Policy)                 | ✅     | E2E `envia cabeçalhos de segurança`                                              |
| Vitest + Playwright + axe                                                    | ✅     | 45 unitários, 40 E2E                                                             |
| PWA (manifest, ícones, SW sem dados privados, offline)                       | ✅     | E2E `PWA: …`                                                                     |
| Docker (imagem standalone + compose)                                         | 🟡     | Arquivos prontos; **build da imagem não testado** (ambiente sem daemon Docker).  |
| CI GitHub Actions                                                            | 🟡     | Workflow criado; ainda não executado no GitHub.                                  |
| Documentação (CLAUDE.md, arquitetura, ADRs, custos, LGPD, conteúdo)          | ✅     | `docs/`                                                                          |

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

## Fase 3 — Autenticação, banco e permissões ✅ (validação em Supabase real pendente)

| Tarefa                                                                                                                                        | Status | Verificação                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Migration: `roles`, `permissions`, `role_permissions`, `profiles`, `user_roles`, `professionals`, `patients`, `patient_guardians`, `consents` | ✅     | `npm run test:db`                                                                          |
| Permissões como dados + `private.has_permission()` exigindo `aal2` para papéis de equipe                                                      | ✅     | matriz `identity_access.test.sql`                                                          |
| Recepção/financeiro sem `clinical.*`; financeiro sem pedidos; paciente vê só o próprio cadastro; responsável só com vínculo ativo             | ✅     | matriz SQL                                                                                 |
| Vínculo de conta do paciente/responsável só via RPC; revogação de responsável com motivo e remoção do papel                                   | ✅     | matriz SQL                                                                                 |
| Consentimentos append-only; titular gerencia os opcionais; presenciais pela equipe                                                            | ✅     | matriz SQL + E2E portal                                                                    |
| Auditoria automática (colunas alteradas, sem valores) + eventos administrativos                                                               | ✅     | matriz SQL                                                                                 |
| `TRUNCATE` revogado da API; `DELETE` revogado em tabelas com guarda legal                                                                     | ✅     | matriz SQL                                                                                 |
| MFA TOTP obrigatório no CG Studio (cadastro com QR Code, verificação, redefinição pelo admin)                                                 | 🟡     | Portão testado (unit + E2E com sessão sintética); fluxo TOTP real requer projeto Supabase. |
| CG Studio: visão geral, pedidos de agendamento, equipe e acessos (convite, funções)                                                           | 🟡     | E2E com mock; convites exigem `SUPABASE_SERVICE_ROLE_KEY` e projeto real.                  |
| Portal: "Meus dados e privacidade" (cadastro, autorizações, responsáveis, direitos)                                                           | ✅     | E2E com mock                                                                               |
| Redirecionamento pós-login por perfil (`/continuar`)                                                                                          | ✅     | E2E                                                                                        |
| CSP com nonce                                                                                                                                 | ➖     | Inviável com Cache Components/PPR — ADR-005 revisado.                                      |

**Para validar em ambiente real:** criar projeto Supabase (sa-east-1), aplicar migrations, configurar Auth
(`docs/SECURITY_LGPD.md`), convidar a primeira administradora pelo painel do Supabase e executar
`select private.bootstrap_admin('email');` no SQL Editor.

**UI que fica para a Fase 4:** cadastro/edição de pacientes, convite de pacientes e responsáveis ao portal, registro
presencial de consentimentos e cadastro de profissionais (o banco e as RPCs já existem e estão testados).

## Fases 4 a 12 — ✅ implementadas (validação em Supabase real pendente)

Banco: migrations 0003–0007 com testes SQL (`npm run test:db`, 6 suítes). Interface: Studio e portal com E2E de
todas as páginas contra sessões sintéticas (mock). O que só pode ser validado num projeto Supabase real está marcado.

| Fase                                 | Entregue                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Pendente / observação                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 4 Agenda e Studio                    | Serviços, profissionais, grade semanal, feriados/ausências/bloqueios; agenda dia/semana/mês; agendar com horários reais; confirmar, chegada, concluir, falta, cancelar (motivo), remarcar; histórico de status; EXCLUDE contra conflitos (profissional e paciente); lista de espera com oferta automática configurável; pacientes (cadastro, CPF validado, arquivamento, responsáveis, consentimentos, convite ao portal); pedidos do site → agendamento; configurações | Convites exigem `SUPABASE_SERVICE_ROLE_KEY`                          |
| 5 Portal                             | Início com próxima consulta e avisos; consultas (confirmar, remarcar, cancelar com antecedência, agendar serviços liberados, lista de espera, aceitar vaga); dados e autorizações                                                                                                                                                                                                                                                                                       | —                                                                    |
| 6 CG Daily e Journey                 | Metas definidas pela dentista, registro limitado (sem incentivo a excesso), cronômetro guiado, foguinho, calendário, histórico semanal, conquistas, recordes, níveis, missões educativas, índice de adesão não diagnóstico; planos, etapas, orientações, previsões, progresso                                                                                                                                                                                           | Textos das missões precisam de revisão da dentista                   |
| 7 Smile 3D e Evolution               | Arcada 3D (rotação, zoom, seleção FDI), alternativa 2D acessível, histórico por dente, registro pela dentista, dentição mista/decídua em 2D; fotos com consentimento obrigatório, compressão no navegador, Storage privado, URLs assinadas de 5 min, comparação com controle deslizante, documentos                                                                                                                                                                     | Upload depende do Storage real                                       |
| 8 Care, Family, Passport             | Protocolos com aprovação obrigatória por dentista, envio com nota e recorrência, confirmação de leitura, mensagens paciente ↔ clínica; seletor de dependentes; carteira digital, QR com token de 10 min (hash no banco, uso único), check-in na recepção                                                                                                                                                                                                                | —                                                                    |
| 9 Concierge e automações             | Recepção digital determinística (sem IA paga), trava para assuntos clínicos e urgência, consulta à agenda com login, encaminhamento à equipe; fila persistente idempotente com tentativas/backoff, 8 regras configuráveis, execução manual; Web Push gratuito sem service role                                                                                                                                                                                          | WhatsApp/e-mail transacional: módulos opcionais não ativados (pagos) |
| 10 Financeiro, indicadores, conteúdo | Cobranças, pagamentos parciais, despesas, portal financeiro; pesquisa de satisfação (NPS); indicadores com amostra mínima e "dados insuficientes"; gráficos com paleta validada e tabela; edição do site com versões e publicação só após verificação                                                                                                                                                                                                                   | —                                                                    |
| 11 Testes e segurança                | 94 unitários, 6 suítes SQL, 114 E2E (desktop+mobile) com axe; auditoria no Studio; TRUNCATE/DELETE revogados; achados corrigidos listados nos commits                                                                                                                                                                                                                                                                                                                   | Teste de restauração de backup exige plano pago                      |
| 12 Homologação                       | `docs/DEPLOY.md` (publicação gratuita), `supabase/seed/demo.sql` (demonstração), `npm run db:bundle`                                                                                                                                                                                                                                                                                                                                                                    | Publicação em si depende das suas contas                             |

## Pendências que dependem da clínica

Ver `docs/CONTENT_VERIFICATION.md` (`npm run content:check`) e decisões de custo em `docs/HOSTING_AND_COSTS.md`.
