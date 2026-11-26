-- Matriz de acesso da Fase 3. Executar com scripts/db/test-migrations.sh
\set ON_ERROR_STOP on

create or replace function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
declare
  failed boolean := false;
  msg text;
begin
  begin
    execute sql;
  exception when others then
    failed := true;
    msg := sqlerrm;
  end;
  if not failed then
    raise exception 'ESPERADO ERRO (%), mas o comando foi aceito: %', fragment, sql;
  end if;
  if msg not like '%' || fragment || '%' then
    raise exception 'Erro inesperado: % (esperado "%") em: %', msg, fragment, sql;
  end if;
end $$;

create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FALHOU: %', msg; end if;
end $$;

-- Usuários sintéticos
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@teste.invalid', '{"full_name":"Admin Teste"}'),
  ('00000000-0000-0000-0000-00000000000d', 'dentista@teste.invalid', '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'recepcao@teste.invalid', '{}'),
  ('00000000-0000-0000-0000-00000000000f', 'financeiro@teste.invalid', '{}'),
  ('00000000-0000-0000-0000-000000000001', 'paciente1@teste.invalid', '{}'),
  ('00000000-0000-0000-0000-000000000002', 'paciente2@teste.invalid', '{}'),
  ('00000000-0000-0000-0000-000000000009', 'responsavel@teste.invalid', '{}'),
  ('00000000-0000-0000-0000-000000000099', 'estranho@teste.invalid', '{}');

select pg_temp.assert((select count(*) from public.profiles) = 8, 'perfis criados pelo gatilho de auth.users');
select pg_temp.assert((select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Admin Teste', 'nome vindo do metadata');

select pg_temp.assert((select email from public.profiles where id = '00000000-0000-0000-0000-00000000000d') = 'dentista@teste.invalid', 'e-mail copiado para o perfil');
update auth.users set email = 'Dentista2@teste.invalid' where id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.assert((select email from public.profiles where id = '00000000-0000-0000-0000-00000000000d') = 'dentista2@teste.invalid', 'troca de e-mail sincronizada');

select private.bootstrap_admin('ADMIN@teste.invalid');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000000d', 'dentist'),
  ('00000000-0000-0000-0000-00000000000e', 'receptionist'),
  ('00000000-0000-0000-0000-00000000000f', 'finance');

-- Sessões: muda papel do Postgres e as claims do JWT.
create or replace function pg_temp.login(p_user uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'aal', p_aal)::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;

-- Dados: dois pacientes e um responsável (como superusuário, simulando cadastro inicial).
insert into public.patients (id, full_name, birth_date, phone) values
  ('10000000-0000-0000-0000-000000000001', 'Paciente Um', '2015-05-01', '11999990001'),
  ('10000000-0000-0000-0000-000000000002', 'Paciente Dois', '1990-01-01', '11999990002');

-- ---------------------------------------------------------------------------
-- 1. Sem MFA (aal1) a equipe não tem permissão nenhuma
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000d', 'aal1');
select pg_temp.assert((select count(*) from public.patients) = 0, 'dentista sem MFA não lê pacientes');
select pg_temp.assert(not ((public.my_access()) ->> 'mfa_verified')::boolean, 'my_access indica MFA pendente');
select pg_temp.assert(jsonb_array_length(public.my_access() -> 'permissions') = 0, 'sem permissões efetivas sem MFA');
select pg_temp.assert((public.my_access() ->> 'is_staff')::boolean, 'continua identificado como equipe');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 2. Leitura de cadastro por papel (com MFA)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.patients) = 2, 'admin lê pacientes');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.patients) = 2, 'dentista lê pacientes');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.patients) = 2, 'recepção lê pacientes');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select count(*) from public.patients) = 2, 'financeiro lê cadastro');
select pg_temp.expect_error($q$ insert into public.patients (full_name) values ('Novo Paciente') $q$, 'row-level security');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-000000000099');
select pg_temp.assert((select count(*) from public.patients) = 0, 'estranho não vê pacientes');
select pg_temp.assert((select count(*) from public.profiles) = 1, 'estranho vê apenas o próprio perfil');
update public.profiles set full_name = 'Nome Novo', phone = '11977776666';
select pg_temp.assert((select full_name from public.profiles) = 'Nome Novo', 'edita o próprio nome');
select pg_temp.expect_error($q$ update public.profiles set email = 'x@y.com' $q$, 'permission denied');
select pg_temp.logout();
set role anon;
select pg_temp.assert((select count(*) from public.patients) = 0, 'anon não vê pacientes');
select pg_temp.expect_error($q$ select public.my_access() $q$, 'permission denied');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Recepção e financeiro não têm permissão clínica
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert(not private.has_permission('clinical.read'), 'recepção sem clinical.read');
select pg_temp.assert(private.has_permission('booking_requests.manage'), 'recepção trata pedidos');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert(not private.has_permission('clinical.read'), 'financeiro sem clinical.read');
select pg_temp.assert(not private.has_permission('booking_requests.manage'), 'financeiro não trata pedidos');
select pg_temp.assert(private.has_permission('finance.write'), 'financeiro com finance.write');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert(private.has_permission('clinical.write'), 'dentista com clinical.write');
select pg_temp.assert(not private.has_permission('finance.read'), 'dentista sem financeiro');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 4. Cadastro e vínculo de conta do paciente
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into public.patients (full_name, phone) values ('Paciente Três', '11999990003');
select pg_temp.expect_error($q$ insert into public.patients (full_name, profile_id) values ('Invasor', '00000000-0000-0000-0000-000000000099') $q$, 'row-level security');
select pg_temp.expect_error($q$ update public.patients set profile_id = '00000000-0000-0000-0000-000000000001' where id = '10000000-0000-0000-0000-000000000001' $q$, 'link_patient_account');
select public.link_patient_account('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001');
select public.link_patient_account('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($q$ select public.link_patient_account('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d') $q$, 'equipe');
select pg_temp.expect_error($q$ select public.link_patient_account('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000099') $q$, 'já está vinculado');
select public.link_patient_account('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
select pg_temp.expect_error($q$ delete from public.patients $q$, 'permission denied');
select pg_temp.expect_error($q$ truncate public.booking_requests $q$, 'permission denied');
select pg_temp.logout();

select pg_temp.assert(exists (select 1 from public.user_roles where user_id = '00000000-0000-0000-0000-000000000001' and role = 'patient'), 'papel patient concedido');

-- Paciente vê só o próprio cadastro
select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select pg_temp.assert((select count(*) from public.patients) = 1, 'paciente vê apenas o próprio cadastro');
select pg_temp.assert((select full_name from public.patients) = 'Paciente Um', 'é o cadastro certo');
update public.patients set full_name = 'Outro Nome'; -- RLS: nenhuma linha afetada
select pg_temp.logout();
select pg_temp.assert((select full_name from public.patients where id = '10000000-0000-0000-0000-000000000001') = 'Paciente Um', 'paciente não altera o cadastro');

-- ---------------------------------------------------------------------------
-- 5. Responsável legal
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into public.patient_guardians (id, patient_id, guardian_name, relationship, legal_basis)
  values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Responsável Teste', 'mother', 'parental_authority');
select public.link_guardian_account('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009');
select pg_temp.expect_error($q$ select public.link_guardian_account('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099') $q$, 'já ligado');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-000000000009', 'aal1');
select pg_temp.assert((select count(*) from public.patients) = 1, 'responsável vê o dependente');
select pg_temp.assert(not private.is_guardian_of('10000000-0000-0000-0000-000000000001', true), 'sem acesso clínico por padrão');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select pg_temp.assert((select count(*) from public.patient_guardians) = 1, 'paciente vê seus responsáveis');
select pg_temp.logout();

-- Financeiro não pode revogar; recepção revoga com motivo
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.expect_error($q$ select public.revoke_guardian('20000000-0000-0000-0000-000000000001', 'teste') $q$, 'permissão negada');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$ select public.revoke_guardian('20000000-0000-0000-0000-000000000001', '') $q$, 'motivo');
select public.revoke_guardian('20000000-0000-0000-0000-000000000001', 'Maioridade atingida');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-000000000009', 'aal1');
select pg_temp.assert((select count(*) from public.patients) = 0, 'acesso do responsável revogado');
select pg_temp.logout();
select pg_temp.assert(not exists (select 1 from public.user_roles where user_id = '00000000-0000-0000-0000-000000000009'), 'papel guardian removido sem vínculos');

-- ---------------------------------------------------------------------------
-- 6. Consentimentos
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000001', 'aal1');
select public.set_my_consent('10000000-0000-0000-0000-000000000001', 'communications_email', true, 'v1');
select public.set_my_consent('10000000-0000-0000-0000-000000000001', 'communications_email', true, 'v1');
select pg_temp.assert((select count(*) from public.consents where revoked_at is null and granted) = 1, 'um consentimento ativo por tipo');
select public.set_my_consent('10000000-0000-0000-0000-000000000001', 'communications_email', false, 'v1');
select pg_temp.assert((select count(*) from public.consents where revoked_at is null and granted) = 0, 'revogação pelo titular');
select pg_temp.expect_error($q$ select public.set_my_consent('10000000-0000-0000-0000-000000000001', 'photo_publicity', true, 'v1') $q$, 'presencial');
select pg_temp.expect_error($q$ select public.set_my_consent('10000000-0000-0000-0000-000000000002', 'communications_email', true, 'v1') $q$, 'permissão negada');
select pg_temp.expect_error($q$ insert into public.consents (patient_id, kind, version, granted, method) values ('10000000-0000-0000-0000-000000000001', 'treatment', 'v1', true, 'portal') $q$, 'row-level security');
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.record_consent('10000000-0000-0000-0000-000000000002', 'treatment', 'termo-v1', true, 'signed_document');
select pg_temp.expect_error($q$ select public.record_consent('10000000-0000-0000-0000-000000000002', 'treatment', 'v1', true, 'portal') $q$, 'titular');
select pg_temp.logout();
select pg_temp.expect_error($q$ delete from public.consents $q$, 'não podem ser apagados');
select pg_temp.expect_error($q$ update public.consents set granted = false where kind = 'treatment' $q$, 'nunca reescrito');

-- ---------------------------------------------------------------------------
-- 7. Papéis da equipe
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$ select public.grant_role('00000000-0000-0000-0000-000000000099', 'admin') $q$, 'permissão negada');
select pg_temp.expect_error($q$ select public.record_admin_event('staff.mfa_reset', '00000000-0000-0000-0000-00000000000d') $q$, 'permissão negada');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'aal1');
select pg_temp.expect_error($q$ select public.grant_role('00000000-0000-0000-0000-000000000099', 'dentist') $q$, 'permissão negada');
select pg_temp.logout();
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.grant_role('00000000-0000-0000-0000-000000000099', 'dentist');
select pg_temp.expect_error($q$ select public.grant_role('00000000-0000-0000-0000-000000000099', 'patient') $q$, 'vínculo');
select public.revoke_role('00000000-0000-0000-0000-000000000099', 'dentist');
select pg_temp.expect_error($q$ select public.revoke_role('00000000-0000-0000-0000-00000000000a', 'admin') $q$, 'próprio');
select pg_temp.expect_error($q$ insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-000000000099', 'admin') $q$, 'row-level security');
select pg_temp.assert((select count(*) from public.profiles) = 8, 'admin vê todos os perfis');
select public.record_admin_event('staff.mfa_reset', '00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error($q$ select public.record_admin_event('qualquer.coisa', '00000000-0000-0000-0000-00000000000d') $q$, 'não reconhecida');
select pg_temp.logout();

-- ---------------------------------------------------------------------------
-- 8. Pedidos de agendamento e auditoria
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.audit_logs) = 0, 'recepção não lê auditoria');
update public.patients set phone = '11988887777' where id = '10000000-0000-0000-0000-000000000002';
select pg_temp.logout();

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert(
  (select metadata -> 'columns' from public.audit_logs
    where entity_type = 'patients' and action = 'update' order by id desc limit 1) = '["phone"]'::jsonb,
  'auditoria registra colunas alteradas');
select pg_temp.assert(
  not exists (select 1 from public.audit_logs where metadata::text like '%11988887777%'),
  'auditoria não guarda valores pessoais');
select pg_temp.assert(
  exists (select 1 from public.audit_logs where entity_type = 'user_roles' and action = 'delete'
          and actor_id = '00000000-0000-0000-0000-00000000000a'),
  'revogação de papel auditada com autor');
select pg_temp.logout();

select 'OK: matriz de acesso da Fase 3 passou' as resultado;
