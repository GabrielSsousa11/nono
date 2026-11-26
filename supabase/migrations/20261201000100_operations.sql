-- =============================================================================
-- Migration 0006 — Operação (Fases 9 e 10)
-- automation_rules, automation_jobs, push_subscriptions, invoices, payments,
-- expenses, satisfaction_surveys, indicadores (CG Intelligence).
-- =============================================================================

insert into public.permissions (key, description) values
  ('automations.manage', 'Configurar automações e acompanhar a fila de execução'),
  ('reports.read',       'Ver indicadores da clínica');
insert into public.role_permissions (role, permission) values
  ('admin', 'automations.manage'), ('admin', 'reports.read'),
  ('finance', 'reports.read');

-- -----------------------------------------------------------------------------
-- Automações: regras configuráveis + fila persistente idempotente
-- -----------------------------------------------------------------------------
create table public.automation_rules (
  key         text primary key check (key ~ '^[a-z_]+\.[a-z_0-9]+$'),
  title       text not null,
  description text not null,
  enabled     boolean not null default true,
  config      jsonb not null default '{}'::jsonb,
  -- Consentimento exigido para executar (null = comunicação de serviço).
  requires_consent public.consent_kind,
  updated_at  timestamptz not null default now()
);
insert into public.automation_rules (key, title, description, enabled, config, requires_consent) values
  ('appointment.confirmation', 'Confirmação de consulta', 'Pede confirmação da consulta antes do atendimento.', true, '{"hours_before": 48}', null),
  ('appointment.reminder', 'Lembrete antecipado', 'Lembra a consulta no dia anterior.', true, '{"hours_before": 24}', null),
  ('ortho.maintenance', 'Manutenção de aparelho', 'Avisa quando um lembrete de manutenção ortodôntica vence.', true, '{}', null),
  ('care.due', 'Retorno e cuidados', 'Avisa quando um lembrete de cuidado ou retorno vence.', true, '{}', null),
  ('post_visit.guidance', 'Orientações pós-consulta', 'Envia as orientações de cuidado atribuídas no dia da consulta.', true, '{}', null),
  ('satisfaction.survey', 'Pesquisa de satisfação', 'Convida para avaliar o atendimento após a consulta concluída.', true, '{"hours_after": 3}', null),
  ('finance.reminder', 'Lembrete financeiro', 'Avisa sobre cobranças próximas do vencimento.', false, '{"days_before": 3}', null),
  ('birthday.message', 'Aniversário', 'Mensagem de aniversário — somente com autorização do paciente.', false, '{}', 'birthday_messages');
alter table public.automation_rules enable row level security;
create policy "automation_rules: gestão" on public.automation_rules for select to authenticated
  using ((select private.has_permission('automations.manage')));
create policy "automation_rules: gestão edita" on public.automation_rules for update to authenticated
  using ((select private.has_permission('automations.manage'))) with check ((select private.has_permission('automations.manage')));
revoke insert, delete on public.automation_rules from anon, authenticated;
grant update (enabled, config) on public.automation_rules to authenticated;
create trigger automation_rules_touch before update on public.automation_rules for each row execute function private.touch_updated_at();
create trigger audit_automation_rules after update on public.automation_rules for each row execute function private.audit_row_change();

create type public.job_status as enum ('pending', 'running', 'done', 'failed', 'skipped');

create table public.automation_jobs (
  id           bigint generated always as identity primary key,
  rule_key     text not null references public.automation_rules (key),
  -- Chave de idempotência: o mesmo evento nunca gera duas execuções.
  dedupe_key   text not null unique,
  -- Somente identificadores (nunca conteúdo clínico).
  payload      jsonb not null default '{}'::jsonb,
  run_at       timestamptz not null default now(),
  status       public.job_status not null default 'pending',
  attempts     smallint not null default 0,
  max_attempts smallint not null default 5,
  last_error   text,
  locked_at    timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index automation_jobs_due_idx on public.automation_jobs (run_at) where status = 'pending';
alter table public.automation_jobs enable row level security;
create policy "automation_jobs: gestão lê" on public.automation_jobs for select to authenticated
  using ((select private.has_permission('automations.manage')));
revoke insert, update, delete on public.automation_jobs from anon, authenticated;

create or replace function private.enqueue(p_rule text, p_dedupe text, p_payload jsonb, p_run_at timestamptz)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.automation_jobs (rule_key, dedupe_key, payload, run_at)
  select p_rule, p_dedupe, p_payload, p_run_at
   where exists (select 1 from public.automation_rules where key = p_rule and enabled)
  on conflict (dedupe_key) do nothing;
$$;
revoke all on function private.enqueue(text, text, jsonb, timestamptz) from public;

-- Agenda trabalhos a partir do estado atual dos dados (idempotente; rodar a cada 15 min).
create or replace function private.schedule_automations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before integer := (select count(*) from public.automation_jobs);
  v_tz text := private.clinic_tz();
begin
  -- Confirmação e lembrete de consultas futuras
  perform private.enqueue('appointment.confirmation', 'confirm:' || a.id || ':' || extract(epoch from a.starts_at)::bigint,
            jsonb_build_object('appointment_id', a.id),
            a.starts_at - make_interval(hours => coalesce((r.config ->> 'hours_before')::int, 48)))
    from public.appointments a, public.automation_rules r
   where r.key = 'appointment.confirmation' and a.status = 'scheduled' and a.starts_at between now() and now() + interval '8 days';
  perform private.enqueue('appointment.reminder', 'remind:' || a.id || ':' || extract(epoch from a.starts_at)::bigint,
            jsonb_build_object('appointment_id', a.id),
            a.starts_at - make_interval(hours => coalesce((r.config ->> 'hours_before')::int, 24)))
    from public.appointments a, public.automation_rules r
   where r.key = 'appointment.reminder' and a.status in ('scheduled', 'confirmed') and a.starts_at between now() and now() + interval '8 days';
  -- Pesquisa após consulta concluída
  perform private.enqueue('satisfaction.survey', 'survey:' || a.id, jsonb_build_object('appointment_id', a.id),
            a.ends_at + make_interval(hours => coalesce((r.config ->> 'hours_after')::int, 3)))
    from public.appointments a, public.automation_rules r
   where r.key = 'satisfaction.survey' and a.status = 'completed' and a.ends_at > now() - interval '7 days';
  -- Lembretes de cuidado vencidos (manutenção ortodôntica separada)
  perform private.enqueue(case when cp.kind in ('orthodontic', 'appliance') then 'ortho.maintenance' else 'care.due' end,
            'care:' || cr.id || ':' || cr.next_due_on, jsonb_build_object('reminder_id', cr.id),
            (cr.next_due_on + time '09:00') at time zone v_tz)
    from public.care_reminders cr join public.care_protocols cp on cp.id = cr.protocol_id
   where cr.active and cr.next_due_on is not null and cr.next_due_on <= current_date + 1
     and (cr.ends_on is null or cr.ends_on >= cr.next_due_on);
  -- Orientações pós-consulta: orientações atribuídas hoje
  perform private.enqueue('post_visit.guidance', 'guidance:' || cr.id, jsonb_build_object('reminder_id', cr.id), now())
    from public.care_reminders cr
   where cr.created_at > now() - interval '1 day' and cr.acknowledged_at is null;
  -- Lembrete financeiro
  perform private.enqueue('finance.reminder', 'invoice:' || i.id || ':' || i.due_date, jsonb_build_object('invoice_id', i.id),
            ((i.due_date - coalesce((r.config ->> 'days_before')::int, 3)) + time '10:00') at time zone v_tz)
    from public.invoices i, public.automation_rules r
   where r.key = 'finance.reminder' and i.status in ('open', 'partially_paid') and i.due_date between current_date and current_date + 10;
  -- Aniversário
  perform private.enqueue('birthday.message', 'birthday:' || p.id || ':' || extract(year from now())::int,
            jsonb_build_object('patient_id', p.id), (current_date + time '09:00') at time zone v_tz)
    from public.patients p
   where p.birth_date is not null and p.archived_at is null
     and extract(month from p.birth_date) = extract(month from (now() at time zone v_tz))
     and extract(day from p.birth_date) = extract(day from (now() at time zone v_tz));
  return (select count(*) from public.automation_jobs) - v_before;
end;
$$;
revoke all on function private.schedule_automations() from public;

-- Executa um trabalho: cria a notificação interna (canal base, gratuito).
create or replace function private.execute_job(p_job public.automation_jobs)
returns public.job_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule   public.automation_rules;
  v_appt   public.appointments;
  v_patient uuid;
  v_title  text;
  v_body   text;
  v_link   text;
begin
  select * into v_rule from public.automation_rules where key = p_job.rule_key;
  if not v_rule.enabled then return 'skipped'; end if;

  if p_job.rule_key in ('appointment.confirmation', 'appointment.reminder', 'satisfaction.survey') then
    select * into v_appt from public.appointments where id = (p_job.payload ->> 'appointment_id')::uuid;
    if not found then return 'skipped'; end if;
    v_patient := v_appt.patient_id;
    if p_job.rule_key = 'satisfaction.survey' then
      if v_appt.status <> 'completed' then return 'skipped'; end if;
      insert into public.satisfaction_surveys (appointment_id, patient_id) values (v_appt.id, v_patient) on conflict do nothing;
      v_title := 'Como foi o seu atendimento?'; v_body := 'Sua avaliação leva menos de um minuto.'; v_link := '/portal/avaliacao';
    else
      if v_appt.status not in ('scheduled', 'confirmed') or v_appt.starts_at < now() then return 'skipped'; end if;
      if p_job.rule_key = 'appointment.confirmation' and v_appt.status = 'confirmed' then return 'skipped'; end if;
      v_title := case when p_job.rule_key = 'appointment.confirmation' then 'Confirme sua consulta' else 'Sua consulta é amanhã' end;
      v_body := 'Veja os detalhes no portal.'; v_link := '/portal/agenda';
    end if;
  elsif p_job.rule_key in ('care.due', 'ortho.maintenance', 'post_visit.guidance') then
    select cr.patient_id, cp.title into v_patient, v_title
      from public.care_reminders cr join public.care_protocols cp on cp.id = cr.protocol_id
     where cr.id = (p_job.payload ->> 'reminder_id')::uuid and cr.active;
    if v_patient is null then return 'skipped'; end if;
    v_body := v_title;
    v_title := case p_job.rule_key when 'ortho.maintenance' then 'Hora da manutenção do aparelho'
                                   when 'post_visit.guidance' then 'Orientações da sua consulta'
                                   else 'Lembrete de cuidado' end;
    v_link := '/portal/cuidados';
    if p_job.rule_key <> 'post_visit.guidance' then
      update public.care_reminders
         set next_due_on = case when interval_days is null then null else next_due_on + interval_days end
       where id = (p_job.payload ->> 'reminder_id')::uuid;
    end if;
  elsif p_job.rule_key = 'finance.reminder' then
    select patient_id into v_patient from public.invoices
     where id = (p_job.payload ->> 'invoice_id')::uuid and status in ('open', 'partially_paid');
    if v_patient is null then return 'skipped'; end if;
    v_title := 'Cobrança próxima do vencimento'; v_body := 'Consulte os detalhes no portal.'; v_link := '/portal/financeiro';
  elsif p_job.rule_key = 'birthday.message' then
    v_patient := (p_job.payload ->> 'patient_id')::uuid;
    v_title := 'Feliz aniversário!'; v_body := 'A equipe da clínica deseja um ano de muitos sorrisos.'; v_link := '/portal';
  else
    raise exception 'regra sem executor: %', p_job.rule_key;
  end if;

  if v_rule.requires_consent is not null and not exists (
       select 1 from public.consents where patient_id = v_patient and kind = v_rule.requires_consent and granted and revoked_at is null) then
    return 'skipped';
  end if;

  perform private.notify(r, p_job.rule_key, v_title, v_body, v_link, 'job-' || p_job.id)
     from private.patient_recipients(v_patient) r;
  return 'done';
end;
$$;
revoke all on function private.execute_job(public.automation_jobs) from public;

-- Processa a fila: trava com SKIP LOCKED, tenta de novo com espera exponencial.
create or replace function private.run_automation_jobs(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.automation_jobs;
  v_status public.job_status;
  v_done integer := 0;
  v_failed integer := 0;
begin
  update public.automation_jobs set status = 'pending', locked_at = null
   where status = 'running' and locked_at < now() - interval '10 minutes';
  for v_job in
    select * from public.automation_jobs
     where status = 'pending' and run_at <= now()
     order by run_at limit p_limit
     for update skip locked
  loop
    update public.automation_jobs set status = 'running', locked_at = now(), attempts = attempts + 1 where id = v_job.id;
    begin
      v_status := private.execute_job(v_job);
      update public.automation_jobs set status = v_status, finished_at = now(), last_error = null where id = v_job.id;
      v_done := v_done + 1;
    exception when others then
      update public.automation_jobs
         set status = case when attempts >= max_attempts then 'failed'::public.job_status else 'pending'::public.job_status end,
             last_error = left(sqlerrm, 300),
             run_at = now() + make_interval(mins => (2 ^ least(attempts, 10))::int),
             locked_at = null
       where id = v_job.id;
      v_failed := v_failed + 1;
    end;
  end loop;
  perform private.expire_waitlist_offers();
  return jsonb_build_object('processed', v_done, 'failed', v_failed);
end;
$$;
revoke all on function private.run_automation_jobs(integer) from public;

-- Execução manual pelo CG Studio (mesmo código do agendador).
create or replace function public.run_automations_now()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('automations.manage') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  return jsonb_build_object('scheduled', private.schedule_automations()) || private.run_automation_jobs(200);
end;
$$;

-- Web Push: assinaturas do navegador por pessoa.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://'),
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: a própria pessoa" on public.push_subscriptions for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
alter table public.notifications add column pushed_at timestamptz;

-- -----------------------------------------------------------------------------
-- Financeiro
-- -----------------------------------------------------------------------------
create type public.invoice_status as enum ('open', 'partially_paid', 'paid', 'cancelled');
create type public.payment_method as enum ('pix', 'cash', 'debit', 'credit', 'transfer', 'other');

create table public.invoices (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references public.patients (id),
  appointment_id    uuid references public.appointments (id) on delete set null,
  treatment_plan_id uuid references public.treatment_plans (id) on delete set null,
  description       text not null check (length(description) between 3 and 200),
  amount_cents      integer not null check (amount_cents > 0),
  due_date          date not null,
  status            public.invoice_status not null default 'open',
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index invoices_status_idx on public.invoices (status, due_date);
alter table public.invoices enable row level security;
create trigger invoices_touch before update on public.invoices for each row execute function private.touch_updated_at();
create trigger audit_invoices after insert or update on public.invoices for each row execute function private.audit_row_change();
create policy "invoices: financeiro lê" on public.invoices for select to authenticated using ((select private.has_permission('finance.read')));
create policy "invoices: paciente vê as suas" on public.invoices for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
create policy "invoices: financeiro cria" on public.invoices for insert to authenticated
  with check ((select private.has_permission('finance.write')) and status = 'open');
create policy "invoices: financeiro edita" on public.invoices for update to authenticated
  using ((select private.has_permission('finance.write'))) with check ((select private.has_permission('finance.write')));
revoke delete on public.invoices from anon, authenticated;

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   uuid not null references public.invoices (id),
  amount_cents integer not null check (amount_cents > 0),
  paid_on      date not null,
  method       public.payment_method not null,
  recorded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index payments_paid_idx on public.payments (paid_on);
alter table public.payments enable row level security;
create trigger audit_payments after insert on public.payments for each row execute function private.audit_row_change();
create policy "payments: financeiro lê" on public.payments for select to authenticated using ((select private.has_permission('finance.read')));
create policy "payments: paciente vê os seus" on public.payments for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy "payments: financeiro registra" on public.payments for insert to authenticated
  with check ((select private.has_permission('finance.write')) and recorded_by = (select auth.uid()));
revoke update, delete on public.payments from anon, authenticated;

create or replace function private.refresh_invoice_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_paid integer;
  v_status public.invoice_status;
begin
  select amount_cents, status into v_total, v_status from public.invoices where id = new.invoice_id for update;
  if v_status = 'cancelled' then
    raise exception 'cobrança cancelada não recebe pagamentos' using errcode = '22023';
  end if;
  select coalesce(sum(amount_cents), 0) into v_paid from public.payments where invoice_id = new.invoice_id;
  if v_paid > v_total then
    raise exception 'pagamento excede o valor da cobrança' using errcode = '22023';
  end if;
  update public.invoices set status = (case when v_paid = v_total then 'paid' else 'partially_paid' end)::public.invoice_status
   where id = new.invoice_id;
  return new;
end;
$$;
create trigger payments_refresh_invoice after insert on public.payments for each row execute function private.refresh_invoice_status();

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  description  text not null check (length(description) between 3 and 200),
  category     text not null check (length(category) between 2 and 60),
  amount_cents integer not null check (amount_cents > 0),
  due_date     date not null,
  paid_on      date,
  recorded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
alter table public.expenses enable row level security;
create trigger audit_expenses after insert or update on public.expenses for each row execute function private.audit_row_change();
create policy "expenses: financeiro lê" on public.expenses for select to authenticated using ((select private.has_permission('finance.read')));
create policy "expenses: financeiro registra" on public.expenses for insert to authenticated
  with check ((select private.has_permission('finance.write')));
create policy "expenses: financeiro edita" on public.expenses for update to authenticated
  using ((select private.has_permission('finance.write'))) with check ((select private.has_permission('finance.write')));
revoke delete on public.expenses from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Pesquisas de satisfação
-- -----------------------------------------------------------------------------
create table public.satisfaction_surveys (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  patient_id     uuid not null references public.patients (id) on delete cascade,
  score          smallint check (score is null or score between 0 and 10),
  comment        text check (comment is null or length(comment) <= 1000),
  sent_at        timestamptz not null default now(),
  answered_at    timestamptz,
  constraint satisfaction_answer check ((answered_at is null) = (score is null))
);
alter table public.satisfaction_surveys enable row level security;
create policy "satisfaction: paciente vê as suas" on public.satisfaction_surveys for select to authenticated
  using ((select private.is_patient_self(patient_id)) or (select private.is_guardian_of(patient_id)));
create policy "satisfaction: gestão lê" on public.satisfaction_surveys for select to authenticated
  using ((select private.has_permission('reports.read')));
revoke insert, update, delete on public.satisfaction_surveys from anon, authenticated;

create or replace function public.answer_survey(p_survey uuid, p_score integer, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient uuid;
begin
  select patient_id into v_patient from public.satisfaction_surveys where id = p_survey and answered_at is null;
  if v_patient is null or not (private.is_patient_self(v_patient) or private.is_guardian_of(v_patient)) then
    raise exception 'pesquisa indisponível' using errcode = '42501';
  end if;
  update public.satisfaction_surveys set score = p_score, comment = nullif(btrim(p_comment), ''), answered_at = now()
   where id = p_survey;
end;
$$;

-- -----------------------------------------------------------------------------
-- CG Intelligence — indicadores calculados de dados reais.
-- Cada indicador traz a base (n); abaixo do mínimo, valor = null ("dados insuficientes").
-- -----------------------------------------------------------------------------
create or replace function public.clinic_indicators(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz        text := private.clinic_tz();
  v_from      timestamptz := (p_from + time '00:00') at time zone v_tz;
  v_to        timestamptz := ((p_to + 1) + time '00:00') at time zone v_tz;
  v_min       integer := 5;
  v_ops       boolean := private.has_permission('reports.read') and private.has_permission('agenda.read');
  v_fin       boolean := private.has_permission('finance.read');
  v_result    jsonb := jsonb_build_object('from', p_from, 'to', p_to, 'min_sample', v_min);
  v_total     integer; v_done integer; v_cancel integer; v_noshow integer;
  v_avail_min numeric; v_booked_min numeric;
  v_req integer; v_req_sched integer;
  v_surveys integer;
begin
  if not (private.has_permission('reports.read') or v_fin) then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'período inválido (máximo de 1 ano)' using errcode = '22023';
  end if;

  if v_ops then
    select count(*), count(*) filter (where status = 'completed'), count(*) filter (where status = 'cancelled'),
           count(*) filter (where status = 'no_show')
      into v_total, v_done, v_cancel, v_noshow
      from public.appointments where starts_at >= v_from and starts_at < v_to;

    -- Minutos disponíveis = grade semanal no período − bloqueios (aproximação documentada).
    select coalesce(sum(extract(epoch from (a.ends - a.starts)) / 60), 0) into v_avail_min
      from generate_series(p_from, p_to, interval '1 day') d
      join public.availability a on a.weekday = extract(dow from d)::int
        and (a.valid_from is null or a.valid_from <= d::date) and (a.valid_until is null or a.valid_until >= d::date)
      join public.professionals pr on pr.id = a.professional_id and pr.active;
    select coalesce(sum(extract(epoch from (ends_at - starts_at)) / 60), 0) into v_booked_min
      from public.appointments where starts_at >= v_from and starts_at < v_to and status not in ('cancelled');

    select count(*), count(*) filter (where status = 'scheduled') into v_req, v_req_sched
      from public.booking_requests where created_at >= v_from and created_at < v_to and status <> 'spam';
    select count(*) into v_surveys from public.satisfaction_surveys where answered_at >= v_from and answered_at < v_to;

    v_result := v_result || jsonb_build_object(
      'appointments', jsonb_build_object('total', v_total, 'completed', v_done, 'cancelled', v_cancel, 'no_show', v_noshow),
      'cancellation_rate', case when v_total >= v_min then round(100.0 * v_cancel / v_total, 1) end,
      'no_show_rate', case when v_total - v_cancel >= v_min then round(100.0 * v_noshow / (v_total - v_cancel), 1) end,
      'occupancy_rate', case when v_avail_min >= 60 * v_min then round(100.0 * least(v_booked_min, v_avail_min) / v_avail_min, 1) end,
      'available_hours', round(v_avail_min / 60, 1),
      'new_patients', (select count(*) from (
          select patient_id, min(starts_at) as first_at from public.appointments where status = 'completed' group by patient_id) f
          where f.first_at >= v_from and f.first_at < v_to),
      'returning_patients', (select count(*) from (
          select patient_id from public.appointments where status = 'completed' and starts_at < v_to
           group by patient_id having count(*) >= 2 and max(starts_at) >= v_from) r),
      'booking_requests', jsonb_build_object('total', v_req, 'scheduled', v_req_sched,
          'conversion_rate', case when v_req >= v_min then round(100.0 * v_req_sched / v_req, 1) end),
      'busiest_slots', coalesce((select jsonb_agg(x order by x.n desc) from (
          select extract(dow from starts_at at time zone v_tz)::int as weekday,
                 extract(hour from starts_at at time zone v_tz)::int as hour, count(*) as n
            from public.appointments where starts_at >= v_from and starts_at < v_to and status not in ('cancelled')
           group by 1, 2 order by n desc limit 8) x), '[]'::jsonb),
      'satisfaction', jsonb_build_object('answers', v_surveys,
          'average', case when v_surveys >= v_min then (select round(avg(score)::numeric, 1) from public.satisfaction_surveys
                       where answered_at >= v_from and answered_at < v_to) end,
          'nps', case when v_surveys >= v_min then (select round(100.0 * (count(*) filter (where score >= 9) - count(*) filter (where score <= 6)) / count(*))
                       from public.satisfaction_surveys where answered_at >= v_from and answered_at < v_to) end)
    );
  end if;

  if v_fin then
    v_result := v_result || jsonb_build_object(
      'revenue_cents', (select coalesce(sum(amount_cents), 0) from public.payments where paid_on between p_from and p_to),
      'pending_cents', (select coalesce(sum(i.amount_cents - coalesce((select sum(p.amount_cents) from public.payments p where p.invoice_id = i.id), 0)), 0)
                          from public.invoices i where i.status in ('open', 'partially_paid')),
      'overdue_cents', (select coalesce(sum(i.amount_cents - coalesce((select sum(p.amount_cents) from public.payments p where p.invoice_id = i.id), 0)), 0)
                          from public.invoices i where i.status in ('open', 'partially_paid') and i.due_date < current_date),
      'expenses_cents', (select coalesce(sum(amount_cents), 0) from public.expenses where coalesce(paid_on, due_date) between p_from and p_to),
      'cash_flow', coalesce((select jsonb_agg(m order by m.month) from (
          select to_char(month, 'YYYY-MM') as month,
                 coalesce((select sum(amount_cents) from public.payments where date_trunc('month', paid_on) = month), 0) as income_cents,
                 coalesce((select sum(amount_cents) from public.expenses where paid_on is not null and date_trunc('month', paid_on) = month), 0) as expense_cents
            from generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_to::timestamp), interval '1 month') month) m), '[]'::jsonb)
    );
  end if;
  return v_result;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.run_automations_now()',
    'public.answer_survey(uuid, integer, text)',
    'public.clinic_indicators(date, date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

revoke truncate on public.automation_rules, public.automation_jobs, public.push_subscriptions, public.invoices,
  public.payments, public.expenses, public.satisfaction_surveys from anon, authenticated;

-- pg_cron (somente no Supabase real, onde a extensão existe).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('cg-automations', '*/15 * * * *',
      'select private.schedule_automations(); select private.run_automation_jobs(200);');
    perform cron.schedule('cg-retention', '17 3 * * *', 'select private.purge_expired_booking_requests();');
  end if;
end $$;
