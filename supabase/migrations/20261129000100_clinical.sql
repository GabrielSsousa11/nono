-- =============================================================================
-- Migration 0004 — Dados clínicos (Fases 6 e 7)
-- clinical_records, dental_charts, tooth_records, treatment_plans,
-- treatment_stages, clinical_photos, documents (+ buckets privados).
--
-- Acesso: equipe com clinical.read/clinical.write (admin, dentista, com MFA).
-- Paciente/responsável com acesso clínico: somente registros marcados
-- `visible_to_patient`. Recepção e financeiro: nenhum acesso.
-- Guarda: prontuário não aceita DELETE; correções são novos registros.
-- Lei 13.787/2018: prazo mínimo de 20 anos (confirmar com assessoria jurídica).
-- =============================================================================

create or replace function private.can_view_patient_clinical(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('clinical.read')
      or private.is_patient_self(p_patient)
      or private.is_guardian_of(p_patient, true);
$$;
revoke all on function private.can_view_patient_clinical(uuid) from public;
grant execute on function private.can_view_patient_clinical(uuid) to authenticated;

-- Paciente/responsável (não equipe) vendo apenas o que foi liberado.
create or replace function private.patient_side_can_view(p_patient uuid, p_visible boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_visible and (private.is_patient_self(p_patient) or private.is_guardian_of(p_patient, true));
$$;
revoke all on function private.patient_side_can_view(uuid, boolean) from public;
grant execute on function private.patient_side_can_view(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- clinical_records — prontuário (append-only)
-- -----------------------------------------------------------------------------
create type public.clinical_record_kind as enum ('anamnesis', 'evolution', 'exam', 'note');

create table public.clinical_records (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id),
  professional_id    uuid references public.professionals (id) on delete set null,
  appointment_id     uuid references public.appointments (id) on delete set null,
  kind               public.clinical_record_kind not null,
  content            text not null check (length(content) between 1 and 10000),
  amends             uuid references public.clinical_records (id),
  visible_to_patient boolean not null default false,
  recorded_by        uuid references public.profiles (id) on delete set null,
  recorded_at        timestamptz not null default now(),
  retain_until       date not null default (current_date + interval '20 years')::date
);
create index clinical_records_patient_idx on public.clinical_records (patient_id, recorded_at desc);
alter table public.clinical_records enable row level security;
create policy "clinical_records: equipe clínica lê" on public.clinical_records for select to authenticated
  using ((select private.has_permission('clinical.read')));
create policy "clinical_records: paciente vê liberados" on public.clinical_records for select to authenticated
  using ((select private.patient_side_can_view(patient_id, visible_to_patient)));
create policy "clinical_records: equipe clínica registra" on public.clinical_records for insert to authenticated
  with check ((select private.has_permission('clinical.write')) and recorded_by = (select auth.uid()));
revoke update, delete on public.clinical_records from anon, authenticated;
create trigger audit_clinical_records after insert on public.clinical_records for each row execute function private.audit_row_change();

-- -----------------------------------------------------------------------------
-- dental_charts + tooth_records (CG Smile 3D)
-- -----------------------------------------------------------------------------
create type public.dentition as enum ('permanent', 'deciduous', 'mixed');
create type public.tooth_record_state as enum ('existing', 'planned', 'completed', 'observation');

create table public.dental_charts (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null unique references public.patients (id),
  dentition          public.dentition not null default 'permanent',
  -- Modelo 3D individual legítimo importado pela clínica (caminho no Storage). Nulo = representação esquemática.
  individual_model_path text,
  notes              text check (notes is null or length(notes) <= 2000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table public.dental_charts enable row level security;
create trigger dental_charts_touch before update on public.dental_charts for each row execute function private.touch_updated_at();
create policy "dental_charts: visão clínica" on public.dental_charts for select to authenticated
  using ((select private.can_view_patient_clinical(patient_id)));
create policy "dental_charts: equipe clínica cria" on public.dental_charts for insert to authenticated
  with check ((select private.has_permission('clinical.write')));
create policy "dental_charts: equipe clínica edita" on public.dental_charts for update to authenticated
  using ((select private.has_permission('clinical.write'))) with check ((select private.has_permission('clinical.write')));

create or replace function private.valid_fdi(p smallint)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p / 10 between 1 and 4 and p % 10 between 1 and 8) or (p / 10 between 5 and 8 and p % 10 between 1 and 5);
$$;

create table public.tooth_records (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id),
  tooth_fdi          smallint not null check (private.valid_fdi(tooth_fdi)),
  surfaces           text[] not null default '{}' check (surfaces <@ array['M', 'D', 'O', 'I', 'V', 'L', 'P']::text[]),
  state              public.tooth_record_state not null,
  procedure          text not null check (length(procedure) between 2 and 120),
  notes              text check (notes is null or length(notes) <= 1000),
  performed_on       date,
  professional_id    uuid references public.professionals (id) on delete set null,
  treatment_stage_id uuid,
  visible_to_patient boolean not null default true,
  recorded_by        uuid references public.profiles (id) on delete set null,
  recorded_at        timestamptz not null default now(),
  superseded_at      timestamptz,
  constraint tooth_records_completed_date check (state <> 'completed' or performed_on is not null)
);
create index tooth_records_patient_idx on public.tooth_records (patient_id, tooth_fdi, recorded_at desc);
alter table public.tooth_records enable row level security;
create policy "tooth_records: equipe clínica lê" on public.tooth_records for select to authenticated
  using ((select private.has_permission('clinical.read')));
create policy "tooth_records: paciente vê liberados" on public.tooth_records for select to authenticated
  using ((select private.patient_side_can_view(patient_id, visible_to_patient)));
create policy "tooth_records: equipe clínica registra" on public.tooth_records for insert to authenticated
  with check ((select private.has_permission('clinical.write')) and recorded_by = (select auth.uid()));
-- Única alteração permitida: marcar como substituído (histórico preservado).
create policy "tooth_records: equipe clínica substitui" on public.tooth_records for update to authenticated
  using ((select private.has_permission('clinical.write'))) with check ((select private.has_permission('clinical.write')));
revoke update, delete on public.tooth_records from anon, authenticated;
grant update (superseded_at, visible_to_patient) on public.tooth_records to authenticated;
create trigger audit_tooth_records after insert or update on public.tooth_records for each row execute function private.audit_row_change();

-- -----------------------------------------------------------------------------
-- treatment_plans + treatment_stages (CG Journey)
-- -----------------------------------------------------------------------------
create type public.plan_status as enum ('draft', 'active', 'completed', 'cancelled');
create type public.stage_status as enum ('pending', 'scheduled', 'in_progress', 'completed', 'skipped');

create table public.treatment_plans (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id),
  title              text not null check (length(title) between 3 and 120),
  goals              text check (goals is null or length(goals) <= 2000),
  status             public.plan_status not null default 'draft',
  professional_id    uuid references public.professionals (id) on delete set null,
  estimated_end      date,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index treatment_plans_patient_idx on public.treatment_plans (patient_id, created_at desc);
alter table public.treatment_plans enable row level security;
create trigger treatment_plans_touch before update on public.treatment_plans for each row execute function private.touch_updated_at();
create trigger audit_treatment_plans after insert or update on public.treatment_plans for each row execute function private.audit_row_change();
create policy "treatment_plans: equipe clínica lê" on public.treatment_plans for select to authenticated
  using ((select private.has_permission('clinical.read')));
create policy "treatment_plans: paciente vê ativos e concluídos" on public.treatment_plans for select to authenticated
  using ((select private.patient_side_can_view(patient_id, status in ('active', 'completed'))));
create policy "treatment_plans: equipe clínica cria" on public.treatment_plans for insert to authenticated
  with check ((select private.has_permission('clinical.write')));
create policy "treatment_plans: equipe clínica edita" on public.treatment_plans for update to authenticated
  using ((select private.has_permission('clinical.write'))) with check ((select private.has_permission('clinical.write')));
revoke delete on public.treatment_plans from anon, authenticated;

create table public.treatment_stages (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid not null references public.treatment_plans (id) on delete cascade,
  patient_id         uuid not null references public.patients (id),
  position           smallint not null check (position between 1 and 200),
  title              text not null check (length(title) between 2 and 120),
  description        text check (description is null or length(description) <= 2000),
  guidance           text check (guidance is null or length(guidance) <= 2000),
  status             public.stage_status not null default 'pending',
  estimated_date     date,
  appointment_id     uuid references public.appointments (id) on delete set null,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint treatment_stages_position_unique unique (plan_id, position) deferrable initially deferred,
  constraint treatment_stages_completed check ((status = 'completed') = (completed_at is not null))
);
alter table public.tooth_records
  add constraint tooth_records_stage_fk foreign key (treatment_stage_id) references public.treatment_stages (id) on delete set null;
alter table public.treatment_stages enable row level security;
create trigger treatment_stages_touch before update on public.treatment_stages for each row execute function private.touch_updated_at();
create trigger audit_treatment_stages after insert or update on public.treatment_stages for each row execute function private.audit_row_change();

-- Coerência: patient_id da etapa = do plano.
create or replace function private.stage_patient_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.patient_id <> (select patient_id from public.treatment_plans where id = new.plan_id) then
    raise exception 'etapa e plano de pacientes diferentes' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger treatment_stages_patient before insert or update on public.treatment_stages
  for each row execute function private.stage_patient_matches();

create policy "treatment_stages: equipe clínica lê" on public.treatment_stages for select to authenticated
  using ((select private.has_permission('clinical.read')));
create policy "treatment_stages: paciente vê de planos liberados" on public.treatment_stages for select to authenticated
  using (exists (select 1 from public.treatment_plans p where p.id = plan_id));
create policy "treatment_stages: equipe clínica cria" on public.treatment_stages for insert to authenticated
  with check ((select private.has_permission('clinical.write')));
create policy "treatment_stages: equipe clínica edita" on public.treatment_stages for update to authenticated
  using ((select private.has_permission('clinical.write'))) with check ((select private.has_permission('clinical.write')));
create policy "treatment_stages: equipe clínica remove" on public.treatment_stages for delete to authenticated
  using ((select private.has_permission('clinical.write')) and status = 'pending');

-- Progresso = etapas concluídas / etapas não puladas. NÃO é garantia de resultado clínico.
create or replace function public.plan_progress(p_plan uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*) filter (where status <> 'skipped'),
    'completed', count(*) filter (where status = 'completed'),
    'percent', case when count(*) filter (where status <> 'skipped') = 0 then 0
                    else round(100.0 * count(*) filter (where status = 'completed')
                               / count(*) filter (where status <> 'skipped')) end)
  from public.treatment_stages where plan_id = p_plan;
$$;
revoke all on function public.plan_progress(uuid) from public, anon;
grant execute on function public.plan_progress(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- clinical_photos (CG Evolution) e documents
-- -----------------------------------------------------------------------------
create table public.clinical_photos (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id),
  treatment_plan_id  uuid references public.treatment_plans (id) on delete set null,
  storage_path       text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'),
  taken_on           date not null,
  view_label         text check (view_label is null or length(view_label) <= 60),
  professional_notes text check (professional_notes is null or length(professional_notes) <= 1000),
  visible_to_patient boolean not null default true,
  uploaded_by        uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint clinical_photos_path_patient check (split_part(storage_path, '/', 1) = patient_id::text)
);
create index clinical_photos_patient_idx on public.clinical_photos (patient_id, taken_on);
alter table public.clinical_photos enable row level security;
create policy "clinical_photos: equipe clínica lê" on public.clinical_photos for select to authenticated
  using ((select private.has_permission('clinical.read')));
create policy "clinical_photos: paciente vê liberadas" on public.clinical_photos for select to authenticated
  using ((select private.patient_side_can_view(patient_id, visible_to_patient)));
create policy "clinical_photos: equipe clínica registra" on public.clinical_photos for insert to authenticated
  with check ((select private.has_permission('clinical.write')));
create policy "clinical_photos: equipe clínica edita" on public.clinical_photos for update to authenticated
  using ((select private.has_permission('clinical.write'))) with check ((select private.has_permission('clinical.write')));
revoke delete on public.clinical_photos from anon, authenticated;
create trigger audit_clinical_photos after insert or update on public.clinical_photos for each row execute function private.audit_row_change();

-- Foto clínica exige consentimento ativo `clinical_photos`.
create or replace function private.require_photo_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.consents
                  where patient_id = new.patient_id and kind = 'clinical_photos' and granted and revoked_at is null) then
    raise exception 'paciente sem consentimento ativo para fotografias clínicas' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger clinical_photos_consent before insert on public.clinical_photos
  for each row execute function private.require_photo_consent();

create type public.document_kind as enum ('consent_form', 'exam', 'report', 'guidance', 'other');

create table public.documents (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id),
  kind               public.document_kind not null,
  title              text not null check (length(title) between 3 and 120),
  storage_path       text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'),
  visible_to_patient boolean not null default false,
  uploaded_by        uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  constraint documents_path_patient check (split_part(storage_path, '/', 1) = patient_id::text)
);
alter table public.documents enable row level security;
create policy "documents: equipe clínica lê" on public.documents for select to authenticated
  using ((select private.has_permission('clinical.read')));
create policy "documents: paciente vê liberados" on public.documents for select to authenticated
  using ((select private.patient_side_can_view(patient_id, visible_to_patient)));
create policy "documents: equipe clínica registra" on public.documents for insert to authenticated
  with check ((select private.has_permission('clinical.write')));
revoke update, delete on public.documents from anon, authenticated;
create trigger audit_documents after insert on public.documents for each row execute function private.audit_row_change();

revoke truncate on public.clinical_records, public.dental_charts, public.tooth_records, public.treatment_plans,
  public.treatment_stages, public.clinical_photos, public.documents from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Storage (somente no Supabase real): buckets privados, acesso espelhando as tabelas.
-- URLs assinadas de curta duração são geradas pelo servidor com a sessão da pessoa.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('clinical-photos', 'clinical-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']),
      ('documents', 'documents', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "clinical-photos: leitura espelha a tabela" on storage.objects for select to authenticated
      using (bucket_id = 'clinical-photos' and exists (
        select 1 from public.clinical_photos cp where cp.storage_path = name))
    $p$;
    execute $p$
      create policy "clinical-photos: equipe clínica envia" on storage.objects for insert to authenticated
      with check (bucket_id = 'clinical-photos' and (select private.has_permission('clinical.write')))
    $p$;
    execute $p$
      create policy "documents: leitura espelha a tabela" on storage.objects for select to authenticated
      using (bucket_id = 'documents' and exists (
        select 1 from public.documents d where d.storage_path = name))
    $p$;
    execute $p$
      create policy "documents: equipe clínica envia" on storage.objects for insert to authenticated
      with check (bucket_id = 'documents' and (select private.has_permission('clinical.write')))
    $p$;
  end if;
end $$;
