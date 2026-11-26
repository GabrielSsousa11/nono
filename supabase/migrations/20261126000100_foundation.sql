-- =============================================================================
-- Charlene Gonçalves Odontologia — Migration 0001: fundação
-- Fase 1. Esquema completo de pacientes/prontuário chega na Fase 3.
--
-- Princípios:
--   * RLS habilitado em TODA tabela do schema public, sem exceção.
--   * Tabela com RLS e sem política = acesso negado a anon/authenticated.
--   * Escritas públicas passam por funções SECURITY DEFINER com validação,
--     nunca por INSERT direto concedido ao papel anon.
--   * Funções auxiliares ficam no schema `private` (não exposto pela API).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- Utilitário: updated_at automático
-- -----------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- clinic_settings — configuração chave/valor da clínica (somente equipe; Fase 3)
-- -----------------------------------------------------------------------------
create table public.clinic_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_.]{1,63}$'),
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
alter table public.clinic_settings enable row level security;
create trigger clinic_settings_touch before update on public.clinic_settings
  for each row execute function private.touch_updated_at();

comment on table public.clinic_settings is
  'Configurações da clínica. Sem políticas RLS até a Fase 3 (somente service role).';

-- -----------------------------------------------------------------------------
-- website_content — conteúdo editável do site (CG Studio, Fase 10)
-- Somente blocos publicados e verificados são legíveis publicamente.
-- -----------------------------------------------------------------------------
create table public.website_content (
  id           uuid primary key default gen_random_uuid(),
  section      text not null check (section ~ '^[a-z][a-z0-9_]{1,40}$'),
  locale       text not null default 'pt-BR' check (locale = 'pt-BR'),
  payload      jsonb not null,
  version      integer not null default 1 check (version > 0),
  published    boolean not null default false,
  -- Conteúdo factual só pode ser publicado após verificação explícita.
  verified_at  timestamptz,
  verified_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint website_content_published_requires_verification
    check (not published or verified_at is not null),
  constraint website_content_section_version_unique unique (section, locale, version)
);
create index website_content_published_idx
  on public.website_content (section, locale, version desc) where published;
alter table public.website_content enable row level security;
create trigger website_content_touch before update on public.website_content
  for each row execute function private.touch_updated_at();

create policy "website_content: leitura pública do publicado"
  on public.website_content for select
  to anon, authenticated
  using (published);

-- -----------------------------------------------------------------------------
-- audit_logs — trilha de auditoria imutável (append-only)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid references auth.users (id) on delete set null,
  actor_role   text,
  action       text not null check (length(action) between 3 and 80),
  entity_type  text not null check (length(entity_type) between 2 and 60),
  entity_id    text,
  -- Metadados NUNCA devem conter conteúdo clínico; apenas identificadores e diffs de campos não sensíveis.
  metadata     jsonb not null default '{}'::jsonb,
  ip_hash      text
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);
alter table public.audit_logs enable row level security;

create or replace function private.forbid_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs é somente inclusão (append-only)' using errcode = '42501';
end;
$$;
create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function private.forbid_audit_mutation();

create or replace function private.write_audit(
  p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
revoke all on function private.write_audit(text, text, text, jsonb) from public;

-- -----------------------------------------------------------------------------
-- booking_requests — pedidos de agendamento feitos pelo site público.
-- Não é a agenda (appointments chega na Fase 4): é um pedido de contato que a
-- recepção confirma. Retenção: 12 meses para pedidos não convertidos.
-- -----------------------------------------------------------------------------
create type public.booking_request_status as enum ('new', 'contacted', 'scheduled', 'declined', 'spam');
create type public.day_period as enum ('morning', 'afternoon', 'evening', 'any');

create table public.booking_requests (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  full_name        text not null check (length(full_name) between 3 and 120),
  phone_digits     text not null check (phone_digits ~ '^[0-9]{10,13}$'),
  email            text check (email is null or (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  service_interest text check (service_interest is null or length(service_interest) <= 80),
  preferred_period public.day_period not null default 'any',
  message          text check (message is null or length(message) <= 600),
  consent_version  text not null check (length(consent_version) between 1 and 40),
  consent_at       timestamptz not null default now(),
  status           public.booking_request_status not null default 'new',
  handled_at       timestamptz,
  handled_by       uuid references auth.users (id) on delete set null,
  retain_until     timestamptz not null default (now() + interval '12 months')
);
create index booking_requests_phone_recent_idx on public.booking_requests (phone_digits, created_at desc);
create index booking_requests_status_idx on public.booking_requests (status, created_at desc);
create index booking_requests_created_idx on public.booking_requests (created_at desc);
alter table public.booking_requests enable row level security;
-- Sem políticas: leitura/edição pela equipe chega na Fase 3 (papéis). Escrita pública só via RPC abaixo.

comment on table public.booking_requests is
  'Pedidos de agendamento do site. Dados pessoais (LGPD). Não registrar informações clínicas.';

-- -----------------------------------------------------------------------------
-- RPC pública: request_booking
-- Validação no banco + limite de taxa por telefone e global (anti-abuso),
-- independente de quantas instâncias do servidor web existirem.
-- -----------------------------------------------------------------------------
create or replace function public.request_booking(
  p_full_name text,
  p_phone text,
  p_email text,
  p_service_interest text,
  p_preferred_period public.day_period,
  p_message text,
  p_consent_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name   text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_email  text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_id     uuid;
begin
  if p_consent_version is null or length(btrim(p_consent_version)) = 0 then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  if (select count(*) from public.booking_requests
       where phone_digits = v_phone and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'phone';
  end if;

  if (select count(*) from public.booking_requests
       where created_at > now() - interval '1 hour') >= 120 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'global';
  end if;

  insert into public.booking_requests
    (full_name, phone_digits, email, service_interest, preferred_period, message, consent_version)
  values
    (v_name, v_phone, v_email,
     nullif(btrim(coalesce(p_service_interest, '')), ''),
     coalesce(p_preferred_period, 'any'),
     nullif(btrim(coalesce(p_message, '')), ''),
     btrim(p_consent_version))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_booking(text, text, text, text, public.day_period, text, text) from public;
grant execute on function public.request_booking(text, text, text, text, public.day_period, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Retenção: remove pedidos vencidos que não viraram agendamento.
-- Agendar via pg_cron no Supabase (ver docs/SECURITY_LGPD.md):
--   select cron.schedule('purge-booking-requests', '17 3 * * *', 'select private.purge_expired_booking_requests()');
-- -----------------------------------------------------------------------------
create or replace function private.purge_expired_booking_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.booking_requests
   where retain_until < now() and status <> 'scheduled';
  get diagnostics v_count = row_count;
  insert into public.audit_logs (action, entity_type, metadata)
  values ('retention.purge', 'booking_requests', jsonb_build_object('deleted', v_count));
  return v_count;
end;
$$;
revoke all on function private.purge_expired_booking_requests() from public;
