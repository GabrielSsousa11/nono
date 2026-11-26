# Publicação gratuita para apresentação

Este roteiro coloca a plataforma no ar **sem custo**, com **dados sintéticos de demonstração**. Leva cerca de 40
minutos. Para uso real com pacientes, reveja `docs/HOSTING_AND_COSTS.md` (backups, termos comerciais).

> Planos gratuitos mudam. Confira os limites nas páginas oficiais antes de começar.

## 1. Banco, login e arquivos — Supabase (plano Free)

1. Crie uma conta em supabase.com e um projeto novo. **Região: South America (São Paulo)**. Guarde a senha do banco.
2. Gere o esquema completo: `npm run db:bundle` → arquivo `supabase/dist/schema.sql`.
3. No painel: **SQL Editor → New query**, cole o conteúdo de `schema.sql` e execute (uma única vez).
4. **Database → Extensions**: ative `pg_cron`. Depois rode no SQL Editor:
   ```sql
   select cron.schedule('cg-automations', '*/15 * * * *', 'select private.schedule_automations(); select private.run_automation_jobs(200);');
   select cron.schedule('cg-retention', '17 3 * * *', 'select private.purge_expired_booking_requests();');
   ```
5. **Authentication → Sign In / Providers → Email**: desative "Allow new users to sign up". Ative **MFA (TOTP)** em
   Authentication → Multi-Factor.
6. **Authentication → URL Configuration**: Site URL = endereço do site (passo 2 abaixo); Redirect URLs =
   `https://SEU-ENDERECO/auth/confirm`.
7. **Authentication → Emails → Templates** — troque o link de "Magic Link" e de "Invite user" por:
   - Magic Link: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/continuar`
   - Invite: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/continuar`
8. **Settings → API**: copie a _Project URL_, a chave _publishable_ (ou _anon_) e a _service_role_ (secreta).

> O e-mail padrão do Supabase envia poucas mensagens por hora — suficiente para a apresentação.

## 2. Site — Vercel (plano Hobby) ou Netlify (plano Free)

Para uma **demonstração** não comercial, o plano Hobby da Vercel atende. Para operação comercial, veja
`HOSTING_AND_COSTS.md`.

1. Importe o repositório do GitHub na Vercel (framework detectado: Next.js).
2. Variáveis de ambiente:

| Variável                               | Valor                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | `https://seu-projeto.vercel.app`                                                                                                |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL                                                                                                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave publishable/anon                                                                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`            | service_role (**secreta**, só no servidor)                                                                                      |
| `CG_DEPLOY_ENV`                        | `preview` (não indexa em buscadores)                                                                                            |
| `CG_CONTENT_SOURCE`                    | `fixtures` para mostrar todas as seções com dados sintéticos e a faixa "não publicar"; `official` para só o conteúdo verificado |

3. Publique. Volte ao Supabase e ajuste Site URL/Redirect URLs com o endereço final.

### Web Push (opcional, gratuito)

`npx web-push generate-vapid-keys` e defina `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT=mailto:seu-email` e `PUSH_DISPATCH_SECRET` (texto aleatório com 32+ caracteres). No CG Studio →
Automações, clique em "Autorizar disparador no banco". Agende a chamada a cada 5 minutos com pg_net:

```sql
create extension if not exists pg_net;
select cron.schedule('cg-push', '*/5 * * * *', $$
  select net.http_post('https://SEU-ENDERECO/api/push/dispatch', '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Authorization', 'Bearer SEU_PUSH_DISPATCH_SECRET'));
$$);
```

## 3. Dados de demonstração

1. Supabase → **Authentication → Users → Add user** (marque _Auto Confirm User_) duas vezes, com e-mails que você
   abre. Dica Gmail: `voce+admin@gmail.com` e `voce+paciente@gmail.com` chegam na mesma caixa.
2. SQL Editor: cole `supabase/seed/demo.sql`, execute e depois:
   ```sql
   select private.seed_demo('voce+admin@gmail.com', 'voce+paciente@gmail.com');
   ```

A conta admin também é dentista na demonstração. Pacientes, consultas, valores e textos são sintéticos e marcados
com "(demo)".

## 4. Roteiro sugerido da apresentação

1. **Site** — hero com o molar 3D (role a página), manifesto, tratamentos interativos, jornada, recepção digital
   (pergunte "Qual o horário?" e "Estou com dor, que remédio tomo?" para mostrar a trava de segurança).
2. **Pedido de agendamento** pelo formulário do site.
3. **CG Studio** (entre com o e-mail admin; no primeiro acesso, cadastre o autenticador no celular):
   visão geral → Pedidos do site → "Agendar este pedido" → Agenda (dia/semana/mês) → Paciente "Marina Exemplo (demo)"
   → abas Prontuário/odontograma (clique nos dentes), Fotos, Cuidados, Financeiro → Indicadores → Conteúdo do site
   → Auditoria (mostra quem fez cada alteração).
4. **Portal** (janela anônima, e-mail paciente): Início, Consultas (agende/remarque), CG Daily (cronômetro, foguinho,
   calendário), Sorriso 3D, Jornada, Cuidados ("Li e entendi"), Passaporte (QR no dia da consulta), troca para a
   dependente "Lia Exemplo (demo)" no seletor do topo (CG Family), Meus dados (autorizações).
5. **Instalar no celular**: menu do navegador → "Adicionar à tela inicial".

## 5. Antes de usar com pacientes reais

- Revisar decisões de custo (backups!) e assinar contrato de operador de dados (LGPD) com os provedores.
- Preencher conteúdo oficial verificado (`npm run content:check` sem bloqueantes) e revisão jurídica da política.
- Projeto Supabase **novo**, sem `seed/demo.sql`, com `CG_DEPLOY_ENV=production` e `CG_CONTENT_SOURCE=official`.
