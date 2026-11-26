-- Testes das migrations 0004–0006. Reaproveita dados dos testes anteriores.
\set ON_ERROR_STOP on

create or replace function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute sql; exception when others then failed := true; msg := sqlerrm; end;
  if not failed then raise exception 'ESPERADO ERRO (%), mas o comando foi aceito: %', fragment, sql; end if;
  if msg not like '%' || fragment || '%' then raise exception 'Erro inesperado: % (esperado "%") em: %', msg, fragment, sql; end if;
end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FALHOU: %', msg; end if; end $$;
create or replace function pg_temp.login(p_user uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claim.sub', '', false); perform set_config('request.jwt.claims', '', false); end $$;

-- Constantes: P1 = paciente 1 (vinculado), dentista D, recepção R, financeiro F, admin A
-- =============================================================================
-- Prontuário e odontograma
-- =============================================================================
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
insert into public.clinical_records (patient_id, kind, content, recorded_by, visible_to_patient) values
  ('10000000-0000-0000-0000-000000000001', 'evolution', 'Registro clínico sintético interno.', '00000000-0000-0000-0000-00000000000d', false),
  ('10000000-0000-0000-0000-000000000001', 'note', 'Orientação sintética liberada.', '00000000-0000-0000-0000-00000000000d', true);
select pg_temp.expect_error($q$ insert into public.clinical_records (patient_id, kind, content, recorded_by) values ('10000000-0000-0000-0000-000000000001', 'note', 'x', '00000000-0000-0000-0000-00000000000a') $q$, 'row-level security');
select pg_temp.expect_error($q$ update public.clinical_records set content = 'alterado' $q$, 'permission denied');
select pg_temp.expect_error($q$ delete from public.clinical_records $q$, 'permission denied');
insert into public.tooth_records (patient_id, tooth_fdi, surfaces, state, procedure, performed_on, recorded_by) values
  ('10000000-0000-0000-0000-000000000001', 36, '{O,M}', 'completed', 'Restauração sintética', current_date, '00000000-0000-0000-0000-00000000000d'),
  ('10000000-0000-0000-0000-000000000001', 11, '{}', 'planned', 'Clareamento sintético', null, '00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error($q$ insert into public.tooth_records (patient_id, tooth_fdi, state, procedure, recorded_by) values ('10000000-0000-0000-0000-000000000001', 19, 'planned', 'Inválido', '00000000-0000-0000-0000-00000000000d') $q$, 'check constraint');
select pg_temp.expect_error($q$ insert into public.tooth_records (patient_id, tooth_fdi, state, procedure, recorded_by) values ('10000000-0000-0000-0000-000000000001', 21, 'completed', 'Sem data', '00000000-0000-0000-0000-00000000000d') $q$, 'completed_date');
select pg_temp.expect_error($q$ insert into public.tooth_records (patient_id, tooth_fdi, surfaces, state, procedure, recorded_by) values ('10000000-0000-0000-0000-000000000001', 21, '{X}', 'planned', 'Face inválida', '00000000-0000-0000-0000-00000000000d') $q$, 'check constraint');
insert into public.tooth_records (patient_id, tooth_fdi, state, procedure, recorded_by) values
  ('10000000-0000-0000-0000-000000000001', 55, 'observation', 'Dente decíduo sintético', '00000000-0000-0000-0000-00000000000d');
-- Plano e etapas
insert into public.treatment_plans (id, patient_id, title, status) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Plano sintético', 'active'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Rascunho sintético', 'draft');
insert into public.treatment_stages (plan_id, patient_id, position, title, status, completed_at) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'Etapa 1', 'completed', now()),
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 2, 'Etapa 2', 'pending', null),
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 3, 'Etapa 3', 'skipped', null),
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 4, 'Etapa 4', 'pending', null);
select pg_temp.assert(public.plan_progress('70000000-0000-0000-0000-000000000001') = '{"total": 3, "percent": 33, "completed": 1}'::jsonb, 'progresso ignora etapas puladas');
select pg_temp.expect_error($q$ insert into public.treatment_stages (plan_id, patient_id, position, title) values ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 9, 'Outro paciente') $q$, 'pacientes diferentes');
-- Foto sem consentimento
select pg_temp.expect_error($q$ insert into public.clinical_photos (patient_id, storage_path, taken_on) values ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000001.jpg', current_date) $q$, 'consentimento');
select pg_temp.logout();

-- Recepção e financeiro: nada clínico
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.clinical_records) + (select count(*) from public.tooth_records) + (select count(*) from public.treatment_plans) = 0, 'recepção sem dados clínicos');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select count(*) from public.clinical_records) + (select count(*) from public.treatment_stages) = 0, 'financeiro sem dados clínicos');
select pg_temp.logout();
-- Dentista sem MFA: nada
select pg_temp.login('00000000-0000-0000-0000-00000000000d', 'aal1');
select pg_temp.assert((select count(*) from public.clinical_records) = 0, 'dentista sem MFA não lê prontuário');
select pg_temp.logout();

-- Paciente: só o liberado
select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select pg_temp.assert((select count(*) from public.clinical_records) = 1, 'paciente vê só registro liberado');
select pg_temp.assert((select count(*) from public.tooth_records) = 3, 'paciente vê odontograma liberado');
select pg_temp.assert((select count(*) from public.treatment_plans) = 1, 'rascunho de plano oculto');
select pg_temp.assert((select count(*) from public.treatment_stages) = 4, 'etapas do plano ativo visíveis');
-- Foto com consentimento concedido pelo próprio paciente
select public.set_my_consent('10000000-0000-0000-0000-000000000001', 'clinical_photos', true, 'v1');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
insert into public.clinical_photos (patient_id, storage_path, taken_on) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001/80000000-0000-0000-0000-000000000001.jpg', current_date);
select pg_temp.expect_error($q$ insert into public.clinical_photos (patient_id, storage_path, taken_on) values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002/80000000-0000-0000-0000-000000000002.jpg', current_date) $q$, 'path_patient');
select pg_temp.logout();

-- =============================================================================
-- CG Daily
-- =============================================================================
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
insert into public.habit_goals (patient_id, brushing_per_day, flossing_per_day) values ('10000000-0000-0000-0000-000000000001', 2, 1);
select pg_temp.expect_error($q$ update public.habit_goals set brushing_per_day = 6 $q$, 'check constraint');
select pg_temp.logout();

-- Histórico sintético de 7 dias cumpridos (inserido como superusuário)
insert into public.brushing_logs (patient_id, kind, local_date, logged_at)
select '10000000-0000-0000-0000-000000000001', k, d::date, d
  from generate_series(current_date - 7, current_date - 1, interval '1 day') d,
       unnest(array['brushing', 'brushing', 'flossing']::public.habit_kind[]) k;

select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select public.log_habit('10000000-0000-0000-0000-000000000001', 'brushing', 120);
select pg_temp.expect_error($q$ select public.log_habit('10000000-0000-0000-0000-000000000001', 'brushing') $q$, '2 horas');
select pg_temp.assert((public.daily_summary('10000000-0000-0000-0000-000000000001') ->> 'current_streak')::int = 7, 'sequência de 7 dias (hoje ainda incompleto)');
select pg_temp.assert(public.daily_summary('10000000-0000-0000-0000-000000000001') ->> 'level' = 'Sorriso consciente', 'nível por dias cumpridos');
select pg_temp.assert((select count(*) from public.patient_achievements where achievement_key in ('first_log', 'streak_7')) = 2, 'conquistas concedidas');
select pg_temp.assert((public.daily_summary('10000000-0000-0000-0000-000000000001') ->> 'adherence_percent')::int = 88, 'adesão: 7 de 8 dias');
select pg_temp.expect_error($q$ select public.log_habit('10000000-0000-0000-0000-000000000002', 'brushing') $q$, 'permissão negada');
select pg_temp.expect_error($q$ insert into public.brushing_logs (patient_id, kind, local_date) values ('10000000-0000-0000-0000-000000000001', 'brushing', current_date) $q$, 'permission denied');
select public.complete_mission('10000000-0000-0000-0000-000000000001', 'fio_dental');
select pg_temp.logout();
-- Limite diário: fio dental meta 1 → no máximo 2 registros
update public.brushing_logs set logged_at = logged_at - interval '3 hours';
select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select public.log_habit('10000000-0000-0000-0000-000000000001', 'flossing');
select public.log_habit('10000000-0000-0000-0000-000000000001', 'flossing');
select pg_temp.expect_error($q$ select public.log_habit('10000000-0000-0000-0000-000000000001', 'flossing') $q$, 'meta do dia');
select pg_temp.logout();

-- =============================================================================
-- CG Care
-- =============================================================================
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$ insert into public.care_protocols (kind, title, body) values ('post_op', 'Pós sintético', 'Texto sintético de orientação.') $q$, 'row-level security');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
-- Administradora cria mas não pode aprovar (não é dentista)
insert into public.care_protocols (id, kind, title, body, default_interval_days) values
  ('90000000-0000-0000-0000-000000000001', 'orthodontic', 'Manutenção sintética', 'Texto sintético de manutenção do aparelho.', 30);
select pg_temp.expect_error($q$ update public.care_protocols set approved_by = '00000000-0000-0000-0000-00000000000a', approved_at = now() $q$, 'somente uma dentista');
select pg_temp.expect_error($q$ select public.assign_care_protocol('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001') $q$, 'não aprovado');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
update public.care_protocols set approved_by = '00000000-0000-0000-0000-00000000000d', approved_at = now();
select public.assign_care_protocol('10000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'Nota sintética', null, current_date);
select pg_temp.logout();
-- Editar o texto invalida a aprovação
update public.care_protocols set body = 'Texto sintético alterado depois da aprovação.';
select pg_temp.assert((select approved_at from public.care_protocols) is null, 'alteração exige nova aprovação');
select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select pg_temp.assert((select count(*) from public.care_protocols) = 1, 'paciente lê protocolo recebido');
select public.acknowledge_care((select id from public.care_reminders));
select pg_temp.assert((select acknowledged_at from public.care_reminders) is not null, 'confirmação de leitura');
select public.send_patient_message('10000000-0000-0000-0000-000000000001', 'Dúvida sintética sobre o horário.');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.patient_messages) = 1, 'recepção vê mensagens');
select public.send_patient_message('10000000-0000-0000-0000-000000000001', 'Resposta sintética.');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select count(*) from public.patient_messages) = 0, 'financeiro não vê mensagens');
select pg_temp.logout();

-- =============================================================================
-- CG Passport
-- =============================================================================
-- Consulta de hoje para P1 (superusuário cria direto)
insert into public.appointments (id, patient_id, professional_id, service_id, starts_at, ends_at, source)
values ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002',
        '60000000-0000-0000-0000-000000000001', now() + interval '20 minutes', now() + interval '80 minutes', 'studio');
-- (ajuste se a consulta cair no dia seguinte no fuso da clínica)
update public.appointments set starts_at = date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '23 hours',
                               ends_at = date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' + interval '23 hours 30 minutes'
 where id = 'a0000000-0000-0000-0000-000000000001';
create temp table tok (t text);
grant all on tok to authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
insert into tok select public.issue_checkin_token('a0000000-0000-0000-0000-000000000001') ->> 'token';
select pg_temp.expect_error($q$ select * from public.checkin_tokens $q$, 'permission denied');
select pg_temp.expect_error($q$ select public.checkin_with_token((select t from tok)) $q$, 'permissão negada');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert(public.checkin_with_token((select t from tok)) ->> 'patient' = 'Paciente Um', 'check-in pela recepção');
select pg_temp.expect_error($q$ select public.checkin_with_token((select t from tok)) $q$, 'inválido ou expirado');
select pg_temp.logout();
select pg_temp.assert((select status from public.appointments where id = 'a0000000-0000-0000-0000-000000000001') = 'checked_in', 'status checked_in');

-- =============================================================================
-- Automações, pesquisa, financeiro, indicadores
-- =============================================================================
update public.appointments set status = 'completed', ends_at = now() - interval '4 hours', starts_at = now() - interval '5 hours'
 where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$ select public.run_automations_now() $q$, 'permissão negada');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.run_automations_now();
select public.run_automations_now(); -- idempotente
select pg_temp.logout();
select pg_temp.assert((select count(*) from public.automation_jobs where rule_key = 'satisfaction.survey') = 1, 'uma pesquisa por consulta (deduplicação)');
select pg_temp.assert((select count(*) from public.satisfaction_surveys) = 1, 'pesquisa criada');
select pg_temp.assert((select count(*) from public.automation_jobs where rule_key = 'birthday.message') = 0, 'aniversário desligado por padrão');
select pg_temp.assert(not exists (select 1 from public.automation_jobs where status = 'failed'), 'nenhum trabalho falhou');

select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select public.answer_survey((select id from public.satisfaction_surveys), 10, 'Comentário sintético');
select pg_temp.expect_error($q$ select public.answer_survey((select id from public.satisfaction_surveys), 9) $q$, 'indisponível');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into public.invoices (id, patient_id, description, amount_cents, due_date) values
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Cobrança sintética', 30000, current_date + 2);
insert into public.payments (invoice_id, amount_cents, paid_on, method, recorded_by) values
  ('b0000000-0000-0000-0000-000000000001', 10000, current_date, 'pix', '00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select status from public.invoices) = 'partially_paid', 'pagamento parcial');
select pg_temp.expect_error($q$ insert into public.payments (invoice_id, amount_cents, paid_on, method, recorded_by) values ('b0000000-0000-0000-0000-000000000001', 25000, current_date, 'pix', '00000000-0000-0000-0000-00000000000f') $q$, 'excede');
insert into public.payments (invoice_id, amount_cents, paid_on, method, recorded_by) values
  ('b0000000-0000-0000-0000-000000000001', 20000, current_date, 'cash', '00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select status from public.invoices) = 'paid', 'quitada');
insert into public.expenses (description, category, amount_cents, due_date, paid_on) values ('Despesa sintética', 'Materiais', 5000, current_date, current_date);
select pg_temp.assert((public.clinic_indicators(current_date - 30, current_date) ->> 'revenue_cents')::int = 30000, 'receita');
select pg_temp.assert(public.clinic_indicators(current_date - 30, current_date) ? 'appointments', 'financeiro vê agregados de agenda (sem dados clínicos)');
select pg_temp.assert((public.clinic_indicators(current_date - 30, current_date) ->> 'pending_cents')::int = 0, 'nada pendente');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert(public.clinic_indicators(current_date - 30, current_date + 30) -> 'satisfaction' ->> 'nps' is null, 'NPS nulo com menos de 5 respostas');
select pg_temp.assert((public.clinic_indicators(current_date - 30, current_date + 30) -> 'satisfaction' ->> 'answers')::int = 1, 'base informada');
select pg_temp.expect_error($q$ select public.clinic_indicators(current_date, current_date - 1) $q$, 'período inválido');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error($q$ select public.clinic_indicators(current_date - 30, current_date) $q$, 'permissão negada');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select pg_temp.assert((select count(*) from public.invoices) = 1, 'paciente vê a própria cobrança');
select pg_temp.assert((select count(*) from public.expenses) = 0, 'paciente não vê despesas');
select pg_temp.logout();

-- Fila: falha é registrada e reagendada, não interrompe as demais
insert into public.automation_jobs (rule_key, dedupe_key, payload) values ('appointment.reminder', 'teste-falha', '{"appointment_id": "nao-e-uuid"}');
select private.run_automation_jobs(10);
select pg_temp.assert((select status from public.automation_jobs where dedupe_key = 'teste-falha') = 'pending', 'falha volta para a fila');
select pg_temp.assert((select attempts from public.automation_jobs where dedupe_key = 'teste-falha') = 1, 'tentativa contada');
select pg_temp.assert((select last_error from public.automation_jobs where dedupe_key = 'teste-falha') is not null, 'erro registrado');

select 'OK: clínico, engajamento e operação passaram' as resultado;
