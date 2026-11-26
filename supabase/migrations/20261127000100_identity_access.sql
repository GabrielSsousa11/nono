-- =============================================================================
-- Migration 0002 — Identidade, papéis, permissões, pacientes, profissionais,
-- responsáveis legais e consentimentos (Fase 3).
--
-- Modelo de acesso:
--   * Papéis (roles) recebem permissões (role_permissions). Usuários recebem papéis (user_roles).
--   * Políticas RLS usam private.has_permission('<recurso>.<ação>').
--   * Papéis de equipe exigem MFA: sem sessão aal2, suas permissões não valem.
--   * Pacientes e responsáveis acessam somente os próprios dados / dos dependentes
--     com vínculo ativo — nunca por permissão genérica.
--   * Recepção e financeiro NÃO recebem permissões clínicas (clinical.*).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catálogo de papéis e permissões
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'dentist', 'receptionist', 'finance', 'patient', 'guardian');

create table public.roles (
  key          public.app_role primary key,
  name         text not null,
  description  text not null,
  is_staff     boolean not null,
  requires_mfa boolean not null
);

insert into public.roles (key, name, description, is_staff, requires_mfa) values
  ('admin',        'Administrador',        'Gestão completa da clínica, equipe e configurações.',             true,  true),
  ('dentist',      'Dentista',             'Atendimento clínico, prontuário, odontograma e planos.',          true,  true),
  ('receptionist', 'Recepcionista',        'Agenda, cadastro administrativo e comunicação. Sem prontuário.',  true,  true),
  ('finance',      'Financeiro',           'Cobranças, pagamentos e despesas. Sem prontuário.',               true,  true),
  ('patient',      'Paciente',             'Acesso aos próprios dados no portal.',                            false, false),
  ('guardian',     'Responsável autorizado','Acompanha dependentes com vínculo registrado.',                  false, false);

create table public.permissions (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null
);

insert into public.permissions (key, description) values
  ('users.manage',            'Convidar membros da equipe e atribuir ou revogar papéis'),
  ('audit.read',              'Consultar a trilha de auditoria'),
  ('settings.manage',         'Alterar configurações da clínica'),
  ('content.manage',          'Editar e publicar o conteúdo do site'),
  ('professionals.read',      'Ver cadastro de profissionais'),
  ('professionals.manage',    'Cadastrar e editar profissionais'),
  ('patients.read',           'Ver dados cadastrais (não clínicos) de pacientes'),
  ('patients.write',          'Cadastrar e editar dados cadastrais de pacientes'),
  ('patients.invite',         'Liberar acesso de pacientes e responsáveis ao portal'),
  ('guardians.manage',        'Registrar e revogar responsáveis legais'),
  ('consents.read',           'Ver consentimentos registrados'),
  ('consents.write',          'Registrar consentimentos coletados presencialmente'),
  ('booking_requests.manage', 'Ver e tratar pedidos de agendamento do site'),
  ('clinical.read',           'Ver prontuário, odontograma, planos e fotos clínicas'),
  ('clinical.write',          'Registrar prontuário, odontograma, planos e fotos clínicas'),
  ('finance.read',            'Ver dados financeiros'),
  ('finance.write',           'Registrar cobranças, pagamentos e despesas');

create table public.role_permissions (
  role       public.app_role not null references public.roles (key) on delete cascade,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission)
select t.r::public.app_role, t.p from (values
  ('admin', 'users.manage'), ('admin', 'audit.read'), ('admin', 'settings.manage'), ('admin', 'content.manage'),
  ('admin', 'professionals.read'), ('admin', 'professionals.manage'),
  ('admin', 'patients.read'), ('admin', 'patients.write'), ('admin', 'patients.invite'),
  ('admin', 'guardians.manage'), ('admin', 'consents.read'), ('admin', 'consents.write'),
  ('admin', 'booking_requests.manage'), ('admin', 'clinical.read'), ('admin', 'clinical.write'),
  ('admin', 'finance.read'), ('admin', 'finance.write'),

  ('dentist', 'professionals.read'), ('dentist', 'patients.read'), ('dentist', 'patients.write'),
  ('dentist', 'patients.invite'), ('dentist', 'guardians.manage'), ('dentist', 'consents.read'),
  ('dentist', 'consents.write'), ('dentist', 'clinical.read'), ('dentist', 'clinical.write'),

  ('receptionist', 'professionals.read'), ('receptionist', 'patients.read'), ('receptionist', 'patients.write'),
  ('receptionist', 'patients.invite'), ('receptionist', 'guardians.manage'), ('receptionist', 'consents.read'),
  ('receptionist', 'consents.write'), ('receptionist', 'booking_requests.manage'),

  ('finance', 'professionals.read'), ('finance', 'patients.read'), ('finance', 'finance.read'), ('finance', 'finance.write')
) as t(r, p);

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

create policy "roles: leitura autenticada" on public.roles for select to authenticated using (true);
create policy "permissions: leitura autenticada" on public.permissions for select to authenticated using (true);
create policy "role_permissions: leitura autenticada" on public.role_permissions for select to authenticated using (true);
-- Catálogo só muda por migration.

-- -----------------------------------------------------------------------------
-- profiles — 1:1 com auth.users, criado automaticamente
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '' check (length(full_name) <= 120),
  -- Cópia do e-mail de auth.users (mantida por gatilho) para a gestão da equipe.
  email      text,
  phone      text check (phone is null or phone ~ '^[0-9]{10,13}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''), lower(new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;
revoke all on function private.handle_user_email_change() from public;

-- -----------------------------------------------------------------------------
-- user_roles
-- -----------------------------------------------------------------------------
create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null references public.roles (key),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_idx on public.user_roles (role);
alter table public.user_roles enable row level security;

-- -----------------------------------------------------------------------------
-- Funções de autorização (usadas pelas políticas). STABLE + SECURITY DEFINER
-- para não depender das próprias políticas (evita recursão).
-- -----------------------------------------------------------------------------
grant usage on schema private to authenticated;

create or replace function private.mfa_verified()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2';
$$;

create or replace function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.key = ur.role
    where ur.user_id = (select auth.uid())
      and ur.role = p_role
      and (not r.requires_mfa or private.mfa_verified())
  );
$$;

create or replace function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.key = ur.role
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = (select auth.uid())
      and rp.permission = p_permission
      and (not r.requires_mfa or private.mfa_verified())
  );
$$;

create or replace function private.is_staff_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.key = ur.role
    where ur.user_id = p_user and r.is_staff
  );
$$;

revoke all on function private.mfa_verified() from public;
revoke all on function private.has_role(public.app_role) from public;
revoke all on function private.has_permission(text) from public;
revoke all on function private.is_staff_member(uuid) from public;
revoke all on function private.handle_new_user() from public;
grant execute on function private.mfa_verified() to authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.is_staff_member(uuid) to authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Políticas de profiles e user_roles
create policy "profiles: ver o próprio" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: equipe vê perfis da equipe" on public.profiles for select to authenticated
  using ((select private.has_permission('professionals.read')) and private.is_staff_member(id));
create policy "profiles: gestão de usuários" on public.profiles for select to authenticated
  using ((select private.has_permission('users.manage')));
create policy "profiles: editar o próprio" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- A API só pode alterar nome e telefone; e-mail vem de auth.users.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy "user_roles: ver os próprios" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_roles: gestão" on public.user_roles for select to authenticated
  using ((select private.has_permission('users.manage')));
-- Escrita somente pelas RPCs grant_role / revoke_role / link_*.

-- -----------------------------------------------------------------------------
-- professionals
-- -----------------------------------------------------------------------------
create table public.professionals (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid unique references public.profiles (id) on delete set null,
  display_name text not null check (length(display_name) between 3 and 120),
  cro_number   text check (cro_number is null or cro_number ~ '^[0-9]{1,8}$'),
  cro_state    char(2) check (cro_state is null or cro_state ~ '^[A-Z]{2}$'),
  specialties  text[] not null default '{}',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint professionals_cro_complete check ((cro_number is null) = (cro_state is null)),
  constraint professionals_cro_unique unique (cro_state, cro_number)
);
alter table public.professionals enable row level security;
create trigger professionals_touch before update on public.professionals
  for each row execute function private.touch_updated_at();

create policy "professionals: equipe lê" on public.professionals for select to authenticated
  using ((select private.has_permission('professionals.read')));
create policy "professionals: gestão insere" on public.professionals for insert to authenticated
  with check ((select private.has_permission('professionals.manage')));
create policy "professionals: gestão edita" on public.professionals for update to authenticated
  using ((select private.has_permission('professionals.manage')))
  with check ((select private.has_permission('professionals.manage')));

-- -----------------------------------------------------------------------------
-- patients — dados cadastrais (NÃO clínicos). Prontuário fica em tabelas
-- clínicas (Fase 7) protegidas por clinical.*.
-- Sem DELETE: prontuário tem prazo legal de guarda; usar `archived_at`.
-- -----------------------------------------------------------------------------
create table public.patients (
  id                         uuid primary key default gen_random_uuid(),
  profile_id                 uuid unique references public.profiles (id) on delete set null,
  full_name                  text not null check (length(full_name) between 3 and 120),
  social_name                text check (social_name is null or length(social_name) between 2 and 120),
  birth_date                 date check (birth_date is null or (birth_date > date '1900-01-01')),
  cpf                        text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  phone                      text check (phone is null or phone ~ '^[0-9]{10,13}$'),
  email                      text check (email is null or (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  responsible_professional_id uuid references public.professionals (id) on delete set null,
  admin_notes                text check (admin_notes is null or length(admin_notes) <= 2000),
  created_by                 uuid references public.profiles (id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  archived_at                timestamptz,
  constraint patients_cpf_unique unique (cpf)
);
create index patients_name_idx on public.patients using gin (to_tsvector('simple', full_name));
create index patients_active_idx on public.patients (created_at desc) where archived_at is null;
alter table public.patients enable row level security;
create trigger patients_touch before update on public.patients
  for each row execute function private.touch_updated_at();

comment on column public.patients.admin_notes is 'Observações administrativas. PROIBIDO registrar informação clínica aqui.';

-- -----------------------------------------------------------------------------
-- patient_guardians — responsabilidade legal e autorização de acompanhamento
-- -----------------------------------------------------------------------------
create type public.guardian_relationship as enum ('mother', 'father', 'legal_guardian', 'curator', 'authorized_adult', 'other');
create type public.guardian_basis as enum ('parental_authority', 'court_order', 'patient_authorization', 'other');

create table public.patient_guardians (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id) on delete cascade,
  guardian_profile_id uuid references public.profiles (id) on delete cascade,
  guardian_name      text not null check (length(guardian_name) between 3 and 120),
  guardian_email     text check (guardian_email is null or guardian_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  relationship       public.guardian_relationship not null,
  legal_basis        public.guardian_basis not null,
  -- Referência ao documento que comprova a responsabilidade (armazenado na Fase 7).
  evidence_note      text check (evidence_note is null or length(evidence_note) <= 500),
  can_view_clinical  boolean not null default false,
  can_schedule       boolean not null default true,
  valid_until        date,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  revoked_at         timestamptz,
  revoked_by         uuid references public.profiles (id) on delete set null,
  revoke_reason      text check (revoke_reason is null or length(revoke_reason) <= 300),
  constraint patient_guardians_revoke_consistent check ((revoked_at is null) = (revoked_by is null))
);
create unique index patient_guardians_active_unique
  on public.patient_guardians (patient_id, guardian_profile_id)
  where revoked_at is null and guardian_profile_id is not null;
create index patient_guardians_guardian_idx on public.patient_guardians (guardian_profile_id) where revoked_at is null;
alter table public.patient_guardians enable row level security;

-- Responsável com vínculo ativo para o paciente (opcionalmente exigindo acesso clínico).
create or replace function private.is_guardian_of(p_patient uuid, p_clinical boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patient_guardians g
    where g.patient_id = p_patient
      and g.guardian_profile_id = (select auth.uid())
      and g.revoked_at is null
      and (g.valid_until is null or g.valid_until >= current_date)
      and (not p_clinical or g.can_view_clinical)
  );
$$;

create or replace function private.is_patient_self(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.patients p where p.id = p_patient and p.profile_id = (select auth.uid()));
$$;

revoke all on function private.is_guardian_of(uuid, boolean) from public;
revoke all on function private.is_patient_self(uuid) from public;
grant execute on function private.is_guardian_of(uuid, boolean) to authenticated;
grant execute on function private.is_patient_self(uuid) to authenticated;

-- Políticas de patients
create policy "patients: o próprio paciente" on public.patients for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "patients: responsável com vínculo ativo" on public.patients for select to authenticated
  using ((select private.is_guardian_of(id)));
create policy "patients: equipe lê cadastro" on public.patients for select to authenticated
  using ((select private.has_permission('patients.read')));
create policy "patients: equipe cadastra" on public.patients for insert to authenticated
  with check ((select private.has_permission('patients.write')) and profile_id is null);
create policy "patients: equipe edita" on public.patients for update to authenticated
  using ((select private.has_permission('patients.write')))
  with check ((select private.has_permission('patients.write')));

-- Vínculo profile_id só muda pela RPC link_patient_account (convite ao portal).
create or replace function private.protect_patient_profile_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_id is distinct from old.profile_id
     and coalesce(current_setting('cg.allow_profile_link', true), '') <> 'on' then
    raise exception 'profile_id só pode ser alterado por link_patient_account' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger patients_protect_profile_link before update on public.patients
  for each row execute function private.protect_patient_profile_link();

-- Políticas de patient_guardians
create policy "guardians: equipe lê" on public.patient_guardians for select to authenticated
  using ((select private.has_permission('patients.read')));
create policy "guardians: o próprio responsável" on public.patient_guardians for select to authenticated
  using (guardian_profile_id = (select auth.uid()));
create policy "guardians: paciente vê seus responsáveis" on public.patient_guardians for select to authenticated
  using ((select private.is_patient_self(patient_id)));
create policy "guardians: equipe registra" on public.patient_guardians for insert to authenticated
  with check ((select private.has_permission('guardians.manage')) and revoked_at is null);
-- Revogação somente pela RPC revoke_guardian (registra autor e motivo).

-- -----------------------------------------------------------------------------
-- consents — histórico de consentimentos (append-only; revogação marca a linha)
-- -----------------------------------------------------------------------------
create type public.consent_kind as enum (
  'privacy_policy',          -- ciência da política de privacidade
  'treatment',               -- consentimento informado para tratamento (com documento)
  'clinical_photos',         -- registro fotográfico clínico (CG Evolution)
  'photo_publicity',         -- uso de imagem em divulgação (exige autorização específica)
  'communications_whatsapp',
  'communications_email',
  'birthday_messages'
);
create type public.consent_method as enum ('portal', 'in_person', 'signed_document');

create table public.consents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  kind          public.consent_kind not null,
  version       text not null check (length(version) between 1 and 40),
  granted       boolean not null,
  method        public.consent_method not null,
  recorded_by   uuid references public.profiles (id) on delete set null,
  on_behalf_of_guardian uuid references public.patient_guardians (id) on delete set null,
  recorded_at   timestamptz not null default now(),
  revoked_at    timestamptz,
  revoked_by    uuid references public.profiles (id) on delete set null,
  constraint consents_revoke_consistent check ((revoked_at is null) = (revoked_by is null)),
  constraint consents_revoke_only_granted check (revoked_at is null or granted)
);
create index consents_patient_idx on public.consents (patient_id, kind, recorded_at desc);
create unique index consents_one_active
  on public.consents (patient_id, kind) where revoked_at is null and granted;
alter table public.consents enable row level security;

create policy "consents: o próprio paciente" on public.consents for select to authenticated
  using ((select private.is_patient_self(patient_id)));
create policy "consents: responsável com vínculo" on public.consents for select to authenticated
  using ((select private.is_guardian_of(patient_id)));
create policy "consents: equipe lê" on public.consents for select to authenticated
  using ((select private.has_permission('consents.read')));
-- Escrita somente pelas RPCs record_consent / set_my_consent.

create or replace function private.forbid_consent_rewrite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'consentimentos não podem ser apagados' using errcode = '42501';
  end if;
  if (new.patient_id, new.kind, new.version, new.granted, new.method, new.recorded_at)
     is distinct from (old.patient_id, old.kind, old.version, old.granted, old.method, old.recorded_at)
     or old.revoked_at is not null then
    raise exception 'consentimento só pode ser revogado, nunca reescrito' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger consents_append_only before update or delete on public.consents
  for each row execute function private.forbid_consent_rewrite();

-- -----------------------------------------------------------------------------
-- booking_requests — equipe passa a tratar os pedidos
-- -----------------------------------------------------------------------------
create policy "booking_requests: equipe lê" on public.booking_requests for select to authenticated
  using ((select private.has_permission('booking_requests.manage')));
create policy "booking_requests: equipe atualiza status" on public.booking_requests for update to authenticated
  using ((select private.has_permission('booking_requests.manage')))
  with check ((select private.has_permission('booking_requests.manage')));

create policy "audit_logs: administradores leem" on public.audit_logs for select to authenticated
  using ((select private.has_permission('audit.read')));
create policy "clinic_settings: equipe lê" on public.clinic_settings for select to authenticated
  using ((select private.has_permission('professionals.read')));
create policy "clinic_settings: gestão" on public.clinic_settings for all to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
create policy "website_content: gestão lê tudo" on public.website_content for select to authenticated
  using ((select private.has_permission('content.manage')));

-- -----------------------------------------------------------------------------
-- Auditoria automática: registra QUEM mudou O QUÊ (nomes das colunas), sem valores.
-- -----------------------------------------------------------------------------
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed text[];
  v_id text;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key not in ('updated_at');
    if cardinality(v_changed) = 0 then return new; end if;
  end if;
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id',
                   to_jsonb(new) ->> 'user_id', to_jsonb(old) ->> 'user_id');
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), lower(tg_op), tg_table_name, v_id,
          case when tg_op = 'UPDATE' then jsonb_build_object('columns', v_changed)
               when tg_table_name = 'user_roles' then jsonb_build_object('role', coalesce(to_jsonb(new), to_jsonb(old)) ->> 'role')
               else '{}'::jsonb end);
  return coalesce(new, old);
end;
$$;
revoke all on function private.audit_row_change() from public;

create trigger audit_patients after insert or update or delete on public.patients
  for each row execute function private.audit_row_change();
create trigger audit_professionals after insert or update or delete on public.professionals
  for each row execute function private.audit_row_change();
create trigger audit_user_roles after insert or delete on public.user_roles
  for each row execute function private.audit_row_change();
create trigger audit_patient_guardians after insert or update on public.patient_guardians
  for each row execute function private.audit_row_change();
create trigger audit_consents after insert or update on public.consents
  for each row execute function private.audit_row_change();

-- =============================================================================
-- RPCs (API pública controlada). Todas verificam permissão internamente.
-- =============================================================================

-- Permissões efetivas do usuário atual (para a interface decidir o que mostrar).
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'roles', coalesce((select jsonb_agg(ur.role order by ur.role) from public.user_roles ur
                        where ur.user_id = (select auth.uid())), '[]'::jsonb),
    'permissions', coalesce((select jsonb_agg(distinct rp.permission order by rp.permission)
                               from public.user_roles ur
                               join public.roles r on r.key = ur.role
                               join public.role_permissions rp on rp.role = ur.role
                              where ur.user_id = (select auth.uid())
                                and (not r.requires_mfa or private.mfa_verified())), '[]'::jsonb),
    'is_staff', private.is_staff_member((select auth.uid())),
    'mfa_verified', private.mfa_verified()
  );
$$;

create or replace function public.grant_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('users.manage') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if p_role in ('patient', 'guardian') then
    raise exception 'papéis de portal são atribuídos pelo vínculo com o paciente' using errcode = '22023';
  end if;
  insert into public.user_roles (user_id, role, granted_by) values (p_user, p_role, (select auth.uid()))
  on conflict do nothing;
end;
$$;

create or replace function public.revoke_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('users.manage') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if p_role = 'admin' and p_user = (select auth.uid()) then
    raise exception 'não é possível remover o próprio papel de administrador' using errcode = '22023';
  end if;
  if p_role = 'admin' and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'a clínica precisa de ao menos um administrador' using errcode = '22023';
  end if;
  delete from public.user_roles where user_id = p_user and role = p_role;
end;
$$;

-- Liga uma conta (já convidada pelo servidor) a um paciente e concede o papel `patient`.
create or replace function public.link_patient_account(p_patient uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('patients.invite') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if private.is_staff_member(p_user) then
    raise exception 'contas da equipe não podem ser vinculadas como paciente' using errcode = '22023';
  end if;
  perform set_config('cg.allow_profile_link', 'on', true);
  update public.patients set profile_id = p_user where id = p_patient and archived_at is null;
  if not found then
    raise exception 'paciente não encontrado ou arquivado' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role, granted_by) values (p_user, 'patient', (select auth.uid()))
  on conflict do nothing;
end;
$$;

-- Liga a conta de um responsável a um vínculo já registrado e concede `guardian`.
create or replace function public.link_guardian_account(p_guardian_link uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('patients.invite') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if private.is_staff_member(p_user) then
    raise exception 'contas da equipe não podem ser vinculadas como responsável' using errcode = '22023';
  end if;
  update public.patient_guardians set guardian_profile_id = p_user
   where id = p_guardian_link and revoked_at is null and guardian_profile_id is null;
  if not found then
    raise exception 'vínculo não encontrado, revogado ou já ligado a uma conta' using errcode = 'P0002';
  end if;
  insert into public.user_roles (user_id, role, granted_by) values (p_user, 'guardian', (select auth.uid()))
  on conflict do nothing;
end;
$$;

create or replace function public.revoke_guardian(p_guardian_link uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if not private.has_permission('guardians.manage') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 3 then
    raise exception 'informe o motivo da revogação' using errcode = '22023';
  end if;
  update public.patient_guardians
     set revoked_at = now(), revoked_by = (select auth.uid()), revoke_reason = btrim(p_reason)
   where id = p_guardian_link and revoked_at is null
  returning guardian_profile_id into v_profile;
  if not found then
    raise exception 'vínculo não encontrado ou já revogado' using errcode = 'P0002';
  end if;
  -- Sem outros vínculos ativos, a conta perde o papel de responsável.
  if v_profile is not null and not exists (
       select 1 from public.patient_guardians
        where guardian_profile_id = v_profile and revoked_at is null) then
    delete from public.user_roles where user_id = v_profile and role = 'guardian';
  end if;
end;
$$;

-- Registro de consentimento pela equipe (presencial ou documento assinado).
create or replace function public.record_consent(
  p_patient uuid, p_kind public.consent_kind, p_version text, p_granted boolean,
  p_method public.consent_method, p_on_behalf_of_guardian uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.has_permission('consents.write') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if p_method = 'portal' then
    raise exception 'consentimento pelo portal é registrado pelo próprio titular' using errcode = '22023';
  end if;
  update public.consents set revoked_at = now(), revoked_by = (select auth.uid())
   where patient_id = p_patient and kind = p_kind and granted and revoked_at is null;
  insert into public.consents (patient_id, kind, version, granted, method, recorded_by, on_behalf_of_guardian)
  values (p_patient, p_kind, p_version, p_granted, p_method, (select auth.uid()), p_on_behalf_of_guardian)
  returning id into v_id;
  return v_id;
end;
$$;

-- Titular (ou responsável) concede/revoga consentimentos opcionais pelo portal.
-- `treatment` e `photo_publicity` exigem coleta formal e não são alteráveis aqui.
create or replace function public.set_my_consent(
  p_patient uuid, p_kind public.consent_kind, p_granted boolean, p_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guardian uuid;
begin
  if p_kind not in ('privacy_policy', 'clinical_photos', 'communications_whatsapp', 'communications_email', 'birthday_messages') then
    raise exception 'este consentimento exige registro presencial' using errcode = '22023';
  end if;
  if not private.is_patient_self(p_patient) then
    select g.id into v_guardian from public.patient_guardians g
     where g.patient_id = p_patient and g.guardian_profile_id = (select auth.uid())
       and g.revoked_at is null and (g.valid_until is null or g.valid_until >= current_date)
     limit 1;
    if v_guardian is null then
      raise exception 'permissão negada' using errcode = '42501';
    end if;
  end if;
  update public.consents set revoked_at = now(), revoked_by = (select auth.uid())
   where patient_id = p_patient and kind = p_kind and granted and revoked_at is null;
  if p_granted then
    insert into public.consents (patient_id, kind, version, granted, method, recorded_by, on_behalf_of_guardian)
    values (p_patient, p_kind, p_version, true, 'portal', (select auth.uid()), v_guardian);
  end if;
end;
$$;

-- Registro em auditoria de ações administrativas feitas pela API de Auth (fora do banco).
create or replace function public.record_admin_event(p_action text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('users.manage') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if p_action not in ('staff.invite', 'staff.mfa_reset', 'patient.invite', 'guardian.invite') then
    raise exception 'ação não reconhecida' using errcode = '22023';
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values ((select auth.uid()), p_action, 'auth.users', p_user::text);
end;
$$;

-- Primeiro administrador: executar UMA vez no SQL Editor (service role), nunca pela API.
create or replace function private.bootstrap_admin(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'usuário % não encontrado — convide-o pelo painel do Supabase primeiro', p_email;
  end if;
  insert into public.profiles (id) values (v_user) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (v_user, 'admin') on conflict do nothing;
  insert into public.audit_logs (action, entity_type, entity_id) values ('bootstrap.admin', 'user_roles', v_user::text);
end;
$$;
revoke all on function private.bootstrap_admin(text) from public, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.my_access()',
    'public.grant_role(uuid, public.app_role)',
    'public.revoke_role(uuid, public.app_role)',
    'public.link_patient_account(uuid, uuid)',
    'public.link_guardian_account(uuid, uuid)',
    'public.revoke_guardian(uuid, text)',
    'public.record_consent(uuid, public.consent_kind, text, boolean, public.consent_method, uuid)',
    'public.set_my_consent(uuid, public.consent_kind, boolean, text)',
    'public.record_admin_event(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Defesa em profundidade nos privilégios (além do RLS):
--  * TRUNCATE ignora RLS — nunca concedido aos papéis da API.
--  * Registros com guarda legal ou trilha de auditoria não aceitam DELETE pela API.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate on public.%I from anon, authenticated', t);
  end loop;
end $$;
alter default privileges in schema public revoke truncate on tables from anon, authenticated;

revoke delete on public.patients, public.consents, public.patient_guardians, public.audit_logs,
                 public.booking_requests, public.professionals
  from anon, authenticated;
