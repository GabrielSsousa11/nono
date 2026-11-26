-- Testes da agenda (Fase 4). Executar com scripts/db/test-migrations.sh
-- Roda depois de identity_access.test.sql (reaproveita os usuários e pacientes de lá).
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

-- Dia de teste: próxima segunda-feira a partir de daqui a 7 dias (sempre no futuro).
create temp table d as
  select (current_date + 7 + ((8 - extract(isodow from current_date + 7)::int) % 7))::date as day;
grant select on d to authenticated;
select pg_temp.assert(extract(dow from (select day from d)) = 1, 'dia de teste é segunda-feira');

-- Cadastro pela administradora
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.professionals (id, profile_id, display_name) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Dra. Sintética');
insert into public.services (id, name, duration_minutes, buffer_minutes, self_booking) values
  ('60000000-0000-0000-0000-000000000001', 'Avaliação sintética', 60, 0, true),
  ('60000000-0000-0000-0000-000000000002', 'Procedimento sintético', 90, 15, false);
insert into public.professional_services values
  ('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002');
insert into public.availability (professional_id, weekday, starts, ends) values
  ('50000000-0000-0000-0000-000000000001', 1, '08:00', '12:00'),
  ('50000000-0000-0000-0000-000000000001', 1, '14:00', '16:00');
select pg_temp.logout();

-- Recepção não cadastra serviços
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$ insert into public.services (name, duration_minutes) values ('Serviço X', 30) $q$, 'row-level security');
select pg_temp.logout();

-- 1. Slots: 08:00–11:00 (4 de hora em hora? passo 15 → 08:00..11:00 = 13) + 14:00–15:00 (5) = 18
select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select pg_temp.assert(
  (select count(*) from public.available_slots('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', (select day from d))) = 18,
  'slots de 60 min com passo de 15 min');
select pg_temp.assert(
  (select min(starts_at) at time zone 'America/Sao_Paulo' from public.available_slots('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', (select day from d)))::time = '08:00',
  'primeiro horário às 08:00 no fuso da clínica');
select pg_temp.assert(
  (select count(*) from public.available_slots('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', (select day from d) + 1)) = 0,
  'terça sem disponibilidade');

-- 2. Paciente agenda pelo portal serviço com self_booking
select public.book_appointment('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001', ((select day from d) + time '09:00') at time zone 'America/Sao_Paulo');
select pg_temp.assert((select count(*) from public.appointments) = 1, 'paciente vê a própria consulta');
select pg_temp.assert((select source from public.appointments) = 'portal', 'origem forçada para portal');
select pg_temp.assert((select count(*) from public.notifications where kind = 'appointment.created') = 1, 'paciente notificado');
-- Horário fora da grade
select pg_temp.expect_error($q$ select public.book_appointment('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001', ((select day from d) + time '09:07') at time zone 'America/Sao_Paulo') $q$, 'indisponível');
-- Serviço que só a clínica agenda
select pg_temp.expect_error($q$ select public.book_appointment('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002', ((select day from d) + time '10:00') at time zone 'America/Sao_Paulo') $q$, 'agendado pela clínica');
-- Não agenda para outro paciente
select pg_temp.expect_error($q$ select public.book_appointment('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001', ((select day from d) + time '11:00') at time zone 'America/Sao_Paulo') $q$, 'permissão negada');
-- Escrita direta proibida
select pg_temp.expect_error($q$ insert into public.appointments (patient_id, professional_id, service_id, starts_at, ends_at, source)
  values ('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', now() + interval '30 days', now() + interval '30 days 1 hour', 'portal') $q$, 'permission denied');
select pg_temp.logout();

-- 3. Horário ocupado some dos slots; conflito barrado pelo banco
select pg_temp.login('00000000-0000-0000-0000-000000000002', 'aal1');
select pg_temp.assert(
  (select count(*) from public.available_slots('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', (select day from d))) = 11,
  'slots que sobrepõem 09:00–10:00 removidos (18 − 7)');
select pg_temp.assert((select count(*) from public.appointments) = 0, 'paciente 2 não vê consulta do paciente 1');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$ select public.book_appointment('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002', ((select day from d) + time '09:30') at time zone 'America/Sao_Paulo') $q$, 'indisponível');
-- Recepção agenda serviço clínico (fora do portal) em horário livre
select public.book_appointment('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000002', ((select day from d) + time '10:00') at time zone 'America/Sao_Paulo');
select pg_temp.assert((select count(*) from public.appointments) = 2, 'recepção vê a agenda');
-- Mesmo paciente em dois lugares ao mesmo tempo é bloqueado (outro profissional)
select pg_temp.expect_error($q$ insert into public.professionals (display_name) values ('Dr. Invasor') $q$, 'row-level security');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.professionals (id, display_name) values ('50000000-0000-0000-0000-000000000002', 'Dr. Sintético');
insert into public.professional_services values ('50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$ select public.book_appointment('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000001', ((select day from d) + time '10:30') at time zone 'America/Sao_Paulo') $q$, 'indisponível');

-- 4. Bloqueio (feriado da clínica) remove slots
insert into public.schedule_blocks (kind, starts_at, ends_at, reason) values
  ('holiday', ((select day from d) + time '14:00') at time zone 'America/Sao_Paulo', ((select day from d) + time '18:00') at time zone 'America/Sao_Paulo', 'Feriado sintético');
select pg_temp.assert(
  (select count(*) from public.available_slots('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', (select day from d))
    where (starts_at at time zone 'America/Sao_Paulo')::time >= '14:00') = 0, 'tarde bloqueada');

-- 5. Transições de status com histórico
select public.set_appointment_status((select id from public.appointments where patient_id = '10000000-0000-0000-0000-000000000002'), 'confirmed');
select pg_temp.expect_error($q$ select public.set_appointment_status((select id from public.appointments where patient_id = '10000000-0000-0000-0000-000000000002'), 'completed') $q$, 'não permitida');
select pg_temp.expect_error($q$ select public.set_appointment_status((select id from public.appointments where patient_id = '10000000-0000-0000-0000-000000000002'), 'cancelled') $q$, 'motivo');
select pg_temp.assert(
  (select count(*) from public.appointment_status_history h join public.appointments a on a.id = h.appointment_id
    where a.patient_id = '10000000-0000-0000-0000-000000000002') = 2, 'histórico de criação + confirmação');
select pg_temp.logout();

-- Financeiro lê agenda mas não altera
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select count(*) from public.appointments) = 2, 'financeiro lê a agenda');
select pg_temp.expect_error($q$ select public.set_appointment_status((select id from public.appointments where patient_id = '10000000-0000-0000-0000-000000000002'), 'no_show') $q$, 'permissão negada');
select pg_temp.logout();

-- 6. Lista de espera + oferta automática no cancelamento
select pg_temp.login('00000000-0000-0000-0000-000000000002', 'aal1');
select public.join_waiting_list('10000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', null, 'morning');
select pg_temp.expect_error($q$ select public.join_waiting_list('10000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001') $q$, 'já existe');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
-- Paciente cancela (antecedência ok) → vaga oferecida à lista
select public.set_appointment_status((select id from public.appointments), 'cancelled', 'Imprevisto sintético');
select pg_temp.logout();
select pg_temp.assert((select status from public.waiting_list) = 'offered', 'vaga oferecida automaticamente');
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'waitlist.offer'), 'oferta notificada');

-- Paciente 2 já tem consulta às 10:00 (sobreposição com 09:00–10:00? não) → aceita a vaga das 09:00
select pg_temp.login('00000000-0000-0000-0000-000000000002', 'aal1');
select public.accept_waitlist_offer((select id from public.waiting_list));
select pg_temp.assert((select count(*) from public.appointments where source = 'waitlist') = 1, 'consulta criada pela oferta');
select pg_temp.expect_error($q$ select public.accept_waitlist_offer((select id from public.waiting_list)) $q$, 'expirada');
select pg_temp.logout();
select pg_temp.assert((select status from public.waiting_list) = 'booked', 'entrada concluída');

-- 7. Cancelamento em cima da hora pelo portal é recusado
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.clinic_settings set value = '1000' where key = 'agenda.cancel_notice_hours';
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000002', 'aal1');
select pg_temp.expect_error($q$ select public.set_appointment_status((select id from public.appointments where source = 'waitlist'), 'cancelled', 'teste') $q$, 'em cima da hora');
select pg_temp.logout();

-- 7b. Remarcar pelo portal também respeita antecedência mínima e janela máxima
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
update public.clinic_settings set value = '0' where key = 'agenda.cancel_notice_hours';
update public.clinic_settings set value = '100000' where key = 'agenda.min_notice_hours';
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000002', 'aal1');
select pg_temp.expect_error($q$ select public.reschedule_appointment((select id from public.appointments where source = 'waitlist'), now() + interval '30 days') $q$, 'antecedência mínima');
select pg_temp.logout();

-- 8. Notificações: só as próprias; não pode criar
select pg_temp.login('00000000-0000-0000-0000-000000000002', 'aal1');
select pg_temp.assert((select count(*) from public.notifications where recipient_id <> '00000000-0000-0000-0000-000000000002') = 0, 'só as próprias notificações');
update public.notifications set read_at = now();
select pg_temp.expect_error($q$ update public.notifications set title = 'x' $q$, 'permission denied');
select pg_temp.expect_error($q$ insert into public.notifications (recipient_id, kind, title) values ('00000000-0000-0000-0000-000000000002', 'a.b', 'teste') $q$, 'permission denied');
select pg_temp.logout();

select 'OK: agenda da Fase 4 passou' as resultado;
