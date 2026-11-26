-- =============================================================================
-- Migration 0007 — Disparo de Web Push sem service role + ajustes
-- =============================================================================

-- Auditoria de configurações (prometida na interface do CG Studio).
create trigger audit_clinic_settings after insert or update on public.clinic_settings
  for each row execute function private.audit_row_change();

-- O disparador (rota /api/push/dispatch) se autentica com um segredo de servidor;
-- o banco guarda apenas o SHA-256 dele em clinic_settings ('push.dispatch_secret_sha256').
create or replace function private.push_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select length(coalesce(p_secret, '')) >= 32
     and encode(extensions.digest(p_secret, 'sha256'), 'hex')
         = (select value #>> '{}' from public.clinic_settings where key = 'push.dispatch_secret_sha256');
$$;
revoke all on function private.push_secret_ok(text) from public;

-- Reserva um lote de avisos ainda não enviados por push (somente título e link — sem conteúdo clínico).
create or replace function public.claim_push_batch(p_secret text, p_limit integer default 100)
returns table (notification_id uuid, endpoint text, p256dh text, auth text, title text, link text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.push_secret_ok(p_secret) then
    raise exception 'não autorizado' using errcode = '42501';
  end if;
  return query
  with picked as (
    update public.notifications n set pushed_at = now()
     where n.id in (
       select id from public.notifications
        where pushed_at is null and created_at > now() - interval '24 hours'
        order by created_at limit least(greatest(p_limit, 1), 500)
        for update skip locked)
    returning n.id, n.recipient_id, n.title, n.link)
  select p.id, s.endpoint, s.p256dh, s.auth, p.title, p.link
    from picked p join public.push_subscriptions s on s.profile_id = p.recipient_id;
end;
$$;

create or replace function public.drop_push_subscription(p_secret text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.push_secret_ok(p_secret) then
    raise exception 'não autorizado' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
end;
$$;

revoke all on function public.claim_push_batch(text, integer) from public;
revoke all on function public.drop_push_subscription(text, text) from public;
grant execute on function public.claim_push_batch(text, integer) to anon, authenticated;
grant execute on function public.drop_push_subscription(text, text) to anon, authenticated;

-- Gestão de conteúdo: equipe com content.manage cria novas versões (append-only).
create policy "website_content: gestão cria versões" on public.website_content for insert to authenticated
  with check ((select private.has_permission('content.manage'))
              and (not published or (verified_by = (select auth.uid()) and verified_at is not null)));
revoke update, delete on public.website_content from anon, authenticated;
