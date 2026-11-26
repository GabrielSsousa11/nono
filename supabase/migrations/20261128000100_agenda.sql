-- =============================================================================
-- Migration 0003 — Agenda (Fase 4)
-- services, professional_services, availability, schedule_blocks, appointments,
-- appointment_status_history, waiting_list, notifications.
--
-- Garantias no banco:
--   * EXCLUDE (gist) impede dois atendimentos ativos sobrepostos para o mesmo
--     profissional e para o mesmo paciente — inclusive sob concorrência.
--   * Agendamento só por RPC, que valida disponibilidade, bloqueios e antecedência.
--   * Toda mudança de status gera histórico.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Novas permissões
insert into public.permissions (key, description) values
  ('agenda.read',      'Ver a agenda'),
  ('agenda.write',     'Agendar, confirmar, remarcar e cancelar consultas'),
  ('services.manage',  'Cadastrar serviços, disponibilidade e bloqueios de agenda'),
  ('waitlist.manage',  'Gerenciar a lista de espera');

insert into public.role_permissions (role, permission) values
  ('admin', 'agenda.read'), ('admin', 'agenda.write'), ('admin', 'services.manage'), ('admin', 'waitlist.manage'),
  ('dentist', 'agenda.read'), ('dentist', 'agenda.write'), ('dentist', 'waitlist.manage'),
  ('receptionist', 'agenda.read'), ('receptionist', 'agenda.write'), ('receptionist', 'waitlist.manage'),
  ('finance', 'agenda.read');

-- Configurações padrão da agenda (editáveis no CG Studio → Configurações)
insert into public.clinic_settings (key, value, description) values
  ('agenda.timezone',           '"America/Sao_Paulo"', 'Fuso horário da clínica'),
  ('agenda.slot_step_minutes',  '15',   'Intervalo entre horários oferecidos'),
  ('agenda.min_notice_hours',   '2',    'Antecedência mínima para o paciente agendar pelo portal'),
  ('agenda.cancel_notice_hours','24',   'Antecedência mínima para cancelar/remarcar pelo portal sem contatar a clínica'),
  ('agenda.max_days_ahead',     '90',   'Até quantos dias à frente o portal mostra horários'),
  ('waitlist.auto_offer',       'true', 'Oferecer automaticamente vagas canceladas à lista de espera'),
  ('waitlist.offer_hours',      '12',   'Validade de uma oferta de vaga (horas)'),
  ('waitlist.max_offers',       '3',    'Quantas pessoas da lista recebem a oferta de uma mesma vaga')
on conflict (key) do nothing;

create or replace function private.setting(p_key text, p_default jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.clinic_settings where key = p_key), p_default);
$$;
revoke all on function private.setting(text, jsonb) from public;
grant execute on function private.setting(text, jsonb) to authenticated;

create or replace function private.clinic_tz()
returns text
language sql
stable
set search_path = ''
as $$
  select private.setting('agenda.timezone', '"America/Sao_Paulo"') #>> '{}';
$$;
revoke all on function private.clinic_tz() from public;
grant execute on function private.clinic_tz() to authenticated;

-- -----------------------------------------------------------------------------
-- services
-- -----------------------------------------------------------------------------
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(name) between 3 and 80),
  description      text check (description is null or length(description) <= 600),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  buffer_minutes   integer not null default 0 check (buffer_minutes between 0 and 120),
  price_cents      integer check (price_cents is null or price_cents >= 0),
  self_booking     boolean not null default false,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint services_name_unique unique (name)
);
comment on column public.services.self_booking is 'Se o paciente pode agendar este serviço sozinho pelo portal.';
alter table public.services enable row level security;
create trigger services_touch before update on public.services for each row execute function private.touch_updated_at();
create trigger audit_services after insert or update on public.services for each row execute function private.audit_row_change();

create policy "services: autenticados leem ativos" on public.services for select to authenticated using (active);
create policy "services: equipe lê todos" on public.services for select to authenticated
  using ((select private.has_permission('agenda.read')));
create policy "services: gestão insere" on public.services for insert to authenticated
  with check ((select private.has_permission('services.manage')));
create policy "services: gestão edita" on public.services for update to authenticated
  using ((select private.has_permission('services.manage'))) with check ((select private.has_permission('services.manage')));

create table public.professional_services (
  professional_id uuid not null references public.professionals (id) on delete cascade,
  service_id      uuid not null references public.services (id) on delete cascade,
  primary key (professional_id, service_id)
);
alter table public.professional_services enable row level security;
create policy "professional_services: autenticados leem" on public.professional_services for select to authenticated using (true);
create policy "professional_services: gestão" on public.professional_services for all to authenticated
  using ((select private.has_permission('services.manage'))) with check ((select private.has_permission('services.manage')));

-- Pacientes precisam ver nome do profissional (consultas e agendamento).
create policy "professionals: autenticados veem ativos" on public.professionals for select to authenticated using (active);

-- -----------------------------------------------------------------------------
-- availability (horário semanal recorrente, hora local da clínica)
-- -----------------------------------------------------------------------------
create table public.availability (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  weekday         smallint not null check (weekday between 0 and 6),
  starts          time not null,
  ends            time not null,
  valid_from      date,
  valid_until     date,
  created_at      timestamptz not null default now(),
  constraint availability_range check (ends > starts),
  constraint availability_validity check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
create index availability_prof_idx on public.availability (professional_id, weekday);
alter table public.availability enable row level security;
create policy "availability: equipe lê" on public.availability for select to authenticated
  using ((select private.has_permission('agenda.read')));
create policy "availability: gestão" on public.availability for all to authenticated
  using ((select private.has_permission('services.manage'))) with check ((select private.has_permission('services.manage')));

-- -----------------------------------------------------------------------------
-- schedule_blocks (feriados, ausências, bloqueios). professional_id nulo = clínica toda.
-- -----------------------------------------------------------------------------
create type public.block_kind as enum ('holiday', 'absence', 'block');

create table public.schedule_blocks (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid references public.professionals (id) on delete cascade,
  kind            public.block_kind not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  reason          text check (reason is null or length(reason) <= 200),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint schedule_blocks_range check (ends_at > starts_at)
);
create index schedule_blocks_range_idx on public.schedule_blocks using gist (tstzrange(starts_at, ends_at, '[)'));
alter table public.schedule_blocks enable row level security;
create policy "schedule_blocks: equipe lê" on public.schedule_blocks for select to authenticated
  using ((select private.has_permission('agenda.read')));
create policy "schedule_blocks: agenda edita" on public.schedule_blocks for all to authenticated
  using ((select private.has_permission('agenda.write'))) with check ((select private.has_permission('agenda.write')));

-- -----------------------------------------------------------------------------
-- appointments
-- -----------------------------------------------------------------------------
create type public.appointment_status as enum ('scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('studio', 'portal', 'booking_request', 'waitlist');

create table public.appointments (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id),
  professional_id    uuid not null references public.professionals (id),
  service_id         uuid not null references public.services (id),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  status             public.appointment_status not null default 'scheduled',
  source             public.appointment_source not null,
  booking_request_id uuid references public.booking_requests (id) on delete set null,
  notes_admin        text check (notes_admin is null or length(notes_admin) <= 1000),
  cancel_reason      text check (cancel_reason is null or length(cancel_reason) <= 300),
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint appointments_range check (ends_at > starts_at),
  constraint appointments_no_professional_overlap exclude using gist (
    professional_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled', 'no_show')),
  constraint appointments_no_patient_overlap exclude using gist (
    patient_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'))
);
create index appointments_patient_idx on public.appointments (patient_id, starts_at desc);
create index appointments_day_idx on public.appointments (starts_at);
alter table public.appointments enable row level security;
create trigger appointments_touch before update on public.appointments for each row execute function private.touch_updated_at();
create trigger audit_appointments after insert or update on public.appointments for each row execute function private.audit_row_change();

create policy "appointments: equipe lê" on public.appointments for select to authenticated
  using ((select private.has_permission('agenda.read')));
create policy "appointments: paciente vê as suas" on public.appointments for select to authenticated
  using ((select private.is_patient_self(patient_id)));
create policy "appointments: responsável vê as dos dependentes" on public.appointments for select to authenticated
  using ((select private.is_guardian_of(patient_id)));
create policy "appointments: equipe edita observações" on public.appointments for update to authenticated
  using ((select private.has_permission('agenda.write'))) with check ((select private.has_permission('agenda.write')));
revoke insert, update, delete on public.appointments from anon, authenticated;
grant update (notes_admin) on public.appointments to authenticated;

create table public.appointment_status_history (
  id             bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  from_status    public.appointment_status,
  to_status      public.appointment_status not null,
  starts_at      timestamptz not null,
  changed_by     uuid references public.profiles (id) on delete set null,
  changed_at     timestamptz not null default now(),
  reason         text
);
create index appointment_status_history_appt_idx on public.appointment_status_history (appointment_id, changed_at);
alter table public.appointment_status_history enable row level security;
create policy "history: segue a consulta" on public.appointment_status_history for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id));
revoke insert, update, delete on public.appointment_status_history from anon, authenticated;

create or replace function private.track_appointment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.starts_at is distinct from old.starts_at then
    insert into public.appointment_status_history (appointment_id, from_status, to_status, starts_at, changed_by, reason)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, new.starts_at, (select auth.uid()),
            nullif(current_setting('cg.status_reason', true), ''));
  end if;
  return new;
end;
$$;
revoke all on function private.track_appointment_status() from public;
create trigger appointments_status_history after insert or update on public.appointments
  for each row execute function private.track_appointment_status();

-- -----------------------------------------------------------------------------
-- notifications (internas, exibidas no portal/Studio; Web Push é um canal extra)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind ~ '^[a-z_]+\.[a-z_]+$'),
  title        text not null check (length(title) between 3 and 120),
  -- Corpo SEM dados clínicos: notificações podem aparecer na tela bloqueada.
  body         text check (body is null or length(body) <= 400),
  link         text check (link is null or link ~ '^/[a-z0-9/_?=&.-]*$'),
  dedupe_key   text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  constraint notifications_dedupe unique (recipient_id, dedupe_key)
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications: a própria pessoa lê" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "notifications: marcar como lida" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function private.notify(
  p_recipient uuid, p_kind text, p_title text, p_body text, p_link text, p_dedupe text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (recipient_id, kind, title, body, link, dedupe_key)
  select p_recipient, p_kind, p_title, p_body, p_link, p_dedupe
  where p_recipient is not null
  on conflict (recipient_id, dedupe_key) do nothing;
$$;
revoke all on function private.notify(uuid, text, text, text, text, text) from public;

-- Destinatários do portal de um paciente: o próprio e responsáveis ativos.
create or replace function private.patient_recipients(p_patient uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile_id from public.patients where id = p_patient and profile_id is not null
  union
  select guardian_profile_id from public.patient_guardians
   where patient_id = p_patient and guardian_profile_id is not null and revoked_at is null
     and (valid_until is null or valid_until >= current_date);
$$;
revoke all on function private.patient_recipients(uuid) from public;

-- -----------------------------------------------------------------------------
-- waiting_list
-- -----------------------------------------------------------------------------
create type public.waitlist_status as enum ('waiting', 'offered', 'booked', 'expired', 'removed');

create table public.waiting_list (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  service_id       uuid not null references public.services (id),
  professional_id  uuid references public.professionals (id) on delete set null,
  preferred_period public.day_period not null default 'any',
  earliest_date    date not null default current_date,
  latest_date      date,
  priority         smallint not null default 0 check (priority between 0 and 10),
  status           public.waitlist_status not null default 'waiting',
  offer_starts_at  timestamptz,
  offer_professional_id uuid references public.professionals (id) on delete set null,
  offer_expires_at timestamptz,
  notes            text check (notes is null or length(notes) <= 300),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint waiting_list_dates check (latest_date is null or latest_date >= earliest_date),
  constraint waiting_list_offer check (status <> 'offered' or (offer_starts_at is not null and offer_expires_at is not null))
);
create unique index waiting_list_one_active on public.waiting_list (patient_id, service_id) where status in ('waiting', 'offered');
alter table public.waiting_list enable row level security;
create trigger audit_waiting_list after insert or update on public.waiting_list for each row execute function private.audit_row_change();
create policy "waiting_list: equipe" on public.waiting_list for select to authenticated
  using ((select private.has_permission('waitlist.manage')));
create policy "waiting_list: paciente vê as suas" on public.waiting_list for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
revoke insert, update, delete on public.waiting_list from anon, authenticated;

-- =============================================================================
-- Disponibilidade
-- =============================================================================

-- Horários livres de um profissional para um serviço num dia (hora local da clínica).
-- Retorna apenas horários — nenhum dado de outros pacientes.
create or replace function public.available_slots(p_professional uuid, p_service uuid, p_day date)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz       text := private.clinic_tz();
  v_step     integer := (private.setting('agenda.slot_step_minutes', '15'))::int;
  v_duration integer;
  v_buffer   integer;
begin
  if (select auth.uid()) is null then
    raise exception 'autenticação necessária' using errcode = '42501';
  end if;
  select s.duration_minutes, s.buffer_minutes into v_duration, v_buffer
    from public.services s
    join public.professional_services ps on ps.service_id = s.id and ps.professional_id = p_professional
    join public.professionals pr on pr.id = p_professional and pr.active
   where s.id = p_service and s.active;
  if v_duration is null then
    return;
  end if;

  return query
  with windows as (
    select ((p_day + a.starts) at time zone v_tz) as w_start,
           ((p_day + a.ends) at time zone v_tz) as w_end
      from public.availability a
     where a.professional_id = p_professional
       and a.weekday = extract(dow from p_day)::int
       and (a.valid_from is null or a.valid_from <= p_day)
       and (a.valid_until is null or a.valid_until >= p_day)
  ),
  candidates as (
    select gs as c_start, gs + make_interval(mins => v_duration) as c_end
      from windows w,
           generate_series(w.w_start, w.w_end - make_interval(mins => v_duration), make_interval(mins => v_step)) gs
  )
  select c.c_start, c.c_end
    from candidates c
   where c.c_start > now()
     and not exists (
       select 1 from public.schedule_blocks b
        where (b.professional_id is null or b.professional_id = p_professional)
          and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(c.c_start, c.c_end, '[)'))
     and not exists (
       select 1 from public.appointments ap
        where ap.professional_id = p_professional
          and ap.status not in ('cancelled', 'no_show')
          and tstzrange(ap.starts_at, ap.ends_at + make_interval(mins => v_buffer), '[)')
              && tstzrange(c.c_start, c.c_end + make_interval(mins => v_buffer), '[)'))
   order by c.c_start;
end;
$$;

-- Pode a pessoa atual agendar/gerenciar consultas deste paciente pelo portal?
create or replace function private.can_self_schedule(p_patient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_patient_self(p_patient) or exists (
    select 1 from public.patient_guardians g
     where g.patient_id = p_patient and g.guardian_profile_id = (select auth.uid())
       and g.revoked_at is null and g.can_schedule
       and (g.valid_until is null or g.valid_until >= current_date));
$$;
revoke all on function private.can_self_schedule(uuid) from public;

-- =============================================================================
-- RPCs da agenda
-- =============================================================================

create or replace function public.book_appointment(
  p_patient uuid, p_professional uuid, p_service uuid, p_starts_at timestamptz,
  p_source public.appointment_source default 'studio', p_booking_request uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff    boolean := private.has_permission('agenda.write');
  v_duration integer;
  v_self     boolean;
  v_id       uuid;
begin
  if not v_staff then
    if not private.can_self_schedule(p_patient) then
      raise exception 'permissão negada' using errcode = '42501';
    end if;
    select s.self_booking into v_self from public.services s where s.id = p_service;
    if not coalesce(v_self, false) then
      raise exception 'este serviço é agendado pela clínica' using errcode = '22023';
    end if;
    if p_starts_at < now() + make_interval(hours => (private.setting('agenda.min_notice_hours', '2'))::int) then
      raise exception 'antecedência mínima não respeitada' using errcode = '22023';
    end if;
    if p_starts_at > now() + make_interval(days => (private.setting('agenda.max_days_ahead', '90'))::int) then
      raise exception 'data além do período disponível' using errcode = '22023';
    end if;
    -- Paciente só agenda horários oferecidos pela disponibilidade.
    if not exists (
      select 1 from public.available_slots(p_professional, p_service, (p_starts_at at time zone private.clinic_tz())::date) s
       where s.starts_at = p_starts_at) then
      raise exception 'horário indisponível' using errcode = '23P01';
    end if;
    p_source := case when p_source = 'waitlist' then 'waitlist' else 'portal' end;
  end if;

  select duration_minutes into v_duration from public.services where id = p_service and active;
  if v_duration is null then
    raise exception 'serviço inválido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.patients where id = p_patient and archived_at is null) then
    raise exception 'paciente não encontrado' using errcode = 'P0002';
  end if;

  insert into public.appointments (patient_id, professional_id, service_id, starts_at, ends_at, source, booking_request_id, created_by)
  values (p_patient, p_professional, p_service, p_starts_at, p_starts_at + make_interval(mins => v_duration),
          p_source, p_booking_request, (select auth.uid()))
  returning id into v_id;

  if p_booking_request is not null and v_staff then
    update public.booking_requests set status = 'scheduled', handled_at = now(), handled_by = (select auth.uid())
     where id = p_booking_request;
  end if;

  perform private.notify(r, 'appointment.created', 'Consulta agendada',
          'Veja data e horário no portal.', '/portal', 'appt-created-' || v_id)
     from private.patient_recipients(p_patient) r;
  return v_id;
exception
  when exclusion_violation then
    raise exception 'horário indisponível' using errcode = '23P01';
end;
$$;

-- Transições permitidas por quem age.
create or replace function private.allowed_transition(
  p_from public.appointment_status, p_to public.appointment_status, p_staff boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_staff then (p_from, p_to) in (
      ('scheduled', 'confirmed'), ('scheduled', 'cancelled'), ('scheduled', 'checked_in'), ('scheduled', 'no_show'),
      ('confirmed', 'cancelled'), ('confirmed', 'checked_in'), ('confirmed', 'no_show'),
      ('checked_in', 'completed'), ('checked_in', 'cancelled'),
      ('no_show', 'scheduled'), ('cancelled', 'scheduled'))
    else (p_from, p_to) in (('scheduled', 'confirmed'), ('scheduled', 'cancelled'), ('confirmed', 'cancelled'))
  end;
$$;

create or replace function public.set_appointment_status(
  p_appointment uuid, p_status public.appointment_status, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt  public.appointments;
  v_staff boolean := private.has_permission('agenda.write');
begin
  select * into v_appt from public.appointments where id = p_appointment for update;
  if not found then
    raise exception 'consulta não encontrada' using errcode = 'P0002';
  end if;
  if not v_staff and not private.can_self_schedule(v_appt.patient_id) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if not private.allowed_transition(v_appt.status, p_status, v_staff) then
    raise exception 'mudança de situação não permitida' using errcode = '22023';
  end if;
  if not v_staff and p_status = 'cancelled'
     and v_appt.starts_at < now() + make_interval(hours => (private.setting('agenda.cancel_notice_hours', '24'))::int) then
    raise exception 'cancelamento em cima da hora deve ser feito com a clínica' using errcode = '22023';
  end if;
  if p_status = 'cancelled' and (p_reason is null or length(btrim(p_reason)) < 3) then
    raise exception 'informe o motivo do cancelamento' using errcode = '22023';
  end if;

  perform set_config('cg.status_reason', coalesce(left(btrim(p_reason), 300), ''), true);
  update public.appointments
     set status = p_status,
         cancel_reason = case when p_status = 'cancelled' then left(btrim(p_reason), 300) else cancel_reason end
   where id = p_appointment;

  if p_status = 'cancelled' and v_appt.starts_at > now()
     and (private.setting('waitlist.auto_offer', 'true'))::boolean then
    perform private.offer_slot(v_appt.professional_id, v_appt.service_id, v_appt.starts_at);
  end if;
exception
  when exclusion_violation then
    raise exception 'horário indisponível' using errcode = '23P01';
end;
$$;

create or replace function public.reschedule_appointment(p_appointment uuid, p_new_start timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt  public.appointments;
  v_staff boolean := private.has_permission('agenda.write');
  v_duration integer;
begin
  select * into v_appt from public.appointments where id = p_appointment for update;
  if not found then
    raise exception 'consulta não encontrada' using errcode = 'P0002';
  end if;
  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'só consultas futuras ativas podem ser remarcadas' using errcode = '22023';
  end if;
  if not v_staff then
    if not private.can_self_schedule(v_appt.patient_id) then
      raise exception 'permissão negada' using errcode = '42501';
    end if;
    if v_appt.starts_at < now() + make_interval(hours => (private.setting('agenda.cancel_notice_hours', '24'))::int) then
      raise exception 'remarcação em cima da hora deve ser feita com a clínica' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.available_slots(v_appt.professional_id, v_appt.service_id,
                                           (p_new_start at time zone private.clinic_tz())::date) s
       where s.starts_at = p_new_start) then
      raise exception 'horário indisponível' using errcode = '23P01';
    end if;
  end if;
  select duration_minutes into v_duration from public.services where id = v_appt.service_id;
  perform set_config('cg.status_reason', 'remarcação', true);
  update public.appointments
     set starts_at = p_new_start, ends_at = p_new_start + make_interval(mins => v_duration), status = 'scheduled'
   where id = p_appointment;
  if v_appt.starts_at > now() and (private.setting('waitlist.auto_offer', 'true'))::boolean then
    perform private.offer_slot(v_appt.professional_id, v_appt.service_id, v_appt.starts_at);
  end if;
exception
  when exclusion_violation then
    raise exception 'horário indisponível' using errcode = '23P01';
end;
$$;

-- =============================================================================
-- Lista de espera
-- =============================================================================

-- Oferece uma vaga liberada às primeiras pessoas compatíveis (regras configuráveis).
create or replace function private.offer_slot(p_professional uuid, p_service uuid, p_starts_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz     text := private.clinic_tz();
  v_local  timestamp := p_starts_at at time zone v_tz;
  v_period public.day_period := case
    when extract(hour from v_local) < 12 then 'morning'
    when extract(hour from v_local) < 18 then 'afternoon'
    else 'evening' end;
  v_hours  integer := (private.setting('waitlist.offer_hours', '12'))::int;
  v_max    integer := (private.setting('waitlist.max_offers', '3'))::int;
  v_row    record;
  v_count  integer := 0;
begin
  for v_row in
    select w.id, w.patient_id from public.waiting_list w
     where w.status = 'waiting'
       and w.service_id = p_service
       and (w.professional_id is null or w.professional_id = p_professional)
       and (w.preferred_period = 'any' or w.preferred_period = v_period)
       and w.earliest_date <= v_local::date
       and (w.latest_date is null or w.latest_date >= v_local::date)
     order by w.priority desc, w.created_at
     limit v_max
     for update skip locked
  loop
    update public.waiting_list
       set status = 'offered', offer_starts_at = p_starts_at, offer_professional_id = p_professional,
           offer_expires_at = least(p_starts_at, now() + make_interval(hours => v_hours))
     where id = v_row.id;
    perform private.notify(r, 'waitlist.offer', 'Uma vaga abriu para você',
            'Confirme no portal antes que a oferta expire.', '/portal/agenda', 'wl-offer-' || v_row.id || '-' || extract(epoch from p_starts_at)::bigint)
       from private.patient_recipients(v_row.patient_id) r;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.offer_slot(uuid, uuid, timestamptz) from public;

create or replace function public.join_waiting_list(
  p_patient uuid, p_service uuid, p_professional uuid default null,
  p_period public.day_period default 'any', p_earliest date default current_date, p_latest date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (private.has_permission('waitlist.manage') or private.can_self_schedule(p_patient)) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  insert into public.waiting_list (patient_id, service_id, professional_id, preferred_period, earliest_date, latest_date, notes, created_by)
  values (p_patient, p_service, p_professional, p_period, coalesce(p_earliest, current_date), p_latest, nullif(btrim(p_notes), ''), (select auth.uid()))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'já existe um pedido ativo na lista de espera para este serviço' using errcode = '23505';
end;
$$;

create or replace function public.leave_waiting_list(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient uuid;
begin
  select patient_id into v_patient from public.waiting_list where id = p_entry;
  if v_patient is null or not (private.has_permission('waitlist.manage') or private.can_self_schedule(v_patient)) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  update public.waiting_list set status = 'removed', offer_starts_at = null, offer_expires_at = null
   where id = p_entry and status in ('waiting', 'offered');
end;
$$;

-- Aceite de oferta: agenda se a vaga ainda estiver livre (primeiro a aceitar leva).
create or replace function public.accept_waitlist_offer(p_entry uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_w  public.waiting_list;
  v_id uuid;
  v_duration integer;
begin
  select * into v_w from public.waiting_list where id = p_entry for update;
  if not found or not (private.can_self_schedule(v_w.patient_id) or private.has_permission('waitlist.manage')) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if v_w.status <> 'offered' or v_w.offer_expires_at < now() then
    raise exception 'oferta expirada ou indisponível' using errcode = '22023';
  end if;
  select duration_minutes into v_duration from public.services where id = v_w.service_id;
  begin
    insert into public.appointments (patient_id, professional_id, service_id, starts_at, ends_at, source, created_by)
    values (v_w.patient_id, v_w.offer_professional_id, v_w.service_id, v_w.offer_starts_at,
            v_w.offer_starts_at + make_interval(mins => v_duration), 'waitlist', (select auth.uid()))
    returning id into v_id;
  exception when exclusion_violation then
    update public.waiting_list set status = 'waiting', offer_starts_at = null, offer_expires_at = null, offer_professional_id = null
     where id = p_entry;
    raise exception 'a vaga já foi preenchida' using errcode = '23P01';
  end;
  update public.waiting_list set status = 'booked' where id = p_entry;
  -- Outras ofertas da mesma vaga voltam a aguardar.
  update public.waiting_list set status = 'waiting', offer_starts_at = null, offer_expires_at = null, offer_professional_id = null
   where status = 'offered' and offer_starts_at = v_w.offer_starts_at and offer_professional_id = v_w.offer_professional_id and id <> p_entry;
  return v_id;
end;
$$;

-- Expira ofertas vencidas (pg_cron, a cada 15 min).
create or replace function private.expire_waitlist_offers()
returns integer
language sql
security definer
set search_path = ''
as $$
  with e as (
    update public.waiting_list set status = 'waiting', offer_starts_at = null, offer_expires_at = null, offer_professional_id = null
     where status = 'offered' and offer_expires_at < now()
    returning 1)
  select count(*)::int from e;
$$;
revoke all on function private.expire_waitlist_offers() from public;

do $$
declare f text;
begin
  foreach f in array array[
    'public.available_slots(uuid, uuid, date)',
    'public.book_appointment(uuid, uuid, uuid, timestamptz, public.appointment_source, uuid)',
    'public.set_appointment_status(uuid, public.appointment_status, text)',
    'public.reschedule_appointment(uuid, timestamptz)',
    'public.join_waiting_list(uuid, uuid, uuid, public.day_period, date, date, text)',
    'public.leave_waiting_list(uuid)',
    'public.accept_waitlist_offer(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke truncate on public.services, public.professional_services, public.availability, public.schedule_blocks,
  public.appointments, public.appointment_status_history, public.notifications, public.waiting_list from anon, authenticated;
