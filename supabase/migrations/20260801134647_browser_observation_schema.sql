create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  member_role text not null check (member_role in ('admin', 'analyst', 'observer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx
  on public.workspace_members (user_id, workspace_id);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create unique index departments_workspace_name_idx
  on public.departments (workspace_id, lower(name));

create index departments_workspace_id_idx
  on public.departments (workspace_id);

create table public.job_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  department_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, department_id, id)
);

create unique index job_roles_department_name_idx
  on public.job_roles (department_id, lower(name));

create index job_roles_workspace_department_idx
  on public.job_roles (workspace_id, department_id);

alter table public.job_roles
  add constraint job_roles_department_workspace_fkey
  foreign key (workspace_id, department_id)
  references public.departments (workspace_id, id)
  on delete cascade;

create table public.allowed_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  hostname text not null,
  include_subdomains boolean not null default false,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint allowed_domains_hostname_format check (
    char_length(hostname) between 1 and 253
    and hostname = lower(hostname)
    and hostname ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'
  ),
  unique (workspace_id, hostname)
);

create index allowed_domains_workspace_enabled_idx
  on public.allowed_domains (workspace_id, hostname)
  where is_enabled;

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users (id) on delete restrict,
  member_role text not null default 'observer' check (member_role = 'observer'),
  max_uses integer not null default 1 check (max_uses between 1 and 10000),
  use_count integer not null default 0 check (use_count between 0 and max_uses),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workspace_invites_future_expiration check (
    expires_at is null or expires_at > created_at
  )
);

create index workspace_invites_workspace_id_idx
  on public.workspace_invites (workspace_id);

create index workspace_invites_redeemable_idx
  on public.workspace_invites (code_hash)
  where revoked_at is null;

create table public.observer_installations (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (owner_id),
  unique (workspace_id, owner_id, id)
);

create index observer_installations_workspace_id_idx
  on public.observer_installations (workspace_id);

create table public.observation_windows (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  observer_id uuid not null references auth.users (id) on delete restrict,
  installation_id uuid not null,
  department_id uuid not null,
  job_role_id uuid,
  department_snapshot text not null
    check (char_length(btrim(department_snapshot)) between 1 and 120),
  role_snapshot text
    check (role_snapshot is null or char_length(btrim(role_snapshot)) between 1 and 120),
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'cancelled')),
  started_at timestamptz not null,
  paused_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observation_windows_installation_fkey
    foreign key (workspace_id, observer_id, installation_id)
    references public.observer_installations (workspace_id, owner_id, id)
    on delete restrict,
  constraint observation_windows_department_fkey
    foreign key (workspace_id, department_id)
    references public.departments (workspace_id, id)
    on delete restrict,
  constraint observation_windows_job_role_fkey
    foreign key (workspace_id, department_id, job_role_id)
    references public.job_roles (workspace_id, department_id, id)
    on delete restrict,
  constraint observation_windows_timeline check (
    (ended_at is null or ended_at >= started_at)
    and (paused_at is null or paused_at >= started_at)
    and (ended_at is null or paused_at is null or ended_at >= paused_at)
  ),
  constraint observation_windows_status_times check (
    (status = 'active' and paused_at is null and ended_at is null)
    or (status = 'paused' and paused_at is not null and ended_at is null)
    or (status in ('completed', 'cancelled') and ended_at is not null)
  ),
  unique (id, workspace_id, observer_id)
);

create unique index observation_windows_one_open_per_observer_idx
  on public.observation_windows (observer_id)
  where status in ('active', 'paused');

create index observation_windows_workspace_started_idx
  on public.observation_windows (workspace_id, started_at desc);

create index observation_windows_observer_started_idx
  on public.observation_windows (observer_id, started_at desc);

create table public.raw_event_tokens (
  id uuid primary key,
  observation_window_id uuid not null
    references public.observation_windows (id) on delete restrict,
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  observer_id uuid not null references auth.users (id) on delete restrict,
  sequence_no bigint not null check (sequence_no > 0),
  action_type text not null check (
    action_type in (
      'click',
      'input',
      'submit',
      'navigate',
      'spa_navigate',
      'hash_navigate',
      'tab_activate',
      'domain_transition',
      'file_upload',
      'file_download',
      'out_of_scope_gap'
    )
  ),
  hostname text,
  normalized_path text,
  element_role text check (
    element_role is null or char_length(element_role) between 1 and 64
  ),
  element_label text check (
    element_label is null or char_length(element_label) between 1 and 160
  ),
  page_landmark text check (
    page_landmark is null or char_length(page_landmark) between 1 and 160
  ),
  semantic_input_token text check (
    semantic_input_token is null
    or (
      char_length(semantic_input_token) between 3 and 64
      and semantic_input_token ~ '^\[[A-Z][A-Z0-9_]*(:[A-Z0-9_-]+)?\]$'
    )
  ),
  tab_id integer not null check (tab_id > 0),
  occurred_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  constraint raw_event_tokens_window_identity_fkey
    foreign key (observation_window_id, workspace_id, observer_id)
    references public.observation_windows (id, workspace_id, observer_id)
    on delete restrict,
  constraint raw_event_tokens_scope check (
    (
      action_type = 'out_of_scope_gap'
      and hostname is null
      and normalized_path is null
      and element_role is null
      and element_label is null
      and page_landmark is null
      and semantic_input_token is null
    )
    or (
      action_type <> 'out_of_scope_gap'
      and hostname is not null
    )
  ),
  constraint raw_event_tokens_hostname_format check (
    hostname is null
    or (
      char_length(hostname) between 1 and 253
      and hostname = lower(hostname)
      and hostname ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$'
    )
  ),
  constraint raw_event_tokens_path_format check (
    normalized_path is null
    or (
      char_length(normalized_path) between 1 and 512
      and normalized_path like '/%'
      and normalized_path !~ '[?#]'
    )
  ),
  unique (observation_window_id, sequence_no)
);

create index raw_event_tokens_workspace_ingested_idx
  on public.raw_event_tokens (workspace_id, ingested_at desc);

create index raw_event_tokens_observer_occurred_idx
  on public.raw_event_tokens (observer_id, occurred_at desc);

create table public.processing_jobs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  job_type text not null check (
    job_type in (
      'session_aggregation',
      'task_inference',
      'process_mining',
      'process_redesign',
      'process_export'
    )
  ),
  entity_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  locked_by text check (locked_by is null or char_length(locked_by) between 1 and 120),
  error_code text check (error_code is null or char_length(error_code) between 1 and 80),
  error_detail text check (error_detail is null or char_length(error_detail) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint processing_jobs_lock_state check (
    (status = 'running' and locked_at is not null and lock_token is not null and locked_by is not null)
    or (
      status <> 'running'
      and locked_at is null
      and lock_token is null
      and locked_by is null
    )
  )
);

create unique index processing_jobs_active_entity_idx
  on public.processing_jobs (workspace_id, job_type, entity_id)
  where status in ('queued', 'running');

create index processing_jobs_claim_idx
  on public.processing_jobs (available_at, created_at, id)
  where status = 'queued';

create index processing_jobs_workspace_status_idx
  on public.processing_jobs (workspace_id, status, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.has_workspace_role(
  target_workspace_id uuid,
  permitted_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.user_id = (select auth.uid())
      and (permitted_roles is null or member.member_role = any(permitted_roles))
  );
$$;

create or replace function private.is_allowed_domain(
  target_workspace_id uuid,
  target_hostname text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_domains as domain_rule
    where domain_rule.workspace_id = target_workspace_id
      and domain_rule.is_enabled
      and (
        target_hostname = domain_rule.hostname
        or (
          domain_rule.include_subdomains
          and target_hostname like '%.' || domain_rule.hostname
        )
      )
  );
$$;

create or replace function private.can_create_observation_window(
  target_workspace_id uuid,
  target_observer_id uuid,
  target_installation_id uuid,
  target_department_id uuid,
  target_job_role_id uuid
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
      from public.observer_installations as installation
      where installation.id = target_installation_id
        and installation.workspace_id = target_workspace_id
        and installation.owner_id = target_observer_id
        and installation.revoked_at is null
    )
    and exists (
      select 1
      from public.departments as department
      where department.id = target_department_id
        and department.workspace_id = target_workspace_id
        and department.is_active
    )
    and (
      target_job_role_id is null
      or exists (
        select 1
        from public.job_roles as job_role
        where job_role.id = target_job_role_id
          and job_role.workspace_id = target_workspace_id
          and job_role.department_id = target_department_id
          and job_role.is_active
      )
    );
$$;

create or replace function private.can_insert_raw_event(
  target_window_id uuid,
  target_workspace_id uuid,
  target_observer_id uuid,
  target_action_type text,
  target_hostname text
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
      (target_action_type = 'out_of_scope_gap' and target_hostname is null)
      or private.is_allowed_domain(target_workspace_id, target_hostname)
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

create or replace function public.create_workspace(workspace_name text)
returns public.workspaces
language sql
security invoker
set search_path = ''
as $$
  select private.create_workspace(workspace_name);
$$;

create or replace function private.redeem_workspace_invite(
  invite_code text,
  installation_id uuid
)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  invite_record public.workspace_invites;
  joined_workspace public.workspaces;
  normalized_hash text;
  existing_workspace_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;

  if not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_identity_required' using errcode = '42501';
  end if;

  if installation_id is null or char_length(invite_code) not between 8 and 128 then
    raise exception 'invalid_invite' using errcode = '22023';
  end if;

  normalized_hash := encode(
    extensions.digest(lower(btrim(invite_code)), 'sha256'),
    'hex'
  );

  select *
  into invite_record
  from public.workspace_invites
  where code_hash = normalized_hash
  for update;

  if not found then
    raise exception 'invalid_invite' using errcode = '22023';
  end if;

  select workspace_id
  into existing_workspace_id
  from public.observer_installations
  where owner_id = current_user_id;

  if existing_workspace_id is not null and existing_workspace_id <> invite_record.workspace_id then
    raise exception 'installation_already_joined' using errcode = '23505';
  end if;

  if existing_workspace_id is not null then
    if not exists (
      select 1
      from public.observer_installations
      where owner_id = current_user_id
        and id = installation_id
    ) then
      raise exception 'installation_identifier_mismatch' using errcode = '23505';
    end if;

    update public.observer_installations
    set last_seen_at = now()
    where owner_id = current_user_id;

    select *
    into joined_workspace
    from public.workspaces
    where id = invite_record.workspace_id;

    return joined_workspace;
  end if;

  if invite_record.revoked_at is not null
    or (invite_record.expires_at is not null and invite_record.expires_at <= now())
    or invite_record.use_count >= invite_record.max_uses then
    raise exception 'invalid_invite' using errcode = '22023';
  end if;

  insert into public.workspace_members (workspace_id, user_id, member_role)
  values (invite_record.workspace_id, current_user_id, invite_record.member_role)
  on conflict (workspace_id, user_id) do nothing;

  insert into public.observer_installations (id, workspace_id, owner_id)
  values (installation_id, invite_record.workspace_id, current_user_id);

  update public.workspace_invites
  set use_count = use_count + 1
  where id = invite_record.id;

  select *
  into joined_workspace
  from public.workspaces
  where id = invite_record.workspace_id;

  return joined_workspace;
end;
$$;

create or replace function public.join_workspace_by_invite(
  invite_code text,
  installation_id uuid
)
returns public.workspaces
language sql
security invoker
set search_path = ''
as $$
  select private.redeem_workspace_invite(invite_code, installation_id);
$$;

create or replace function public.claim_processing_jobs(
  worker_identifier text,
  requested_job_types text[],
  batch_size integer default 10
)
returns setof public.processing_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if worker_identifier is null
    or char_length(btrim(worker_identifier)) not between 1 and 120 then
    raise exception 'invalid_worker_identifier' using errcode = '22023';
  end if;

  if batch_size is null or batch_size not between 1 and 100 then
    raise exception 'invalid_batch_size' using errcode = '22023';
  end if;

  return query
  update public.processing_jobs as job
  set
    status = 'running',
    attempt_count = job.attempt_count + 1,
    locked_at = now(),
    lock_token = pg_catalog.gen_random_uuid(),
    locked_by = btrim(worker_identifier),
    updated_at = now()
  where job.id in (
    select candidate.id
    from public.processing_jobs as candidate
    where candidate.status = 'queued'
      and candidate.available_at <= now()
      and candidate.attempt_count < candidate.max_attempts
      and (
        requested_job_types is null
        or candidate.job_type = any(requested_job_types)
      )
    order by candidate.available_at, candidate.created_at, candidate.id
    limit batch_size
    for update skip locked
  )
  returning job.*;
end;
$$;

create or replace function private.enforce_observation_window_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if row(
    new.id,
    new.workspace_id,
    new.observer_id,
    new.installation_id,
    new.department_id,
    new.job_role_id,
    new.department_snapshot,
    new.role_snapshot,
    new.started_at,
    new.created_at
  ) is distinct from row(
    old.id,
    old.workspace_id,
    old.observer_id,
    old.installation_id,
    old.department_id,
    old.job_role_id,
    old.department_snapshot,
    old.role_snapshot,
    old.started_at,
    old.created_at
  ) then
    raise exception 'observation_identity_is_immutable' using errcode = '23000';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_installation_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if row(new.id, new.workspace_id, new.owner_id, new.joined_at)
    is distinct from row(old.id, old.workspace_id, old.owner_id, old.joined_at) then
    raise exception 'installation_identity_is_immutable' using errcode = '23000';
  end if;

  return new;
end;
$$;

create or replace function private.prevent_raw_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'raw_events_are_immutable' using errcode = '23000';
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function private.set_updated_at();

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function private.set_updated_at();

create trigger departments_set_updated_at
before update on public.departments
for each row execute function private.set_updated_at();

create trigger job_roles_set_updated_at
before update on public.job_roles
for each row execute function private.set_updated_at();

create trigger allowed_domains_set_updated_at
before update on public.allowed_domains
for each row execute function private.set_updated_at();

create trigger observation_windows_enforce_immutability
before update on public.observation_windows
for each row execute function private.enforce_observation_window_immutability();

create trigger observer_installations_enforce_immutability
before update on public.observer_installations
for each row execute function private.enforce_installation_immutability();

create trigger observation_windows_set_updated_at
before update on public.observation_windows
for each row execute function private.set_updated_at();

create trigger raw_event_tokens_prevent_update
before update on public.raw_event_tokens
for each row execute function private.prevent_raw_event_mutation();

create trigger raw_event_tokens_prevent_delete
before delete on public.raw_event_tokens
for each row execute function private.prevent_raw_event_mutation();

create trigger processing_jobs_set_updated_at
before update on public.processing_jobs
for each row execute function private.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.departments enable row level security;
alter table public.job_roles enable row level security;
alter table public.allowed_domains enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.observer_installations enable row level security;
alter table public.observation_windows enable row level security;
alter table public.raw_event_tokens enable row level security;
alter table public.processing_jobs enable row level security;

create policy workspaces_select_member
on public.workspaces for select to authenticated
using ((select private.has_workspace_role(id)));

create policy workspaces_update_admin
on public.workspaces for update to authenticated
using ((select private.has_workspace_role(id, array['admin'])))
with check ((select private.has_workspace_role(id, array['admin'])));

create policy workspace_members_select_visible
on public.workspace_members for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.has_workspace_role(workspace_id, array['admin', 'analyst']))
);

create policy workspace_members_insert_admin
on public.workspace_members for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy workspace_members_update_admin
on public.workspace_members for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])))
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy workspace_members_delete_admin
on public.workspace_members for delete to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy departments_select_member
on public.departments for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

create policy departments_insert_admin
on public.departments for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy departments_update_admin
on public.departments for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])))
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy departments_delete_admin
on public.departments for delete to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy job_roles_select_member
on public.job_roles for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

create policy job_roles_insert_admin
on public.job_roles for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy job_roles_update_admin
on public.job_roles for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])))
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy job_roles_delete_admin
on public.job_roles for delete to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy allowed_domains_select_member
on public.allowed_domains for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

create policy allowed_domains_insert_admin
on public.allowed_domains for insert to authenticated
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy allowed_domains_update_admin
on public.allowed_domains for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])))
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy allowed_domains_delete_admin
on public.allowed_domains for delete to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy workspace_invites_select_admin
on public.workspace_invites for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy workspace_invites_insert_admin
on public.workspace_invites for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.has_workspace_role(workspace_id, array['admin']))
);

create policy workspace_invites_update_admin
on public.workspace_invites for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])))
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy workspace_invites_delete_admin
on public.workspace_invites for delete to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy observer_installations_select_visible
on public.observer_installations for select to authenticated
using (
  owner_id = (select auth.uid())
  or (select private.has_workspace_role(workspace_id, array['admin', 'analyst']))
);

create policy observer_installations_update_admin
on public.observer_installations for update to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin'])))
with check ((select private.has_workspace_role(workspace_id, array['admin'])));

create policy observation_windows_select_visible
on public.observation_windows for select to authenticated
using (
  observer_id = (select auth.uid())
  or (select private.has_workspace_role(workspace_id, array['admin', 'analyst']))
);

create policy observation_windows_insert_owner
on public.observation_windows for insert to authenticated
with check (
  (select private.can_create_observation_window(
    workspace_id,
    observer_id,
    installation_id,
    department_id,
    job_role_id
  ))
);

create policy observation_windows_update_owner
on public.observation_windows for update to authenticated
using (observer_id = (select auth.uid()))
with check (observer_id = (select auth.uid()));

create policy raw_event_tokens_select_visible
on public.raw_event_tokens for select to authenticated
using (
  observer_id = (select auth.uid())
  or (select private.has_workspace_role(workspace_id, array['admin', 'analyst']))
);

create policy raw_event_tokens_insert_owner
on public.raw_event_tokens for insert to authenticated
with check (
  (select private.can_insert_raw_event(
    observation_window_id,
    workspace_id,
    observer_id,
    action_type,
    hostname
  ))
);

create policy processing_jobs_select_analyst
on public.processing_jobs for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));

revoke all on all tables in schema public from anon, authenticated;

grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;
grant select, insert, delete on public.workspace_members to authenticated;
grant update (member_role) on public.workspace_members to authenticated;
grant select, insert, delete on public.departments to authenticated;
grant update (name, is_active) on public.departments to authenticated;
grant select, insert, delete on public.job_roles to authenticated;
grant update (name, is_active) on public.job_roles to authenticated;
grant select, insert, delete on public.allowed_domains to authenticated;
grant update (hostname, include_subdomains, is_enabled) on public.allowed_domains to authenticated;
grant select, insert, delete on public.workspace_invites to authenticated;
grant update (max_uses, expires_at, revoked_at) on public.workspace_invites to authenticated;
grant select on public.observer_installations to authenticated;
grant update (revoked_at) on public.observer_installations to authenticated;
grant select, insert on public.observation_windows to authenticated;
grant update (status, paused_at, ended_at) on public.observation_windows to authenticated;
grant select, insert on public.raw_event_tokens to authenticated;
grant select on public.processing_jobs to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function public.create_workspace(text) from public, anon;
revoke all on function public.join_workspace_by_invite(text, uuid) from public, anon;
revoke all on function public.claim_processing_jobs(text, text[], integer) from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function private.is_allowed_domain(uuid, text) to authenticated;
grant execute on function private.can_create_observation_window(uuid, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function private.can_insert_raw_event(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function private.create_workspace(text) to authenticated;
grant execute on function private.redeem_workspace_invite(text, uuid) to authenticated;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.join_workspace_by_invite(text, uuid) to authenticated;
grant execute on function public.claim_processing_jobs(text, text[], integer) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'observation_windows'
  ) then
    alter publication supabase_realtime add table public.observation_windows;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'raw_event_tokens'
  ) then
    alter publication supabase_realtime add table public.raw_event_tokens;
  end if;
end;
$$;
