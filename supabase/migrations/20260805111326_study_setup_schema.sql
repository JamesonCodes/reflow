alter table public.allowed_domains
  add constraint allowed_domains_workspace_identity_key
  unique (workspace_id, id);

create table public.privacy_exclusions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  allowed_domain_id uuid not null,
  path_prefix text not null,
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 160),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privacy_exclusions_domain_fkey
    foreign key (workspace_id, allowed_domain_id)
    references public.allowed_domains (workspace_id, id)
    on delete cascade,
  constraint privacy_exclusions_path_format check (
    char_length(path_prefix) between 1 and 512
    and path_prefix like '/%'
    and path_prefix !~ '[?#]'
  ),
  unique (workspace_id, allowed_domain_id, path_prefix)
);

create index privacy_exclusions_workspace_enabled_idx
  on public.privacy_exclusions (workspace_id, allowed_domain_id, path_prefix)
  where is_enabled;

create table public.observer_profiles (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observer_id uuid not null references auth.users (id) on delete cascade,
  default_department_id uuid not null,
  default_job_role_id uuid,
  custom_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, observer_id),
  constraint observer_profiles_department_fkey
    foreign key (workspace_id, default_department_id)
    references public.departments (workspace_id, id)
    on delete restrict,
  constraint observer_profiles_job_role_fkey
    foreign key (workspace_id, default_department_id, default_job_role_id)
    references public.job_roles (workspace_id, department_id, id)
    on delete restrict,
  constraint observer_profiles_role_choice check (
    (
      default_job_role_id is not null
      and custom_role is null
    )
    or (
      default_job_role_id is null
      and custom_role is not null
      and char_length(btrim(custom_role)) between 1 and 120
    )
  )
);

create index observer_profiles_observer_id_idx
  on public.observer_profiles (observer_id, workspace_id);

create or replace function private.can_write_observer_profile(
  target_workspace_id uuid,
  target_observer_id uuid,
  target_department_id uuid,
  target_job_role_id uuid,
  target_custom_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_observer_id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
    and private.has_workspace_role(target_workspace_id, array['observer'])
    and exists (
      select 1
      from public.observer_installations as installation
      where installation.workspace_id = target_workspace_id
        and installation.owner_id = target_observer_id
        and installation.revoked_at is null
    )
    and exists (
      select 1
      from public.departments as department
      where department.workspace_id = target_workspace_id
        and department.id = target_department_id
        and department.is_active
    )
    and (
      (
        target_job_role_id is not null
        and target_custom_role is null
        and exists (
          select 1
          from public.job_roles as job_role
          where job_role.workspace_id = target_workspace_id
            and job_role.department_id = target_department_id
            and job_role.id = target_job_role_id
            and job_role.is_active
        )
      )
      or (
        target_job_role_id is null
        and char_length(btrim(target_custom_role)) between 1 and 120
      )
    );
$$;

create or replace function private.create_workspace(workspace_name text)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  created_workspace public.workspaces;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'permanent_identity_required' using errcode = '42501';
  end if;

  if not coalesce(
    ((select auth.jwt()) -> 'app_metadata' ->> 'reflow_admin')::boolean,
    false
  ) then
    raise exception 'administrator_allowlist_required' using errcode = '42501';
  end if;

  if char_length(btrim(workspace_name)) not between 1 and 120 then
    raise exception 'invalid_workspace_name' using errcode = '22023';
  end if;

  insert into public.workspaces (name, created_by)
  values (btrim(workspace_name), current_user_id)
  returning * into created_workspace;

  insert into public.workspace_members (workspace_id, user_id, member_role)
  values (created_workspace.id, current_user_id, 'admin');

  return created_workspace;
end;
$$;

create or replace function private.create_workspace_invite(
  target_workspace_id uuid,
  invite_max_uses integer,
  invite_expires_at timestamptz
)
returns table (invite_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  generated_code text;
  generated_invite_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
    or not private.has_workspace_role(target_workspace_id, array['admin']) then
    raise exception 'administrator_required' using errcode = '42501';
  end if;

  if invite_max_uses is null or invite_max_uses not between 1 and 10000 then
    raise exception 'invalid_invite_max_uses' using errcode = '22023';
  end if;

  if invite_expires_at is not null and invite_expires_at <= now() then
    raise exception 'invalid_invite_expiration' using errcode = '22023';
  end if;

  generated_code := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.workspace_invites (
    workspace_id,
    code_hash,
    created_by,
    max_uses,
    expires_at
  )
  values (
    target_workspace_id,
    encode(extensions.digest(generated_code, 'sha256'), 'hex'),
    current_user_id,
    invite_max_uses,
    invite_expires_at
  )
  returning id into generated_invite_id;

  return query select generated_invite_id, generated_code;
end;
$$;

create or replace function public.create_workspace_invite(
  target_workspace_id uuid,
  invite_max_uses integer default 1,
  invite_expires_at timestamptz default null
)
returns table (invite_id uuid, invite_code text)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.create_workspace_invite(
    target_workspace_id,
    invite_max_uses,
    invite_expires_at
  );
$$;

create trigger privacy_exclusions_set_updated_at
before update on public.privacy_exclusions
for each row execute function private.set_updated_at();

create trigger observer_profiles_set_updated_at
before update on public.observer_profiles
for each row execute function private.set_updated_at();

alter table public.privacy_exclusions enable row level security;
alter table public.observer_profiles enable row level security;

create policy privacy_exclusions_select_member
on public.privacy_exclusions for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

create policy privacy_exclusions_insert_admin
on public.privacy_exclusions for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy privacy_exclusions_update_admin
on public.privacy_exclusions for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])))
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy privacy_exclusions_delete_admin
on public.privacy_exclusions for delete to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy observer_profiles_select_visible
on public.observer_profiles for select to authenticated
using (
  observer_id = (select auth.uid())
  or (select private.has_workspace_role(workspace_id, array['admin', 'analyst']))
);

create policy observer_profiles_insert_owner
on public.observer_profiles for insert to authenticated
with check (
  (select private.can_write_observer_profile(
    workspace_id,
    observer_id,
    default_department_id,
    default_job_role_id,
    custom_role
  ))
);

create policy observer_profiles_update_owner
on public.observer_profiles for update to authenticated
using (observer_id = (select auth.uid()))
with check (
  (select private.can_write_observer_profile(
    workspace_id,
    observer_id,
    default_department_id,
    default_job_role_id,
    custom_role
  ))
);

revoke all on public.privacy_exclusions from anon, authenticated;
revoke all on public.observer_profiles from anon, authenticated;

grant select, insert, delete on public.privacy_exclusions to authenticated;
grant update (allowed_domain_id, path_prefix, reason, is_enabled)
  on public.privacy_exclusions to authenticated;
grant select, insert on public.observer_profiles to authenticated;
grant update (default_department_id, default_job_role_id, custom_role)
  on public.observer_profiles to authenticated;

grant all on public.privacy_exclusions to service_role;
grant all on public.observer_profiles to service_role;

revoke all on function private.can_write_observer_profile(uuid, uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function private.create_workspace_invite(uuid, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.create_workspace_invite(uuid, integer, timestamptz)
  from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.can_write_observer_profile(uuid, uuid, uuid, uuid, text)
  to authenticated;
grant execute on function private.create_workspace_invite(uuid, integer, timestamptz)
  to authenticated;
grant execute on function public.create_workspace_invite(uuid, integer, timestamptz)
  to authenticated;

comment on table public.privacy_exclusions is
  'Workspace rules that suppress observation on sensitive paths within approved domains.';
comment on column public.privacy_exclusions.id is
  'Stable UUID that identifies the privacy exclusion.';
comment on column public.privacy_exclusions.workspace_id is
  'Workspace that owns and enforces the privacy exclusion.';
comment on column public.privacy_exclusions.allowed_domain_id is
  'Approved domain to which the excluded path prefix belongs.';
comment on column public.privacy_exclusions.path_prefix is
  'Normalized path prefix on which browser observation must be suppressed.';
comment on column public.privacy_exclusions.reason is
  'Optional bounded administrator note explaining the exclusion.';
comment on column public.privacy_exclusions.is_enabled is
  'Whether the exclusion currently suppresses browser observation.';
comment on column public.privacy_exclusions.created_at is
  'Timestamp when the privacy exclusion was created.';
comment on column public.privacy_exclusions.updated_at is
  'Timestamp when the privacy exclusion was last changed.';

comment on table public.observer_profiles is
  'Current department and role defaults for anonymous browser observers.';
comment on column public.observer_profiles.workspace_id is
  'Workspace in which the observer defaults apply.';
comment on column public.observer_profiles.observer_id is
  'Anonymous Supabase Auth user that owns the defaults.';
comment on column public.observer_profiles.default_department_id is
  'Active department selected as the default for future observation windows.';
comment on column public.observer_profiles.default_job_role_id is
  'Optional active common job role selected instead of a custom role.';
comment on column public.observer_profiles.custom_role is
  'Optional observer-entered role used instead of a common job role.';
comment on column public.observer_profiles.created_at is
  'Timestamp when the observer defaults were first saved.';
comment on column public.observer_profiles.updated_at is
  'Timestamp when the observer defaults were last changed.';

comment on function public.create_workspace_invite(uuid, integer, timestamptz) is
  'Creates a hashed observer invite and returns its raw code exactly once to a workspace administrator.';
