-- =============================================================================
-- DADOS DE DEMONSTRAÇÃO — SOMENTE PARA APRESENTAÇÃO/HOMOLOGAÇÃO.
-- Nunca execute em um projeto com dados reais de pacientes.
--
-- Uso (Supabase → SQL Editor):
--   1. Crie duas contas em Authentication → Users → "Add user" (marque Auto Confirm):
--      uma para a administradora/dentista da demonstração e outra para a paciente.
--      Use e-mails que você consegue abrir (ex.: seuemail+admin@gmail.com).
--   2. Cole e execute este arquivo inteiro.
--   3. Execute: select private.seed_demo('email-da-admin', 'email-da-paciente');
-- Todos os nomes e dados abaixo são sintéticos e marcados como "(demo)".
-- =============================================================================

create or replace function private.seed_demo(p_admin_email text, p_patient_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin   uuid;
  v_patient_user uuid;
  v_pro     uuid := gen_random_uuid();
  v_eval    uuid := gen_random_uuid();
  v_clean   uuid := gen_random_uuid();
  v_white   uuid := gen_random_uuid();
  v_ortho   uuid := gen_random_uuid();
  v_p1      uuid := gen_random_uuid();
  v_p2      uuid := gen_random_uuid();
  v_p3      uuid := gen_random_uuid();
  v_plan    uuid := gen_random_uuid();
  v_proto   uuid := gen_random_uuid();
  v_tz      text := 'America/Sao_Paulo';
  v_today   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_appt    uuid;
  d         integer;
begin
  select id into v_admin from auth.users where lower(email) = lower(btrim(p_admin_email));
  select id into v_patient_user from auth.users where lower(email) = lower(btrim(p_patient_email));
  if v_admin is null or v_patient_user is null then
    raise exception 'Crie as duas contas em Authentication → Users antes de rodar a demonstração.';
  end if;
  if exists (select 1 from public.patients where full_name like '%(demo)%') then
    raise exception 'A demonstração já foi carregada neste projeto.';
  end if;

  -- Executa como a conta da dentista de demonstração (válido só nesta transação).
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'aal', 'aal2', 'role', 'authenticated')::text, true);

  insert into public.profiles (id, full_name) values (v_admin, 'Admin Demonstração') on conflict (id) do update set full_name = 'Admin Demonstração';
  insert into public.profiles (id, full_name) values (v_patient_user, 'Marina Exemplo (demo)') on conflict (id) do update set full_name = 'Marina Exemplo (demo)';
  insert into public.user_roles (user_id, role) values (v_admin, 'admin'), (v_admin, 'dentist') on conflict do nothing;

  -- Profissional, serviços e grade (segunda a sexta 08–12 e 13–18; sábado 08–12)
  insert into public.professionals (id, profile_id, display_name) values (v_pro, v_admin, 'Dra. Demonstração');
  insert into public.services (id, name, description, duration_minutes, buffer_minutes, price_cents, self_booking) values
    (v_eval, 'Avaliação inicial (demo)', 'Serviço de demonstração.', 60, 0, null, true),
    (v_clean, 'Limpeza e profilaxia (demo)', 'Serviço de demonstração.', 45, 15, 25000, true),
    (v_white, 'Clareamento (demo)', 'Serviço de demonstração.', 90, 15, 120000, false),
    (v_ortho, 'Manutenção ortodôntica (demo)', 'Serviço de demonstração.', 30, 0, 18000, true);
  insert into public.professional_services select v_pro, unnest(array[v_eval, v_clean, v_white, v_ortho]);
  insert into public.availability (professional_id, weekday, starts, ends)
  select v_pro, wd, t.s, t.e from generate_series(1, 5) wd, (values ('08:00'::time, '12:00'::time), ('13:00', '18:00')) t(s, e)
  union all select v_pro, 6, '08:00', '12:00';

  -- Pacientes sintéticos (a primeira é a conta de demonstração do portal; a terceira é menor de idade)
  insert into public.patients (id, profile_id, full_name, birth_date, phone, email, responsible_professional_id) values
    (v_p1, v_patient_user, 'Marina Exemplo (demo)', '1991-04-12', '11900000001', lower(p_patient_email), v_pro),
    (v_p2, null, 'Rafael Modelo (demo)', '1985-09-30', '11900000002', null, v_pro),
    (v_p3, null, 'Lia Exemplo (demo)', (v_today - interval '9 years')::date, null, null, v_pro);
  insert into public.user_roles (user_id, role) values (v_patient_user, 'patient'), (v_patient_user, 'guardian') on conflict do nothing;
  insert into public.patient_guardians (patient_id, guardian_profile_id, guardian_name, relationship, legal_basis, can_view_clinical, evidence_note)
  values (v_p3, v_patient_user, 'Marina Exemplo (demo)', 'mother', 'parental_authority', true, 'Documento sintético de demonstração');

  insert into public.consents (patient_id, kind, version, granted, method, recorded_by) values
    (v_p1, 'privacy_policy', 'demo', true, 'in_person', v_admin),
    (v_p1, 'treatment', 'demo', true, 'signed_document', v_admin),
    (v_p1, 'clinical_photos', 'demo', true, 'signed_document', v_admin),
    (v_p1, 'communications_email', 'demo', true, 'in_person', v_admin);

  -- Consultas: passadas concluídas, hoje e futuras
  for d in 1..6 loop
    insert into public.appointments (patient_id, professional_id, service_id, starts_at, ends_at, status, source, created_by)
    values (case when d % 2 = 0 then v_p1 else v_p2 end, v_pro, v_clean,
            ((v_today - d * 14) + time '09:00') at time zone v_tz, ((v_today - d * 14) + time '09:45') at time zone v_tz,
            (case when d = 3 then 'no_show' else 'completed' end)::public.appointment_status, 'studio', v_admin);
  end loop;
  insert into public.appointments (patient_id, professional_id, service_id, starts_at, ends_at, status, source, created_by) values
    (v_p1, v_pro, v_ortho, (v_today + time '17:00') at time zone v_tz, (v_today + time '17:30') at time zone v_tz, 'confirmed', 'studio', v_admin),
    (v_p2, v_pro, v_white, ((v_today + 3) + time '10:00') at time zone v_tz, ((v_today + 3) + time '11:30') at time zone v_tz, 'scheduled', 'studio', v_admin),
    (v_p3, v_pro, v_eval, ((v_today + 5) + time '14:00') at time zone v_tz, ((v_today + 5) + time '15:00') at time zone v_tz, 'scheduled', 'portal', v_patient_user);
  select id into v_appt from public.appointments where patient_id = v_p1 and status = 'completed' order by starts_at desc limit 1;

  -- Prontuário, odontograma e jornada
  insert into public.dental_charts (patient_id, dentition) values (v_p1, 'permanent'), (v_p3, 'mixed');
  insert into public.clinical_records (patient_id, professional_id, kind, content, visible_to_patient, recorded_by, appointment_id) values
    (v_p1, v_pro, 'anamnesis', 'Registro sintético de anamnese para demonstração.', false, v_admin, v_appt),
    (v_p1, v_pro, 'note', 'Orientação sintética liberada ao paciente: manter o uso do fio dental diariamente.', true, v_admin, v_appt);
  insert into public.tooth_records (patient_id, tooth_fdi, surfaces, state, procedure, performed_on, professional_id, recorded_by) values
    (v_p1, 16, '{O}', 'completed', 'Restauração em resina (demo)', v_today - 28, v_pro, v_admin),
    (v_p1, 26, '{O,M}', 'completed', 'Restauração em resina (demo)', v_today - 56, v_pro, v_admin),
    (v_p1, 36, '{O}', 'planned', 'Restauração planejada (demo)', null, v_pro, v_admin),
    (v_p1, 11, '{}', 'planned', 'Clareamento (demo)', null, v_pro, v_admin),
    (v_p1, 21, '{}', 'planned', 'Clareamento (demo)', null, v_pro, v_admin),
    (v_p1, 48, '{}', 'observation', 'Terceiro molar em observação (demo)', null, v_pro, v_admin);
  insert into public.treatment_plans (id, patient_id, title, goals, status, professional_id, estimated_end, created_by) values
    (v_plan, v_p1, 'Plano de demonstração', 'Objetivos sintéticos: restaurar dentes posteriores e clarear os anteriores.', 'active', v_pro, v_today + 60, v_admin);
  insert into public.treatment_stages (plan_id, patient_id, position, title, description, guidance, status, estimated_date, completed_at) values
    (v_plan, v_p1, 1, 'Avaliação e plano', 'Etapa sintética.', null, 'completed', v_today - 60, now() - interval '60 days'),
    (v_plan, v_p1, 2, 'Restaurações posteriores', 'Etapa sintética.', 'Evite alimentos muito duros nas primeiras 24 horas (texto de demonstração).', 'completed', v_today - 28, now() - interval '28 days'),
    (v_plan, v_p1, 3, 'Restauração do dente 36', 'Etapa sintética.', null, 'scheduled', v_today + 10, null),
    (v_plan, v_p1, 4, 'Clareamento', 'Etapa sintética.', 'Orientações sintéticas sobre sensibilidade.', 'pending', v_today + 40, null);

  -- CG Daily: metas e 20 dias de histórico (com alguns dias incompletos)
  insert into public.habit_goals (patient_id, brushing_per_day, flossing_per_day, brushing_seconds, set_by) values (v_p1, 2, 1, 120, v_admin), (v_p3, 2, 0, 120, v_admin);
  insert into public.brushing_logs (patient_id, kind, local_date, logged_at, guided_seconds)
  select v_p1, k, dd, (dd + time '08:00') at time zone v_tz, case when k = 'brushing' then 120 end
    from generate_series(v_today - 20, v_today - 1, interval '1 day') g(dd0), lateral (select dd0::date as dd) x,
         unnest(array['brushing', 'brushing', 'flossing']::public.habit_kind[]) k
   where not (extract(day from dd0)::int % 9 = 0 and k = 'flossing');
  insert into public.patient_achievements (patient_id, achievement_key) values (v_p1, 'first_log'), (v_p1, 'goal_day'), (v_p1, 'streak_7'), (v_p1, 'guided_10') on conflict do nothing;
  insert into public.patient_missions (patient_id, mission_key) values (v_p1, 'tecnica_escovacao'), (v_p1, 'fio_dental');

  -- CG Care
  insert into public.care_protocols (id, kind, title, body, default_interval_days, approved_by, approved_at) values
    (v_proto, 'orthodontic', 'Manutenção do aparelho (demo)', 'Texto sintético de demonstração. As orientações reais devem ser escritas e aprovadas pela dentista responsável.', 30, v_admin, now());
  insert into public.care_reminders (patient_id, protocol_id, personal_note, interval_days, next_due_on, created_by)
  values (v_p1, v_proto, 'Nota sintética personalizada.', 30, v_today + 12, v_admin);
  insert into public.patient_messages (patient_id, author_id, from_staff, body) values
    (v_p1, v_patient_user, false, 'Mensagem sintética: posso remarcar minha manutenção?'),
    (v_p1, v_admin, true, 'Resposta sintética: claro! Você pode remarcar pelo portal em Consultas.');

  -- Pedidos do site, lista de espera, financeiro e pesquisas
  insert into public.booking_requests (full_name, phone_digits, preferred_period, consent_version, message) values
    ('Pedido Sintético (demo)', '11900000009', 'morning', 'demo', 'Mensagem sintética de pedido.');
  insert into public.waiting_list (patient_id, service_id, preferred_period, created_by) values (v_p2, v_clean, 'morning', v_admin);
  insert into public.invoices (id, patient_id, description, amount_cents, due_date, created_by) values
    (gen_random_uuid(), v_p1, 'Restaurações (demo)', 60000, v_today - 20, v_admin),
    (gen_random_uuid(), v_p2, 'Limpeza (demo)', 25000, v_today + 5, v_admin);
  insert into public.payments (invoice_id, amount_cents, paid_on, method, recorded_by)
  select id, 60000, v_today - 18, 'pix', v_admin from public.invoices where description = 'Restaurações (demo)';
  insert into public.expenses (description, category, amount_cents, due_date, paid_on, recorded_by) values
    ('Materiais (demo)', 'Materiais', 32000, v_today - 15, v_today - 15, v_admin),
    ('Aluguel (demo)', 'Estrutura', 150000, v_today + 10, null, v_admin);
  insert into public.satisfaction_surveys (appointment_id, patient_id, score, comment, answered_at)
  select id, patient_id, 9 + (row_number() over () % 2)::int, null, ends_at + interval '1 day'
    from public.appointments where status = 'completed' and patient_id in (v_p1, v_p2)
  on conflict (appointment_id) do nothing;

  perform private.schedule_automations();
  perform private.run_automation_jobs(100);
  return 'Demonstração carregada. Entre com os e-mails informados.';
end;
$$;
revoke all on function private.seed_demo(text, text) from public, anon, authenticated;
