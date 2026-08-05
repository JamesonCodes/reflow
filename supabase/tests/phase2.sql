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
    '81000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'phase2-admin@reflow.invalid',
    '',
    '{"reflow_admin":true}',
    '{}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'phase2-unapproved@reflow.invalid',
    '',
    '{}',
    '{}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '81000000-0000-4000-8000-000000000003',
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

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false,"app_metadata":{}}',
  true
);

do $$
begin
  begin
    perform public.create_workspace('Unauthorized workspace');
    raise exception 'non-allowlisted workspace creation unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false,"app_metadata":{"reflow_admin":true}}',
  true
);

do $$
declare
  created_workspace public.workspaces;
begin
  select *
  into created_workspace
  from public.create_workspace('Phase 2 Study');

  perform set_config(
    'reflow.phase2_workspace_id',
    created_workspace.id::text,
    true
  );
end;
$$;

insert into public.departments (id, workspace_id, name)
values (
  '83000000-0000-4000-8000-000000000001',
  current_setting('reflow.phase2_workspace_id')::uuid,
  'Accounts Payable'
);

insert into public.job_roles (id, workspace_id, department_id, name)
values (
  '84000000-0000-4000-8000-000000000001',
  current_setting('reflow.phase2_workspace_id')::uuid,
  '83000000-0000-4000-8000-000000000001',
  'Invoice analyst'
);

insert into public.allowed_domains (id, workspace_id, hostname)
values (
  '85000000-0000-4000-8000-000000000001',
  current_setting('reflow.phase2_workspace_id')::uuid,
  'billing.example.test'
);

insert into public.privacy_exclusions (
  workspace_id,
  allowed_domain_id,
  path_prefix,
  reason
)
values (
  current_setting('reflow.phase2_workspace_id')::uuid,
  '85000000-0000-4000-8000-000000000001',
  '/payroll',
  'Sensitive area'
);

do $$
declare
  generated_invite record;
begin
  select *
  into generated_invite
  from public.create_workspace_invite(
    current_setting('reflow.phase2_workspace_id')::uuid,
    1,
    now() + interval '1 day'
  );

  if generated_invite.invite_code is null
    or char_length(generated_invite.invite_code) <> 48 then
    raise exception 'invite code was not returned exactly once';
  end if;

  if exists (
    select 1
    from public.workspace_invites
    where id = generated_invite.invite_id
      and code_hash = generated_invite.invite_code
  ) then
    raise exception 'raw invite code was stored';
  end if;

  perform set_config('reflow.phase2_invite_code', generated_invite.invite_code, true);
end;
$$;

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}',
  true
);

select public.join_workspace_by_invite(
  current_setting('reflow.phase2_invite_code'),
  '86000000-0000-4000-8000-000000000001'
);

insert into public.observer_profiles (
  workspace_id,
  observer_id,
  default_department_id,
  default_job_role_id
)
values (
  current_setting('reflow.phase2_workspace_id')::uuid,
  '81000000-0000-4000-8000-000000000003',
  '83000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001'
);

insert into public.observation_windows (
  id,
  workspace_id,
  observer_id,
  installation_id,
  department_id,
  job_role_id,
  department_snapshot,
  role_snapshot,
  started_at
)
values (
  '87000000-0000-4000-8000-000000000001',
  current_setting('reflow.phase2_workspace_id')::uuid,
  '81000000-0000-4000-8000-000000000003',
  '86000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  '84000000-0000-4000-8000-000000000001',
  'Accounts Payable',
  'Invoice analyst',
  now()
);

update public.observer_profiles
set
  default_job_role_id = null,
  custom_role = 'Payment specialist'
where workspace_id = current_setting('reflow.phase2_workspace_id')::uuid
  and observer_id = '81000000-0000-4000-8000-000000000003';

do $$
begin
  if not exists (
    select 1
    from public.observation_windows
    where id = '87000000-0000-4000-8000-000000000001'
      and department_snapshot = 'Accounts Payable'
      and role_snapshot = 'Invoice analyst'
  ) then
    raise exception 'profile update rewrote historical observation context';
  end if;

  begin
    update public.observer_profiles
    set default_department_id = null
    where observer_id = '81000000-0000-4000-8000-000000000003';
    raise exception 'department-free observer profile unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when not_null_violation or insufficient_privilege then null;
  end;

  begin
    insert into public.observation_windows (
      id,
      workspace_id,
      observer_id,
      installation_id,
      department_id,
      department_snapshot,
      role_snapshot,
      started_at
    )
    values (
      '87000000-0000-4000-8000-000000000002',
      current_setting('reflow.phase2_workspace_id')::uuid,
      '81000000-0000-4000-8000-000000000003',
      '86000000-0000-4000-8000-000000000001',
      null,
      'Missing',
      'Missing',
      now()
    );
    raise exception 'department-free observation unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when not_null_violation or insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;

select 'Phase 2 study setup checks passed.' as result;
