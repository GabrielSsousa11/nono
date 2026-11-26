-- A demonstração precisa carregar sem erros sobre todas as migrations.
\set ON_ERROR_STOP on
\i supabase/seed/demo.sql
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'demo-admin@teste.invalid'), ('00000000-0000-0000-0000-0000000000a2', 'demo-paciente@teste.invalid');
select private.seed_demo('demo-admin@teste.invalid', 'demo-paciente@teste.invalid');
do $$ begin
  if (select count(*) from public.patients where full_name like '%(demo)%') <> 3 then raise exception 'pacientes demo'; end if;
  if (select count(*) from public.appointments a join public.patients p on p.id = a.patient_id where p.full_name like '%(demo)%') < 9 then raise exception 'consultas demo'; end if;
end $$;
select 'OK: dados de demonstração carregam' as resultado;
