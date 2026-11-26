\set ON_ERROR_STOP on
create or replace function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute sql; exception when others then failed := true; msg := sqlerrm; end;
  if not failed then raise exception 'ESPERADO ERRO (%), mas o comando foi aceito: %', fragment, sql; end if;
  if msg not like '%' || fragment || '%' then raise exception 'Erro inesperado: % (esperado "%")', msg, fragment; end if;
end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FALHOU: %', msg; end if; end $$;

insert into public.clinic_settings (key, value) values
  ('push.dispatch_secret_sha256', to_jsonb(encode(extensions.digest('segredo-sintetico-de-teste-com-32-caracteres', 'sha256'), 'hex')));
insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth) values
  ('00000000-0000-0000-0000-000000000001', 'https://push.exemplo.invalid/abc', 'k', 'a');
update public.notifications set pushed_at = null;

set role anon;
select pg_temp.expect_error($q$ select * from public.claim_push_batch('errado-errado-errado-errado-errado-errado') $q$, 'não autorizado');
select pg_temp.expect_error($q$ select * from public.claim_push_batch(null) $q$, 'não autorizado');
select pg_temp.assert((select count(*) from public.claim_push_batch('segredo-sintetico-de-teste-com-32-caracteres')) >= 1, 'lote reservado com segredo correto');
select pg_temp.assert((select count(*) from public.claim_push_batch('segredo-sintetico-de-teste-com-32-caracteres')) = 0, 'cada aviso é reservado uma única vez');
select pg_temp.assert((select count(*) from public.push_subscriptions) = 0, 'anon não lê assinaturas');
select public.drop_push_subscription('segredo-sintetico-de-teste-com-32-caracteres', 'https://push.exemplo.invalid/abc');
reset role;
select pg_temp.assert((select count(*) from public.push_subscriptions) = 0, 'assinatura expirada removida');
select pg_temp.assert(exists (select 1 from public.audit_logs where entity_type = 'clinic_settings'), 'configurações auditadas');
select 'OK: push e ajustes passaram' as resultado;
