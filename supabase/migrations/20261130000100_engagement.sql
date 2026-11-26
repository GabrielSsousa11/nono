-- =============================================================================
-- Migration 0005 — Engajamento e cuidado (Fases 6, 8 e 9)
-- CG Daily: habit_goals, brushing_logs, achievements, patient_achievements,
--           education_missions, patient_missions
-- CG Care: care_protocols, care_reminders, patient_messages (canal com a clínica)
-- CG Passport: checkin_tokens
--
-- Saúde em primeiro lugar: registros acima da meta diária NÃO contam pontos
-- (não incentivar escovação excessiva) e não há rankings entre pacientes.
-- =============================================================================

insert into public.permissions (key, description) values
  ('care.manage',     'Definir metas de hábitos, protocolos e lembretes de cuidado'),
  ('messages.manage', 'Responder mensagens de pacientes'),
  ('checkin.perform', 'Registrar chegada de pacientes por QR Code');
insert into public.role_permissions (role, permission) values
  ('admin', 'care.manage'), ('admin', 'messages.manage'), ('admin', 'checkin.perform'),
  ('dentist', 'care.manage'), ('dentist', 'messages.manage'), ('dentist', 'checkin.perform'),
  ('receptionist', 'messages.manage'), ('receptionist', 'checkin.perform');

-- -----------------------------------------------------------------------------
-- CG Daily
-- -----------------------------------------------------------------------------
create table public.habit_goals (
  patient_id       uuid primary key references public.patients (id) on delete cascade,
  brushing_per_day smallint not null default 2 check (brushing_per_day between 1 and 3),
  flossing_per_day smallint not null default 1 check (flossing_per_day between 0 and 2),
  brushing_seconds smallint not null default 120 check (brushing_seconds between 60 and 240),
  note             text check (note is null or length(note) <= 300),
  set_by           uuid references public.profiles (id) on delete set null,
  updated_at       timestamptz not null default now()
);
alter table public.habit_goals enable row level security;
create policy "habit_goals: paciente e responsável leem" on public.habit_goals for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
create policy "habit_goals: equipe de cuidado lê" on public.habit_goals for select to authenticated
  using ((select private.has_permission('care.manage')));
create policy "habit_goals: equipe de cuidado define" on public.habit_goals for all to authenticated
  using ((select private.has_permission('care.manage'))) with check ((select private.has_permission('care.manage')));

create type public.habit_kind as enum ('brushing', 'flossing');

create table public.brushing_logs (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  kind             public.habit_kind not null,
  logged_at        timestamptz not null default now(),
  local_date       date not null,
  guided_seconds   smallint check (guided_seconds is null or guided_seconds between 10 and 600),
  created_by       uuid references public.profiles (id) on delete set null
);
create index brushing_logs_patient_idx on public.brushing_logs (patient_id, local_date desc);
alter table public.brushing_logs enable row level security;
create policy "brushing_logs: paciente e responsável leem" on public.brushing_logs for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
create policy "brushing_logs: equipe de cuidado lê" on public.brushing_logs for select to authenticated
  using ((select private.has_permission('care.manage')));
revoke insert, update, delete on public.brushing_logs from anon, authenticated;

create table public.achievements (
  key         text primary key check (key ~ '^[a-z0-9_]+$'),
  title       text not null,
  description text not null,
  position    smallint not null
);
insert into public.achievements (key, title, description, position) values
  ('first_log',     'Primeiro registro',      'Registrou o primeiro cuidado no CG Daily.', 1),
  ('goal_day',      'Dia completo',           'Cumpriu a meta de escovação e fio dental em um dia.', 2),
  ('streak_7',      'Uma semana de cuidado',  'Sete dias seguidos cumprindo a meta.', 3),
  ('streak_30',     'Um mês de constância',   'Trinta dias seguidos cumprindo a meta.', 4),
  ('guided_10',     'Escovação guiada',       'Dez escovações com o cronômetro guiado.', 5),
  ('floss_week',    'Fio dental em dia',      'Usou fio dental em sete dias de uma mesma semana.', 6),
  ('missions_all',  'Bem informado',          'Concluiu todas as missões educativas.', 7);
alter table public.achievements enable row level security;
create policy "achievements: autenticados leem" on public.achievements for select to authenticated using (true);

create table public.patient_achievements (
  patient_id      uuid not null references public.patients (id) on delete cascade,
  achievement_key text not null references public.achievements (key),
  earned_at       timestamptz not null default now(),
  primary key (patient_id, achievement_key)
);
alter table public.patient_achievements enable row level security;
create policy "patient_achievements: paciente e responsável leem" on public.patient_achievements for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
create policy "patient_achievements: equipe de cuidado lê" on public.patient_achievements for select to authenticated
  using ((select private.has_permission('care.manage')));
revoke insert, update, delete on public.patient_achievements from anon, authenticated;

create table public.education_missions (
  key      text primary key check (key ~ '^[a-z0-9_]+$'),
  title    text not null,
  body     text not null,
  position smallint not null,
  active   boolean not null default true
);
-- Conteúdo educativo geral. Revisão da dentista responsável antes da publicação (ver docs/CONTENT_VERIFICATION.md).
insert into public.education_missions (key, title, body, position) values
  ('tecnica_escovacao', 'Escovação sem pressa',
   'Escove todas as faces dos dentes — de fora, de dentro e de mastigação — com movimentos suaves. Força demais desgasta o esmalte e machuca a gengiva; o que limpa é o tempo e a técnica.', 1),
  ('fio_dental', 'Por que usar fio dental',
   'A escova não alcança bem o espaço entre os dentes. O fio dental remove a placa dali e ajuda a prevenir cáries entre os dentes e inflamação da gengiva.', 2),
  ('troca_escova', 'Hora de trocar a escova',
   'Cerdas abertas limpam menos. Troque a escova quando as cerdas estiverem gastas ou conforme a orientação da sua dentista.', 3),
  ('alimentacao', 'Açúcar e frequência',
   'Mais do que a quantidade, a frequência com que consumimos açúcar ao longo do dia influencia o risco de cárie. Prefira concentrar doces nas refeições.', 4),
  ('mais_nao_e_melhor', 'Mais não é melhor',
   'Escovar além do recomendado não deixa os dentes mais limpos e pode causar desgaste e retração da gengiva. Siga a meta combinada com a sua dentista.', 5);
alter table public.education_missions enable row level security;
create policy "education_missions: autenticados leem" on public.education_missions for select to authenticated using (active);

create table public.patient_missions (
  patient_id   uuid not null references public.patients (id) on delete cascade,
  mission_key  text not null references public.education_missions (key),
  completed_at timestamptz not null default now(),
  primary key (patient_id, mission_key)
);
alter table public.patient_missions enable row level security;
create policy "patient_missions: paciente e responsável leem" on public.patient_missions for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
revoke insert, update, delete on public.patient_missions from anon, authenticated;

-- Dias em que a meta foi cumprida (contagem limitada à meta: excesso não soma).
create or replace function private.goal_days(p_patient uuid)
returns table (day date, met boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with g as (
    select coalesce(h.brushing_per_day, 2) as b, coalesce(h.flossing_per_day, 1) as f
      from (select 1) x left join public.habit_goals h on h.patient_id = p_patient
  ),
  d as (
    select local_date,
           count(*) filter (where kind = 'brushing') as b,
           count(*) filter (where kind = 'flossing') as f
      from public.brushing_logs where patient_id = p_patient group by local_date
  )
  select d.local_date, (d.b >= g.b and d.f >= g.f) from d, g;
$$;
revoke all on function private.goal_days(uuid) from public;

create or replace function private.streaks(p_patient uuid, p_today date)
returns table (current_streak integer, best_streak integer, total_met integer)
language sql
stable
security definer
set search_path = ''
as $$
  with met as (select day from private.goal_days(p_patient) where met),
  grp as (select day, day - (row_number() over (order by day))::int as g from met),
  runs as (select min(day) as s, max(day) as e, count(*)::int as n from grp group by g)
  select
    coalesce((select n from runs where e >= p_today - 1 order by e desc limit 1), 0),
    coalesce((select max(n) from runs), 0),
    (select count(*)::int from met);
$$;
revoke all on function private.streaks(uuid, date) from public;

create or replace function private.grant_achievement(p_patient uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.patient_achievements (patient_id, achievement_key) values (p_patient, p_key) on conflict do nothing;
  if found then
    perform private.notify(r, 'daily.achievement', 'Nova conquista no CG Daily',
            (select title from public.achievements where key = p_key), '/portal/daily', 'ach-' || p_patient || '-' || p_key)
       from private.patient_recipients(p_patient) r;
  end if;
end;
$$;
revoke all on function private.grant_achievement(uuid, text) from public;

-- Registra escovação/fio dental (paciente ou responsável).
create or replace function public.log_habit(p_patient uuid, p_kind public.habit_kind, p_guided_seconds integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today  date := (now() at time zone private.clinic_tz())::date;
  v_count  integer;
  v_limit  integer;
  v_s      record;
begin
  if not (private.is_patient_self(p_patient) or private.is_guardian_of(p_patient)) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  select count(*) into v_count from public.brushing_logs
   where patient_id = p_patient and local_date = v_today and kind = p_kind;
  -- Limite de segurança: no máximo meta + 1 registros por dia; nada além disso é aceito.
  select case when p_kind = 'brushing' then coalesce(h.brushing_per_day, 2) else greatest(coalesce(h.flossing_per_day, 1), 1) end + 1
    into v_limit from (select 1) x left join public.habit_goals h on h.patient_id = p_patient;
  if v_count >= v_limit then
    raise exception 'meta do dia já cumprida — mais vezes não traz benefício extra' using errcode = '22023';
  end if;
  if p_kind = 'brushing' and exists (
       select 1 from public.brushing_logs where patient_id = p_patient and kind = 'brushing'
          and logged_at > now() - interval '2 hours') then
    raise exception 'registros de escovação precisam de intervalo de pelo menos 2 horas' using errcode = '22023';
  end if;

  insert into public.brushing_logs (patient_id, kind, local_date, guided_seconds, created_by)
  values (p_patient, p_kind, v_today, p_guided_seconds, (select auth.uid()));

  perform private.grant_achievement(p_patient, 'first_log');
  if exists (select 1 from private.goal_days(p_patient) where day = v_today and met) then
    perform private.grant_achievement(p_patient, 'goal_day');
  end if;
  select * into v_s from private.streaks(p_patient, v_today);
  if v_s.current_streak >= 7 then perform private.grant_achievement(p_patient, 'streak_7'); end if;
  if v_s.current_streak >= 30 then perform private.grant_achievement(p_patient, 'streak_30'); end if;
  if (select count(*) from public.brushing_logs where patient_id = p_patient and guided_seconds >= 60) >= 10 then
    perform private.grant_achievement(p_patient, 'guided_10');
  end if;
  if (select count(distinct local_date) from public.brushing_logs
       where patient_id = p_patient and kind = 'flossing' and local_date > v_today - 7) >= 7 then
    perform private.grant_achievement(p_patient, 'floss_week');
  end if;
  return public.daily_summary(p_patient);
end;
$$;

create or replace function public.complete_mission(p_patient uuid, p_mission text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (private.is_patient_self(p_patient) or private.is_guardian_of(p_patient)) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  insert into public.patient_missions (patient_id, mission_key)
  select p_patient, key from public.education_missions where key = p_mission and active
  on conflict do nothing;
  if not exists (select 1 from public.education_missions m where m.active and not exists (
       select 1 from public.patient_missions pm where pm.patient_id = p_patient and pm.mission_key = m.key)) then
    perform private.grant_achievement(p_patient, 'missions_all');
  end if;
end;
$$;

-- Resumo do CG Daily. O "índice de adesão" é NÃO DIAGNÓSTICO: mede registros, não saúde bucal.
create or replace function public.daily_summary(p_patient uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone private.clinic_tz())::date;
  v_s     record;
  v_first date;
  v_window integer;
  v_met30 integer;
  v_level text;
begin
  if not (private.is_patient_self(p_patient) or private.is_guardian_of(p_patient) or private.has_permission('care.manage')) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  select * into v_s from private.streaks(p_patient, v_today);
  select min(local_date) into v_first from public.brushing_logs where patient_id = p_patient;
  v_window := case when v_first is null then 0 else least(30, v_today - v_first + 1) end;
  select count(*) into v_met30 from private.goal_days(p_patient) where met and day > v_today - 30;
  v_level := case
    when v_s.total_met >= 180 then 'Embaixador do sorriso'
    when v_s.total_met >= 90 then 'Mestre do cuidado'
    when v_s.total_met >= 30 then 'Guardião do sorriso'
    when v_s.total_met >= 7 then 'Sorriso consciente'
    else 'Primeiro passo' end;
  return jsonb_build_object(
    'today', v_today,
    'goal', (select to_jsonb(h) - 'patient_id' - 'set_by' from public.habit_goals h where h.patient_id = p_patient),
    'today_counts', jsonb_build_object(
       'brushing', (select count(*) from public.brushing_logs where patient_id = p_patient and local_date = v_today and kind = 'brushing'),
       'flossing', (select count(*) from public.brushing_logs where patient_id = p_patient and local_date = v_today and kind = 'flossing')),
    'current_streak', v_s.current_streak,
    'best_streak', v_s.best_streak,
    'total_goal_days', v_s.total_met,
    'level', v_level,
    'adherence_percent', case when v_window = 0 then null else round(100.0 * v_met30 / v_window) end,
    'adherence_window_days', v_window,
    'calendar', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'met', met) order by day)
                            from private.goal_days(p_patient) where day > v_today - 42), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- CG Care
-- -----------------------------------------------------------------------------
create type public.care_kind as enum ('post_op', 'orthodontic', 'appliance', 'hygiene', 'return');

create table public.care_protocols (
  id          uuid primary key default gen_random_uuid(),
  kind        public.care_kind not null,
  title       text not null check (length(title) between 3 and 120),
  body        text not null check (length(body) between 10 and 5000),
  default_interval_days smallint check (default_interval_days is null or default_interval_days between 1 and 730),
  -- Só protocolos aprovados por dentista podem ser enviados a pacientes.
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint care_protocols_approval check ((approved_by is null) = (approved_at is null))
);
alter table public.care_protocols enable row level security;
create trigger care_protocols_touch before update on public.care_protocols for each row execute function private.touch_updated_at();
create trigger audit_care_protocols after insert or update on public.care_protocols for each row execute function private.audit_row_change();
create policy "care_protocols: equipe lê" on public.care_protocols for select to authenticated
  using ((select private.has_permission('care.manage')));
create policy "care_protocols: equipe gerencia" on public.care_protocols for all to authenticated
  using ((select private.has_permission('care.manage'))) with check ((select private.has_permission('care.manage')));

-- Aprovação só por dentista com MFA (o próprio papel, não apenas a permissão).
create or replace function private.protocol_approval_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reapproving boolean := new.approved_at is not null and new.approved_at is distinct from old.approved_at;
begin
  if v_reapproving then
    if not private.has_role('dentist') or new.approved_by is distinct from (select auth.uid()) then
      raise exception 'somente uma dentista pode aprovar o protocolo' using errcode = '42501';
    end if;
  elsif new.body is distinct from old.body or new.title is distinct from old.title then
    -- Texto alterado sem nova aprovação: a aprovação anterior deixa de valer.
    new.approved_at := null;
    new.approved_by := null;
  end if;
  return new;
end;
$$;
create trigger care_protocols_approval before update on public.care_protocols
  for each row execute function private.protocol_approval_guard();

create or replace function private.protocol_insert_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.approved_at is not null and (not private.has_role('dentist') or new.approved_by <> (select auth.uid())) then
    raise exception 'somente uma dentista pode aprovar o protocolo' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger care_protocols_insert_approval before insert on public.care_protocols
  for each row execute function private.protocol_insert_guard();

create table public.care_reminders (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  protocol_id     uuid not null references public.care_protocols (id),
  personal_note   text check (personal_note is null or length(personal_note) <= 1000),
  interval_days   smallint check (interval_days is null or interval_days between 1 and 730),
  next_due_on     date,
  ends_on         date,
  acknowledged_at timestamptz,
  active          boolean not null default true,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index care_reminders_due_idx on public.care_reminders (next_due_on) where active;
alter table public.care_reminders enable row level security;
create trigger audit_care_reminders after insert or update on public.care_reminders for each row execute function private.audit_row_change();
create policy "care_reminders: paciente e responsável leem" on public.care_reminders for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
create policy "care_reminders: equipe lê" on public.care_reminders for select to authenticated
  using ((select private.has_permission('care.manage')));
create policy "care_reminders: equipe edita" on public.care_reminders for update to authenticated
  using ((select private.has_permission('care.manage'))) with check ((select private.has_permission('care.manage')));
revoke insert, delete on public.care_reminders from anon, authenticated;

-- Pacientes leem o texto dos protocolos que receberam.
create policy "care_protocols: paciente lê os recebidos" on public.care_protocols for select to authenticated
  using (exists (select 1 from public.care_reminders r where r.protocol_id = care_protocols.id));

create or replace function public.assign_care_protocol(
  p_patient uuid, p_protocol uuid, p_note text default null, p_interval_days integer default null,
  p_first_due date default null, p_ends date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_title text;
begin
  if not private.has_permission('care.manage') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  select title into v_title from public.care_protocols where id = p_protocol and active and approved_at is not null;
  if v_title is null then
    raise exception 'protocolo inexistente ou ainda não aprovado por dentista' using errcode = '22023';
  end if;
  insert into public.care_reminders (patient_id, protocol_id, personal_note, interval_days, next_due_on, ends_on, created_by)
  select p_patient, p_protocol, nullif(btrim(p_note), ''), coalesce(p_interval_days, cp.default_interval_days),
         coalesce(p_first_due, case when coalesce(p_interval_days, cp.default_interval_days) is not null
                                    then current_date + coalesce(p_interval_days, cp.default_interval_days) end),
         p_ends, (select auth.uid())
    from public.care_protocols cp where cp.id = p_protocol
  returning id into v_id;
  perform private.notify(r, 'care.assigned', 'Nova orientação de cuidado', v_title, '/portal/cuidados', 'care-' || v_id)
     from private.patient_recipients(p_patient) r;
  return v_id;
end;
$$;

create or replace function public.acknowledge_care(p_reminder uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient uuid;
begin
  select patient_id into v_patient from public.care_reminders where id = p_reminder;
  if v_patient is null or not (private.is_patient_self(v_patient) or private.is_guardian_of(v_patient)) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  update public.care_reminders set acknowledged_at = coalesce(acknowledged_at, now()) where id = p_reminder;
end;
$$;

-- Canal de mensagens paciente ↔ clínica (sem diagnóstico por mensagem).
create table public.patient_messages (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  author_id   uuid references public.profiles (id) on delete set null,
  from_staff  boolean not null,
  body        text not null check (length(body) between 1 and 2000),
  topic       text check (topic is null or length(topic) <= 60),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index patient_messages_patient_idx on public.patient_messages (patient_id, created_at);
alter table public.patient_messages enable row level security;
create policy "patient_messages: paciente e responsável leem" on public.patient_messages for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
create policy "patient_messages: equipe lê" on public.patient_messages for select to authenticated
  using ((select private.has_permission('messages.manage')));
revoke insert, update, delete on public.patient_messages from anon, authenticated;

create or replace function public.send_patient_message(p_patient uuid, p_body text, p_topic text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.has_permission('messages.manage');
  v_id uuid;
begin
  if not (v_staff or private.is_patient_self(p_patient) or private.is_guardian_of(p_patient)) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  insert into public.patient_messages (patient_id, author_id, from_staff, body, topic)
  values (p_patient, (select auth.uid()), v_staff, btrim(p_body), nullif(btrim(p_topic), ''))
  returning id into v_id;
  if v_staff then
    perform private.notify(r, 'message.reply', 'Nova mensagem da clínica', null, '/portal/mensagens', 'msg-' || v_id)
       from private.patient_recipients(p_patient) r;
  end if;
  return v_id;
end;
$$;

create or replace function public.mark_messages_read(p_patient uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean := private.has_permission('messages.manage');
begin
  if not (v_staff or private.is_patient_self(p_patient) or private.is_guardian_of(p_patient)) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  -- Cada lado marca como lidas as mensagens do outro lado.
  update public.patient_messages set read_at = now()
   where patient_id = p_patient and read_at is null and from_staff = not v_staff;
end;
$$;

-- -----------------------------------------------------------------------------
-- CG Passport — check-in por token temporário (o QR Code não contém dados pessoais)
-- -----------------------------------------------------------------------------
create table public.checkin_tokens (
  token_hash     text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  issued_to      uuid references public.profiles (id) on delete cascade,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.checkin_tokens enable row level security;
revoke all on public.checkin_tokens from anon, authenticated;

create or replace function public.issue_checkin_token(p_appointment uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt  public.appointments;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_exp   timestamptz := now() + interval '10 minutes';
begin
  select * into v_appt from public.appointments where id = p_appointment;
  if not found or not private.can_self_schedule(v_appt.patient_id) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'consulta não está aguardando chegada' using errcode = '22023';
  end if;
  if (v_appt.starts_at at time zone private.clinic_tz())::date <> (now() at time zone private.clinic_tz())::date then
    raise exception 'o check-in fica disponível no dia da consulta' using errcode = '22023';
  end if;
  delete from public.checkin_tokens where appointment_id = p_appointment and used_at is null;
  insert into public.checkin_tokens (token_hash, appointment_id, issued_to, expires_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), p_appointment, (select auth.uid()), v_exp);
  return jsonb_build_object('token', v_token, 'expires_at', v_exp);
end;
$$;

create or replace function public.checkin_with_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tok  public.checkin_tokens;
  v_appt public.appointments;
begin
  if not private.has_permission('checkin.perform') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  select * into v_tok from public.checkin_tokens
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or v_tok.used_at is not null or v_tok.expires_at < now() then
    raise exception 'código inválido ou expirado' using errcode = '22023';
  end if;
  update public.checkin_tokens set used_at = now() where token_hash = v_tok.token_hash;
  perform set_config('cg.status_reason', 'check-in por QR Code', true);
  update public.appointments set status = 'checked_in' where id = v_tok.appointment_id and status in ('scheduled', 'confirmed')
  returning * into v_appt;
  if not found then
    raise exception 'consulta não está aguardando chegada' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'appointment_id', v_appt.id,
    'patient', (select coalesce(social_name, full_name) from public.patients where id = v_appt.patient_id),
    'starts_at', v_appt.starts_at);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.log_habit(uuid, public.habit_kind, integer)',
    'public.complete_mission(uuid, text)',
    'public.daily_summary(uuid)',
    'public.assign_care_protocol(uuid, uuid, text, integer, date, date)',
    'public.acknowledge_care(uuid)',
    'public.send_patient_message(uuid, text, text)',
    'public.mark_messages_read(uuid)',
    'public.issue_checkin_token(uuid)',
    'public.checkin_with_token(text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke truncate on public.habit_goals, public.brushing_logs, public.achievements, public.patient_achievements,
  public.education_missions, public.patient_missions, public.care_protocols, public.care_reminders,
  public.patient_messages, public.checkin_tokens from anon, authenticated;
