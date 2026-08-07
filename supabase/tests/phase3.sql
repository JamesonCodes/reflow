begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_anonymous
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'phase3-admin@reflow.invalid',
    '',
    '{}',
    '{}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    null,
    '',
    '{}',
    '{}',
    now(),
    now(),
    true
  );

insert into public.workspaces (id, name, created_by)
values (
  'a2000000-0000-4000-8000-000000000001',
  'Phase 3 Workspace',
  'a1000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, member_role)
values
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'admin'
  ),
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'observer'
  );

insert into public.departments (id, workspace_id, name)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'Accounts Payable'
);

insert into public.job_roles (id, workspace_id, department_id, name)
values (
  'a4000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'Invoice analyst'
);

insert into public.allowed_domains (
  id,
  workspace_id,
  hostname,
  include_subdomains
)
values (
  'a5000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'localhost',
  true
);

insert into public.privacy_exclusions (
  workspace_id,
  allowed_domain_id,
  path_prefix
)
values (
  'a2000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  '/private'
);

insert into public.observer_installations (id, workspace_id, owner_id)
values (
  'a6000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',
  true
);

select public.start_observation_window(
  'a7000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  null
);

do $$
begin
  if not exists (
    select 1
    from public.observation_windows
    where id = 'a7000000-0000-4000-8000-000000000001'
      and department_snapshot = 'Accounts Payable'
      and role_snapshot = 'Invoice analyst'
      and status = 'active'
  ) then
    raise exception 'server-derived observation snapshots were not stored';
  end if;

  begin
    perform public.start_observation_window(
      'a7000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000001',
      null,
      'Payment specialist'
    );
    raise exception 'second open observation unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when unique_violation then null;
  end;
end;
$$;

insert into public.raw_event_tokens (
  id,
  observation_window_id,
  workspace_id,
  observer_id,
  sequence_no,
  action_type,
  hostname,
  normalized_path,
  tab_id,
  occurred_at
)
values (
  'a8000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  1,
  'navigate',
  'billing.localhost',
  '/invoices',
  1,
  now()
);

do $$
begin
  begin
    insert into public.raw_event_tokens (
      id,
      observation_window_id,
      workspace_id,
      observer_id,
      sequence_no,
      action_type,
      hostname,
      normalized_path,
      tab_id,
      occurred_at
    )
    values (
      'a8000000-0000-4000-8000-000000000002',
      'a7000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000002',
      2,
      'navigate',
      'billing.localhost',
      '/private/payment-details',
      1,
      now()
    );
    raise exception 'privacy-excluded event unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select public.transition_observation_window(
  'a7000000-0000-4000-8000-000000000001',
  'paused'
);

do $$
begin
  begin
    insert into public.raw_event_tokens (
      id,
      observation_window_id,
      workspace_id,
      observer_id,
      sequence_no,
      action_type,
      hostname,
      normalized_path,
      tab_id,
      occurred_at
    )
    values (
      'a8000000-0000-4000-8000-000000000003',
      'a7000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000002',
      3,
      'click',
      'billing.localhost',
      '/invoices',
      1,
      now()
    );
    raise exception 'paused observation accepted an event' using errcode = 'ZX001';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select public.transition_observation_window(
  'a7000000-0000-4000-8000-000000000001',
  'active'
);
select public.transition_observation_window(
  'a7000000-0000-4000-8000-000000000001',
  'completed'
);
select public.transition_observation_window(
  'a7000000-0000-4000-8000-000000000001',
  'completed'
);

do $$
begin
  if not exists (
    select 1
    from public.observation_windows
    where id = 'a7000000-0000-4000-8000-000000000001'
      and status = 'completed'
      and ended_at is not null
  ) then
    raise exception 'observation lifecycle did not complete';
  end if;
end;
$$;

reset role;
rollback;

select 'Phase 3 observation API checks passed.' as result;
