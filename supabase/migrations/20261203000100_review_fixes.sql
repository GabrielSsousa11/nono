-- Correções da revisão de código.

-- Uma conta de paciente já vinculada não pode ser trocada silenciosamente por outra
-- (a conta antiga manteria o papel `patient` sem vínculo). Troca exige revogar antes.
create or replace function public.link_patient_account(p_patient uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid;
begin
  if not private.has_permission('patients.invite') then
    raise exception 'permissão negada' using errcode = '42501';
  end if;
  if private.is_staff_member(p_user) then
    raise exception 'contas da equipe não podem ser vinculadas como paciente' using errcode = '22023';
  end if;
  select profile_id into v_current from public.patients where id = p_patient and archived_at is null;
  if not found then
    raise exception 'paciente não encontrado ou arquivado' using errcode = 'P0002';
  end if;
  if v_current is not null and v_current <> p_user then
    raise exception 'este paciente já está vinculado a outra conta' using errcode = '22023';
  end if;
  perform set_config('cg.allow_profile_link', 'on', true);
  update public.patients set profile_id = p_user where id = p_patient;
  insert into public.user_roles (user_id, role, granted_by) values (p_user, 'patient', (select auth.uid()))
  on conflict do nothing;
end;
$$;
