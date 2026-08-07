create or replace function private.is_observable_location(
  target_workspace_id uuid,
  target_hostname text,
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_allowed_domain(target_workspace_id, target_hostname)
    and not exists (
      select 1
      from public.privacy_exclusions as exclusion
      join public.allowed_domains as domain_rule
        on domain_rule.id = exclusion.allowed_domain_id
        and domain_rule.workspace_id = exclusion.workspace_id
      where exclusion.workspace_id = target_workspace_id
        and exclusion.is_enabled
        and domain_rule.is_enabled
        and (
          target_hostname = domain_rule.hostname
          or (
            domain_rule.include_subdomains
            and target_hostname like '%.' || domain_rule.hostname
          )
        )
        and target_path is not null
        and (
          target_path = rtrim(exclusion.path_prefix, '/')
          or target_path like rtrim(exclusion.path_prefix, '/') || '/%'
          or exclusion.path_prefix = '/'
        )
    );
$$;

create or replace function private.can_insert_raw_event(
  target_window_id uuid,
  target_workspace_id uuid,
  target_observer_id uuid,
  target_action_type text,
  target_hostname text,
  target_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_observer_id = (select auth.uid())
    and private.has_workspace_role(target_workspace_id, array['observer'])
    and exists (
      select 1
      from public.observation_windows as observation_window
      join public.observer_installations as installation
        on installation.id = observation_window.installation_id
        and installation.workspace_id = observation_window.workspace_id
        and installation.owner_id = observation_window.observer_id
      where observation_window.id = target_window_id
        and observation_window.workspace_id = target_workspace_id
        and observation_window.observer_id = target_observer_id
        and observation_window.status = 'active'
        and installation.revoked_at is null
    )
    and (
      (
        target_action_type = 'out_of_scope_gap'
        and target_hostname is null
        and target_path is null
      )
      or private.is_observable_location(
        target_workspace_id,
        target_hostname,
        target_path
      )
    );
$$;

drop policy raw_event_tokens_insert_owner on public.raw_event_tokens;

create policy raw_event_tokens_insert_owner
on public.raw_event_tokens for insert to authenticated
with check (
  (select private.can_insert_raw_event(
    observation_window_id,
    workspace_id,
    observer_id,
    action_type,
    hostname,
    normalized_path
  ))
);

revoke all on function private.can_insert_raw_event(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
drop function private.can_insert_raw_event(uuid, uuid, uuid, text, text);

create or replace function private.start_observation_window(
  target_window_id uuid,
  target_department_id uuid,
  target_job_role_id uuid,
  target_custom_role text
)
returns public.observation_windows
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  installation public.observer_installations;
  department_name text;
  role_name text;
  created_window public.observation_windows;
begin
  if current_user_id is null
    or not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_observer_required' using errcode = '42501';
  end if;

  select observer_installation.*
  into installation
  from public.observer_installations as observer_installation
  where observer_installation.owner_id = current_user_id
    and observer_installation.revoked_at is null
  limit 1;

  if not found
    or not private.has_workspace_role(installation.workspace_id, array['observer']) then
    raise exception 'active_installation_required' using errcode = '42501';
  end if;

  select department.name
  into department_name
  from public.departments as department
  where department.id = target_department_id
    and department.workspace_id = installation.workspace_id
    and department.is_active;

  if department_name is null then
    raise exception 'active_department_required' using errcode = '22023';
  end if;

  if (target_job_role_id is null) = (target_custom_role is null) then
    raise exception 'exactly_one_role_required' using errcode = '22023';
  end if;

  if target_job_role_id is not null then
    select job_role.name
    into role_name
    from public.job_roles as job_role
    where job_role.id = target_job_role_id
      and job_role.workspace_id = installation.workspace_id
      and job_role.department_id = target_department_id
      and job_role.is_active;

    if role_name is null then
      raise exception 'active_role_required' using errcode = '22023';
    end if;
  else
    role_name := btrim(target_custom_role);
    if char_length(role_name) not between 1 and 120 then
      raise exception 'invalid_custom_role' using errcode = '22023';
    end if;
  end if;

  insert into public.observation_windows (
    id,
    workspace_id,
    observer_id,
    installation_id,
    department_id,
    job_role_id,
    department_snapshot,
    role_snapshot,
    status,
    started_at
  )
  values (
    target_window_id,
    installation.workspace_id,
    current_user_id,
    installation.id,
    target_department_id,
    target_job_role_id,
    department_name,
    role_name,
    'active',
    now()
  )
  returning * into created_window;

  return created_window;
exception
  when unique_violation then
    raise exception 'observation_already_open' using errcode = '23505';
end;
$$;

create or replace function public.start_observation_window(
  target_window_id uuid,
  target_department_id uuid,
  target_job_role_id uuid default null,
  target_custom_role text default null
)
returns public.observation_windows
language sql
security invoker
set search_path = ''
as $$
  select private.start_observation_window(
    target_window_id,
    target_department_id,
    target_job_role_id,
    target_custom_role
  );
$$;

create or replace function private.transition_observation_window(
  target_window_id uuid,
  target_status text
)
returns public.observation_windows
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_window public.observation_windows;
  transitioned_window public.observation_windows;
begin
  if current_user_id is null
    or not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_observer_required' using errcode = '42501';
  end if;

  select observation_window.*
  into current_window
  from public.observation_windows as observation_window
  join public.observer_installations as installation
    on installation.id = observation_window.installation_id
    and installation.owner_id = observation_window.observer_id
    and installation.workspace_id = observation_window.workspace_id
  where observation_window.id = target_window_id
    and observation_window.observer_id = current_user_id
    and installation.revoked_at is null
  for update of observation_window;

  if not found then
    raise exception 'observation_not_found' using errcode = '42501';
  end if;

  if current_window.status = target_status then
    return current_window;
  end if;

  if not (
    (current_window.status = 'active' and target_status = 'paused')
    or (current_window.status = 'paused' and target_status = 'active')
    or (
      current_window.status in ('active', 'paused')
      and target_status in ('completed', 'cancelled')
    )
  ) then
    raise exception 'invalid_observation_transition' using errcode = '22023';
  end if;

  update public.observation_windows
  set
    status = target_status,
    paused_at = case when target_status = 'paused' then now() else null end,
    ended_at = case
      when target_status in ('completed', 'cancelled') then now()
      else null
    end
  where id = target_window_id
  returning * into transitioned_window;

  return transitioned_window;
end;
$$;

create or replace function public.transition_observation_window(
  target_window_id uuid,
  target_status text
)
returns public.observation_windows
language sql
security invoker
set search_path = ''
as $$
  select private.transition_observation_window(target_window_id, target_status);
$$;

revoke insert, update on public.observation_windows from authenticated;

revoke all on function private.is_observable_location(uuid, text, text)
  from public, anon, authenticated;
revoke all on function private.can_insert_raw_event(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function private.start_observation_window(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.transition_observation_window(uuid, text)
  from public, anon, authenticated;
revoke all on function public.start_observation_window(uuid, uuid, uuid, text)
  from public, anon;
revoke all on function public.transition_observation_window(uuid, text)
  from public, anon;

grant execute on function private.is_observable_location(uuid, text, text)
  to authenticated;
grant execute on function private.can_insert_raw_event(uuid, uuid, uuid, text, text, text)
  to authenticated;
grant execute on function private.start_observation_window(uuid, uuid, uuid, text)
  to authenticated;
grant execute on function private.transition_observation_window(uuid, text)
  to authenticated;
grant execute on function public.start_observation_window(uuid, uuid, uuid, text)
  to authenticated;
grant execute on function public.transition_observation_window(uuid, text)
  to authenticated;

comment on function public.start_observation_window(uuid, uuid, uuid, text) is
  'Starts one explicit observer-owned browser window using server-derived department and role snapshots.';
comment on function public.transition_observation_window(uuid, text) is
  'Applies an idempotent owner-only pause, resume, completion, or cancellation transition.';
