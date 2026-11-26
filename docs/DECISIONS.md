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

## ADR-005 — CSP sem nonce nas páginas públicas

Nonce exige renderização dinâmica de todas as páginas (pior LCP/custo). Páginas públicas não têm dados pessoais;
CSP restringe origens, `frame-ancestors 'none'`, `object-src 'none'`. **Fase 3:** áreas autenticadas passam a usar
CSP com nonce via `proxy.ts`.

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
