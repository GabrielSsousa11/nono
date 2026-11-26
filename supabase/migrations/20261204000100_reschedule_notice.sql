-- Remarcar pelo portal respeita as mesmas regras de agendar: antecedência mínima e janela máxima.
create or replace function public.reschedule_appointment(p_appointment uuid, p_new_start timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt  public.appointments;
  v_staff boolean := private.has_permission('agenda.write');
  v_duration integer;
begin
  select * into v_appt from public.appointments where id = p_appointment for update;
  if not found then
    raise exception 'consulta não encontrada' using errcode = 'P0002';
  end if;
  if v_appt.status not in ('scheduled', 'confirmed') then
    raise exception 'só consultas futuras ativas podem ser remarcadas' using errcode = '22023';
  end if;
  if not v_staff then
    if not private.can_self_schedule(v_appt.patient_id) then
      raise exception 'permissão negada' using errcode = '42501';
    end if;
    if v_appt.starts_at < now() + make_interval(hours => (private.setting('agenda.cancel_notice_hours', '24'))::int) then
      raise exception 'remarcação em cima da hora deve ser feita com a clínica' using errcode = '22023';
    end if;
    if p_new_start < now() + make_interval(hours => (private.setting('agenda.min_notice_hours', '2'))::int) then
      raise exception 'antecedência mínima não respeitada' using errcode = '22023';
    end if;
    if p_new_start > now() + make_interval(days => (private.setting('agenda.max_days_ahead', '90'))::int) then
      raise exception 'data além do período disponível' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.available_slots(v_appt.professional_id, v_appt.service_id,
                                           (p_new_start at time zone private.clinic_tz())::date) s
       where s.starts_at = p_new_start) then
      raise exception 'horário indisponível' using errcode = '23P01';
    end if;
  end if;
  select duration_minutes into v_duration from public.services where id = v_appt.service_id;
  perform set_config('cg.status_reason', 'remarcação', true);
  update public.appointments
     set starts_at = p_new_start, ends_at = p_new_start + make_interval(mins => v_duration), status = 'scheduled'
   where id = p_appointment;
  if v_appt.starts_at > now() and (private.setting('waitlist.auto_offer', 'true'))::boolean then
    perform private.offer_slot(v_appt.professional_id, v_appt.service_id, v_appt.starts_at);
  end if;
exception
  when exclusion_violation then
    raise exception 'horário indisponível' using errcode = '23P01';
end;
$$;
