# Segurança e LGPD

> A conformidade final deve ser revisada por profissionais jurídicos e de segurança antes da produção.

## Implementado (Fases 1–2)

- RLS habilitado em todas as tabelas (teste automatizado falha se alguma tabela ficar sem RLS).
- Escrita pública apenas via `public.request_booking` (SECURITY DEFINER, `search_path` vazio, validação, limite de taxa).
- `audit_logs` somente inclusão (trigger bloqueia UPDATE/DELETE).
- `website_content` só pode ser publicado com `verified_at` (constraint).
- Retenção: `booking_requests` expira em 12 meses se não convertido — `private.purge_expired_booking_requests()`.
  Agendar no Supabase: `select cron.schedule('purge-booking-requests','17 3 * * *','select private.purge_expired_booking_requests()');`
- Validação Zod no cliente e servidor + CHECK no banco. Honeypot no formulário.
- Logs da aplicação sem dados pessoais (teste garante).
- Cabeçalhos: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP.
- Login sem senha, sem criação pública de contas, resposta anti-enumeração, redirecionamento só interno.
- Service worker não armazena rotas privadas nem respostas do Supabase.
- Sem analytics, sem fontes/scripts de terceiros em tempo de execução.
- Consentimento versionado (`consent_version`) gravado em cada pedido.

## Implementado (Fase 3)

- Seis perfis de acesso com permissões em tabela; papéis de equipe exigem MFA (`aal2`) no próprio banco.
- Recepção e financeiro sem permissões clínicas; financeiro sem pedidos de agendamento.
- Paciente acessa só o próprio cadastro; responsável só dependentes com vínculo ativo e não expirado; acesso clínico
  do responsável é opcional (`can_view_clinical`, padrão falso).
- Vínculos e papéis só por RPC auditada; revogação de responsável exige motivo e remove o papel sem outros vínculos.
- Consentimentos versionados, append-only, com autor e, quando for o caso, o responsável que agiu.
- `TRUNCATE` revogado da API (ignora RLS); `DELETE` revogado em pacientes, consentimentos, responsáveis, auditoria,
  pedidos e profissionais.
- Auditoria automática registra quem alterou quais colunas, sem copiar valores pessoais.
- Rotas autenticadas com `Cache-Control: private, no-store`, inclusive nos redirecionamentos.

## Próximas fases

- Tabelas clínicas (`clinical_records`, `tooth_records`, `clinical_photos`…) protegidas por `clinical.*`.
- Duração de sessão menor para a equipe (configurar "time-box" de sessão no Supabase Auth).
- Storage privado com URLs assinadas de curta duração; fotos clínicas nunca públicas.
- Auditoria de leitura de dados clínicos (função de acesso que registra em `audit_logs`).
- Backups + **teste de restauração** documentado trimestralmente.
- Fluxo de direitos do titular (art. 18) no Studio, com prazo e registro.
- Retenção de prontuário: mínimo legal de guarda (conferir normas do CFO e legislação vigente com assessoria jurídica);
  exclusão bloqueada antes do prazo.
- Proteção de menores (art. 14): consentimento do responsável legal registrado em `patient_guardians`/`consents`.

## Configuração obrigatória no Supabase (produção)

- Auth → desabilitar signup público; template de e-mail do link mágico usando
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/portal`.
- Auth → URL do site e redirect permitido apenas `https://<domínio>/auth/confirm`.
- SMTP próprio; região sa-east-1; habilitar MFA TOTP; habilitar pg_cron.
- Template de convite (`Invite user`) apontando para `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/continuar`.
- `SUPABASE_SERVICE_ROLE_KEY` apenas como segredo de servidor na hospedagem.
- Primeira administradora: convidar pelo painel do Supabase e executar `select private.bootstrap_admin('email');`.
