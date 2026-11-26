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

## Próximas fases

- Papéis e RLS por função; recepção/financeiro sem acesso ao prontuário (`clinical_records`, `tooth_records`,
  `clinical_photos` só dentista/admin com `aal2`).
- MFA TOTP obrigatório para equipe; sessões curtas para Studio.
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
