# Registro de decisões técnicas (ADRs)

## ADR-001 — Repositório dedicado à plataforma

**Contexto:** o repositório continha um jogo Unity ("Empire Tycoon") sem relação com a clínica.
**Decisão:** a pedido da responsável, o projeto Unity foi removido e a plataforma passou para a raiz do repositório.
O jogo continua recuperável pelo histórico do git (commit `f08fded`).

## ADR-002 — Next.js 16 com Cache Components

Páginas públicas pré-renderizadas (estáticas, melhor LCP); dados de sessão apenas dentro de `<Suspense>`.
`proxy.ts` (antigo middleware) só nas rotas autenticadas.

## ADR-003 — Supabase como backend

Postgres + Auth + Storage + RLS num único serviço open-source (auto-hospedável se necessário). Toda regra de acesso
vive no banco. Alternativa auto-hospedada documentada em `HOSTING_AND_COSTS.md`.

## ADR-004 — Conteúdo verificável com fixtures bloqueadas

Dados factuais nunca são inventados. `official.ts` contém só o confirmado; `dev-fixtures.ts` é sintético e o build de
produção falha se for ativado. Seções sem dados não aparecem em produção.

## ADR-005 — CSP sem nonce (revisado na Fase 3)

A documentação do Next.js 16 informa que nonce exige renderização dinâmica de todas as páginas e é **incompatível com
Partial Prerendering**, que o Cache Components ativa globalmente. Manter o site público estático (LCP) e as áreas
privadas com shell pré-renderizado inviabiliza nonce. Decisão: CSP sem nonce em todo o app, com controles
compensatórios — nenhum script de terceiros, `connect-src` restrito ao próprio domínio e ao Supabase,
`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, escape automático do React,
único `dangerouslySetInnerHTML` (JSON-LD) com `<` escapado. Reavaliar com SRI/hashes quando estáveis.

## ADR-006 — Limite de taxa autoritativo no banco

Limitadores em memória não funcionam entre instâncias serverless. A RPC `request_booking` conta pedidos por
telefone/24h e globais/hora. A Server Action mantém um limitador em memória por IP (hash) como camada extra.

## ADR-007 — Pedido de agendamento antes da agenda

A agenda com horários reais depende de dados da clínica (profissionais, serviços, durações, disponibilidade) e do
esquema da Fase 4. Até lá, o site registra **pedidos** (`booking_requests`, tabela adicional à lista do briefing),
deixando explícito que não são consultas confirmadas. Serão convertidos em `appointments` no Studio.

## ADR-008 — Molar 3D procedural (SDF + marching cubes)

Sem arquivo de modelo para baixar, sem licença de terceiros, sem risco de ser confundido com exame real. Geometria
gerada no cliente em ~50–150 ms, apenas após o carregamento principal. Fallback SVG.

## ADR-009 — Login por link mágico

Sem senhas para pacientes (menos suporte e risco de reutilização). `shouldCreateUser: false`: só a clínica cria
contas. Equipe usará MFA TOTP adicional (Fase 3).

## ADR-010 — Fontes auto-hospedadas

`next/font/google` baixa as fontes no build; nenhuma requisição ao Google em tempo de execução (privacidade/LGPD).

## ADR-011 — Chave de serviço restrita à API administrativa de Auth

Convidar membros da equipe e redefinir MFA de outra pessoa só é possível pela API administrativa do Supabase Auth, que
exige a service role key. Alternativa (Edge Function) adicionaria outro runtime para o mesmo risco. Decisão:
`src/lib/supabase/admin.ts` (server-only) expõe **apenas** `auth.admin`; cada Server Action verifica antes, com a
sessão de quem pediu, `gate === "ok"` (MFA) e a permissão `users.manage`; as mudanças de papel em si são feitas pelas
RPCs com a sessão da pessoa (RLS/RPC continuam valendo) e cada ação é auditada (`record_admin_event`). Sem a chave,
as ações ficam indisponíveis e a interface informa.

## ADR-012 — Permissões como dados e MFA no banco

Papéis recebem permissões (`role_permissions`); políticas consultam `private.has_permission()`, que só considera papéis
de equipe quando o JWT tem `aal = aal2`. Assim, uma sessão roubada sem o segundo fator não lê nada clínico ou
cadastral, mesmo que a interface tenha um bug. Pacientes e responsáveis não usam permissões genéricas: acesso por
vínculo (`patients.profile_id`, `patient_guardians` ativo).

## ADR-013 — Consentimentos append-only

Cada concessão é uma linha; revogar marca `revoked_at`/`revoked_by`. Gatilho impede reescrever ou apagar. Titulares e
responsáveis alteram pelo portal apenas consentimentos opcionais; tratamento e uso de imagem em divulgação exigem
registro presencial pela equipe (`record_consent`).

## ADR-014 — Recepção digital determinística

O briefing pede fluxos gratuitos primeiro. O CG Concierge é um motor de intenções em TypeScript puro
(`features/concierge/engine.ts`) que responde só com dados verificados do contexto, recusa assuntos clínicos (com
orientação de urgência) e não armazena a conversa. Um provedor de IA pode ser plugado depois atrás da mesma
interface `answer()`, desde que autorizado (custo e LGPD).

## ADR-015 — Web Push sem service role

A rota `/api/push/dispatch` autentica-se no banco com um segredo de servidor cujo SHA-256 fica em `clinic_settings`.
As RPCs `claim_push_batch`/`drop_push_subscription` só aceitam esse segredo e devolvem apenas título e link.

## ADR-016 — Conteúdo do site versionado

Cada edição no CG Studio cria uma versão em `website_content`; o site lê a última versão **publicada**, que exige
`verified_at`/`verified_by` (constraint + política). O conteúdo passa por esquemas Zod antes de entrar no site e é
cacheado por tag (`updateTag` na publicação). Sem banco, o site usa a base verificada do código.

## ADR-017 — Fotos comprimidas no navegador

Hospedagens gratuitas limitam o corpo das requisições (~4,5 MB). Fotos clínicas são reduzidas no navegador (máx.
2048 px, JPEG 0,85) antes do envio; o servidor recusa acima de 4,5 MB.
