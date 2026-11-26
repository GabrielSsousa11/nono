-- Testes da migration de fundação. Executar com scripts/db/test-migrations.sh
\set ON_ERROR_STOP on
create or replace function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'ESPERADO ERRO contendo "%" em: %', fragment, sql;
exception when others then
  if sqlerrm not like '%' || fragment || '%' then
    raise exception 'Erro inesperado: % (esperado "%")', sqlerrm, fragment;
  end if;
end $$;

-- 1. anon não lê pedidos de agendamento
set role anon;
select pg_temp.expect_error($q$ insert into public.booking_requests (full_name, phone_digits, consent_version) values ('Teste', '11999999999', 'v1') $q$, 'row-level security');
do $$ begin
  if (select count(*) from public.booking_requests) <> 0 then raise exception 'anon não deveria ver linhas'; end if;
end $$;

-- 2. anon cria pedido via RPC
select public.request_booking('Pessoa  Sintética', '(11) 99999-0000', 'A@B.COM', 'Avaliação', 'morning', 'oi', 'privacidade-2026-11');
reset role;
do $$ declare r record; begin
  select * into r from public.booking_requests limit 1;
  if r.full_name <> 'Pessoa Sintética' then raise exception 'nome não normalizado: %', r.full_name; end if;
  if r.phone_digits <> '11999990000' then raise exception 'telefone não normalizado: %', r.phone_digits; end if;
  if r.email <> 'a@b.com' then raise exception 'email não normalizado'; end if;
end $$;

-- 3. limite de 3 pedidos por telefone em 24h
set role anon;
select public.request_booking('Pessoa Sintética', '11999990000', null, null, 'any', null, 'v1');
select public.request_booking('Pessoa Sintética', '11999990000', null, null, 'any', null, 'v1');
select pg_temp.expect_error($q$ select public.request_booking('Pessoa Sintética', '11999990000', null, null, 'any', null, 'v1') $q$, 'rate_limited');

-- 4. validações
select pg_temp.expect_error($q$ select public.request_booking('Al', '11988887777', null, null, 'any', null, 'v1') $q$, 'check constraint');
select pg_temp.expect_error($q$ select public.request_booking('Alguém', '123', null, null, 'any', null, 'v1') $q$, 'check constraint');
select pg_temp.expect_error($q$ select public.request_booking('Alguém', '11988887777', 'invalido', null, 'any', null, 'v1') $q$, 'check constraint');
select pg_temp.expect_error($q$ select public.request_booking('Alguém', '11988887777', null, null, 'any', null, '') $q$, 'consent_required');

-- 5. anon não acessa schema private nem configurações
select pg_temp.expect_error($q$ select private.purge_expired_booking_requests() $q$, 'permission denied');
do $$ begin
  if (select count(*) from public.clinic_settings) <> 0 then raise exception 'clinic_settings visível'; end if;
  if (select count(*) from public.audit_logs) <> 0 then raise exception 'audit_logs visível'; end if;
end $$;
reset role;

-- 6. website_content: só publicado é público; publicação exige verificação
select pg_temp.expect_error($q$ insert into public.website_content (section, payload, published) values ('hero', '{}', true) $q$, 'published_requires_verification');
insert into public.website_content (section, payload, published, verified_at) values ('hero', '{"a":1}', true, now());
insert into public.website_content (section, payload, published, version) values ('hero', '{"a":2}', false, 2);
set role anon;
do $$ begin
  if (select count(*) from public.website_content) <> 1 then raise exception 'rascunho visível ao público'; end if;
end $$;
reset role;

-- 7. auditoria imutável
insert into public.audit_logs (action, entity_type) values ('test.action', 'test');
select pg_temp.expect_error($q$ update public.audit_logs set action = 'x' $q$, 'append-only');
select pg_temp.expect_error($q$ delete from public.audit_logs $q$, 'append-only');

-- 8. retenção remove pedidos vencidos não agendados
update public.booking_requests set retain_until = now() - interval '1 day';
do $$ begin
  if private.purge_expired_booking_requests() <> 3 then raise exception 'retenção não removeu 3 linhas'; end if;
end $$;

-- 9. toda tabela do schema public tem RLS
do $$ declare t text; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise exception 'Tabela sem RLS: %', t;
  end loop;
end $$;

select 'OK: todos os testes de banco passaram' as resultado;
