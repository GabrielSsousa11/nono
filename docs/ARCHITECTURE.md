# Arquitetura

## Visão geral

```
                 ┌──────────────────────────── Navegador / PWA ────────────────────────────┐
                 │  Site público (estático)   Portal do paciente   CG Studio (equipe, MFA) │
                 └──────────────┬──────────────────────┬───────────────────┬──────────────┘
                                │ HTML estático/CDN     │ RSC + Server Actions (sessão em cookie httpOnly)
                 ┌──────────────▼──────────────────────▼───────────────────▼──────────────┐
                 │ Next.js 16 (Node) — App Router, Cache Components, proxy.ts (sessão)     │
                 │  features/*  ──►  regras puras (testáveis)  ──►  cliente Supabase       │
                 └──────────────────────────────┬─────────────────────────────────────────┘
                                                │ HTTPS (chave publishable + JWT do usuário)
                 ┌──────────────────────────────▼─────────────────────────────────────────┐
                 │ Supabase: Postgres (RLS em tudo) · Auth (link mágico, MFA TOTP) ·       │
                 │ Storage privado (URLs assinadas) · pg_cron (retenção, automações)       │
                 └────────────────────────────────────────────────────────────────────────┘
```

O banco é a **fronteira de segurança**: mesmo que o código da aplicação tenha um bug, RLS e funções
`SECURITY DEFINER` com validação impedem acesso indevido. O app web nunca usa a service role key.

## Camadas

| Camada   | Local                    | Responsabilidade                                                                                                      |
| -------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Rotas    | `src/app`                | Composição de páginas, metadados, rotas de API mínimas (`auth/confirm`).                                              |
| Domínios | `src/features/<domínio>` | `schema.ts` (Zod), regra pura (`submit.ts`), `actions.ts` (Server Action fina), componentes do domínio.               |
| UI       | `src/components`         | `ui/` (primitivos), `home/` (seções), `three/` (3D), `pwa/`.                                                          |
| Infra    | `src/lib`                | `env.ts` (validação de env), `content/` (conteúdo verificado), `supabase/` (clientes), `rate-limit.ts`, `modules.ts`. |
| Banco    | `supabase/migrations`    | Esquema, RLS, funções, retenção. Testado por `supabase/tests/*.test.sql`.                                             |
| Sessão   | `src/proxy.ts`           | Renova sessão e protege `/portal` (matcher restrito — páginas públicas ficam estáticas).                              |

## Conteúdo verificável

`getSiteContent()` é o único ponto de acesso. Hoje lê `official.ts`; na Fase 10 lerá a tabela `website_content`
(somente linhas `published` — que exigem `verified_at` por constraint). Seções com dados ausentes:

- **produção**: não renderizam;
- **desenvolvimento**: mostram aviso "Pendente de dados oficiais";
- **fixtures**: mostram dados sintéticos + faixa vermelha "não publicar".

`npm run content:check` lista o que falta e falha com lacunas bloqueantes (CRO, canal de contato, controlador LGPD).

## Página inicial e 3D

- Hero renderizado no servidor, animação de entrada em CSS (não depende de hidratação → LCP é o título).
- O molar é **procedural**: um campo de distância (`components/three/tooth-sdf.ts`) poligonizado com marching cubes
  no cliente. Nenhum arquivo de modelo é baixado. É esquemático e rotulado como "ilustração conceitual".
- Carregamento progressivo: ilustração SVG estática primeiro; o Canvas é importado dinamicamente em
  `requestIdleCallback`, e só se o aparelho tiver WebGL2, ≥4 núcleos e não estiver em economia de dados.
  Qualidade "high" (resolução 84³) em desktops fortes, "low" (56³) nos demais. O loop para quando o hero sai da tela.
- `prefers-reduced-motion`: sem rotação automática nem parallax; a rolagem continua girando suavemente o modelo.

## Agendamento (estado atual)

Fase 2 entrega o **pedido de agendamento**: formulário → Server Action → regra pura → RPC
`public.request_booking` (valida, normaliza e limita 3 pedidos/telefone/24h e 120/h globais) → `booking_requests`.
O limitador em memória da Server Action é só uma camada extra. A agenda real (disponibilidade, conflitos com
`EXCLUDE USING gist`, lista de espera) chega na Fase 4.

## Identidade e autorização (Fase 3)

```
auth.users ──1:1── profiles ──< user_roles >── roles ──< role_permissions >── permissions
                       │
                       ├── patients.profile_id (paciente com acesso ao portal)
                       └── patient_guardians.guardian_profile_id (responsável com vínculo ativo)
```

- `private.has_permission(p)` — verdadeiro se algum papel da pessoa concede `p` **e**, para papéis de equipe, a sessão
  é `aal2`. Todas as políticas de equipe usam essa função.
- Paciente/responsável: acesso por vínculo (`private.is_patient_self`, `private.is_guardian_of`), nunca por permissão.
- Escritas sensíveis só por RPC: `grant_role`, `revoke_role`, `link_patient_account`, `link_guardian_account`,
  `revoke_guardian`, `record_consent`, `set_my_consent`, `record_admin_event`. `my_access()` alimenta a interface.
- Aplicação: `getSessionContext()` (usuário, acesso, AAL, fatores) → `resolveStudioGate()` decide
  `login | forbidden | enroll_mfa | verify_mfa | ok`. O layout do Studio redireciona; cada página reconfere.

## Autenticação

Link mágico por e-mail (`signInWithOtp`, `shouldCreateUser: false` — contas criadas pela clínica). Resposta
idêntica para e-mails cadastrados ou não (anti-enumeração). Confirmação por `token_hash` em `/auth/confirm` com
`next` restrito a caminhos internos. MFA TOTP obrigatório para equipe na Fase 3 (verificação de `aal2` no
proxy e nas políticas RLS das tabelas clínicas).

## PWA

`app/manifest.ts` + `public/sw.js`. O service worker guarda apenas `/offline`, ícones e `/_next/static`.
Navegações são rede-primeiro com fallback offline e **nunca** são armazenadas; rotas privadas e Supabase são
ignoradas pelo SW.

## Testes

| Tipo     | Ferramenta                      | O que cobre                                                                                                    |
| -------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unitário | Vitest                          | schemas, regra do pedido, limitador, conteúdo/gating, SDF do dente.                                            |
| Banco    | `scripts/db/test-migrations.sh` | migrations aplicadas num Postgres 16 descartável com stub do Supabase; RLS, RPC, retenção, auditoria imutável. |
| E2E      | Playwright (desktop + Pixel 7)  | build de produção com conteúdo oficial + mock local do Supabase; fluxos, cabeçalhos, PWA, axe WCAG 2.2 AA.     |
