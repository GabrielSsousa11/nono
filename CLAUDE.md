@AGENTS.md

# Charlene Gonçalves Odontologia — regras permanentes do projeto

Plataforma odontológica "Beyond the Smile": site institucional + portal do paciente + CG Studio (painel da clínica).
Interface 100% em **português brasileiro**. Leia `docs/ARCHITECTURE.md` e `docs/ROADMAP.md` antes de começar uma fase.

## Regras absolutas

1. **Nunca inventar informações sobre a clínica** (CRO, endereço, telefones, especialidades, serviços, horários,
   depoimentos, fotos, números). Dados factuais ficam em `src/lib/content/official.ts` como `null`/`[]` até a clínica
   confirmar. Componentes não exibem nada no lugar de dados ausentes em produção.
2. **Dados sintéticos só em desenvolvimento**: `src/lib/content/dev-fixtures.ts`, ativados com
   `CG_CONTENT_SOURCE=fixtures`. O build falha se combinado com `CG_DEPLOY_ENV=production`. Valores sintéticos devem ser
   obviamente falsos (`0000`, `.invalid`, "sintético").
3. **Nada de botão sem função nem integração simulada.** Sem backend configurado, o recurso informa que está
   indisponível — nunca finge sucesso. Status dos módulos do portal vem de `src/lib/modules.ts` e só muda para
   `available` quando o critério de aceitação da fase for cumprido.
4. **Serviço pago só com autorização explícita** da pessoa responsável. Registre em `docs/HOSTING_AND_COSTS.md`.
5. **Dados de saúde são sensíveis (LGPD art. 11)**: nunca em logs, analytics, cache público, service worker ou serviços
   de IA não autorizados. Logs registram apenas códigos de erro e IDs.
6. **RLS em toda tabela** do schema `public`. Escrita pública somente via função `SECURITY DEFINER` validada.
   Políticas usam `private.has_permission('<recurso>.<ação>')`; papéis de equipe só valem com sessão `aal2` (MFA).
   Recepção e financeiro não recebem permissões `clinical.*`. `TRUNCATE` nunca é concedido à API; tabelas com guarda
   legal não aceitam `DELETE`. A service role key só pode aparecer em `src/lib/supabase/admin.ts`, para a API
   administrativa de Auth, depois de verificar a permissão de quem pediu (ADR-011) — nunca para ler/gravar tabelas.
7. **Não declarar concluído só porque a interface existe**: interface + backend + persistência + permissões + estados
   de carregamento/erro + mobile + testes.

## Stack e convenções

- Next.js 16 (App Router, `cacheComponents`, `proxy.ts` em vez de middleware), React 19, TypeScript strict, Tailwind 4.
  **Consulte `node_modules/next/dist/docs/` antes de usar APIs do Next** — elas mudaram em relação ao treinamento.
- Leitura de cookies/sessão somente via `getSessionContext()` (`src/lib/auth/session.ts`), dentro de `<Suspense>`.
  Páginas públicas devem permanecer estáticas. Toda página protegida confere `gate === "ok"` mesmo já estando sob o
  layout que redireciona.
- Redirecionamentos em route handlers usam `siteUrl()`, nunca `request.url` (host interno do servidor).
- Arquivos `"use server"` exportam apenas funções assíncronas; constantes e schemas ficam em módulos irmãos.
- Regras de negócio puras e testáveis separadas das Server Actions (ex.: `features/booking/submit.ts` ×
  `features/booking/actions.ts`).
- Validação com Zod no cliente **e** no servidor; o banco também valida com `CHECK`.
- Estrutura: `src/app` (rotas), `src/features/<domínio>` (schema, ações, componentes do domínio), `src/components`
  (UI compartilhada, `home/`, `three/`), `src/lib` (env, conteúdo, supabase, utilitários), `supabase/migrations`
  (SQL versionado), `supabase/tests` (testes SQL), `tests/unit` (Vitest), `tests/e2e` (Playwright).
- Migrations: `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`, nunca editar uma migration já aplicada em ambiente
  compartilhado — crie outra.

## Design system

- Tokens em `src/app/globals.css` (`@theme`). Paleta: ivory `#F7F4ED`, champagne `#D5C6B2`, gold `#B29A70`,
  olive `#414D40`, onyx `#202420` (+ gold-ink `#7A6542`, mist `#5D655B`, stone `#E9E3D7` para contraste).
- **Gold puro não é cor de texto sobre fundo claro** (2,5:1). Use `gold-ink`. Contrastes documentados no CSS.
- Cormorant Garamond (títulos, `font-display`) + Manrope (texto/UI).
- Sem rótulos em caixa alta acima de títulos, sem cards com sombra genérica, sem numeração decorativa (só em
  sequências reais), sem gradientes chamativos. Um único momento coreografado por página; respeitar
  `prefers-reduced-motion`.

## Comandos

```bash
npm run dev             # desenvolvimento (conteúdo oficial)
npm run dev:fixtures    # desenvolvimento com dados sintéticos (todas as seções visíveis)
npm run verify          # lint + typecheck + unit + banco + build
npm run test:e2e        # Playwright contra build de produção + mock do Supabase
npm run test:db         # aplica migrations num Postgres descartável e roda supabase/tests (matriz de acesso)
npm run content:check   # lista dados pendentes para publicação (sai 1 se houver bloqueantes)
```

Antes de cada commit: `npm run verify` e, se mexeu em UI/rotas, `npm run test:e2e`.
