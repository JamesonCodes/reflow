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
    '91000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'phase1-admin-a@reflow.invalid',
    '',
    '{}',
    '{}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'phase1-admin-b@reflow.invalid',
    '',
    '{}',
    '{}',
    now(),
    now(),
    false
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    null,
    '',
    '{}',
    '{}',
    now(),
    now(),
    true
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000004',
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
values
  (
    '92000000-0000-4000-8000-000000000001',
    'Phase 1 Workspace A',
    '91000000-0000-4000-8000-000000000001'
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    'Phase 1 Workspace B',
    '91000000-0000-4000-8000-000000000002'
  );

insert into public.workspace_members (workspace_id, user_id, member_role)
values
  (
    '92000000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'admin'
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    '91000000-0000-4000-8000-000000000002',
    'admin'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);

do $$
begin
  if (select count(*) from public.workspaces) <> 1 then
    raise exception 'cross-workspace workspace read was not denied';
  end if;

  if exists (
    select 1
    from public.workspaces
    where id = '92000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'workspace B leaked to workspace A';
  end if;
end;
$$;

reset role;

insert into public.departments (id, workspace_id, name)
values (
  '93000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'Accounts Payable'
);

insert into public.allowed_domains (workspace_id, hostname, include_subdomains)
values (
  '92000000-0000-4000-8000-000000000001',
  'example.test',
  true
);

insert into public.workspace_members (workspace_id, user_id, member_role)
values (
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000003',
  'observer'
);

insert into public.observer_installations (id, workspace_id, owner_id)
values (
  '94000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000003'
);

insert into public.observation_windows (
  id,
  workspace_id,
  observer_id,
  installation_id,
  department_id,
  department_snapshot,
  started_at
)
values (
  '95000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000003',
  '94000000-0000-4000-8000-000000000001',
  '93000000-0000-4000-8000-000000000001',
  'Accounts Payable',
  now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}',
  true
);

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
  '96000000-0000-4000-8000-000000000001',
  '95000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000003',
  1,
  'navigate',
  'billing.example.test',
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
      '96000000-0000-4000-8000-000000000002',
      '95000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000003',
      2,
      'navigate',
      'unapproved.invalid',
      '/private',
      1,
      now()
    );
    raise exception 'unapproved domain insert unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

do $$
begin
  begin
    update public.raw_event_tokens
    set action_type = 'click'
    where id = '96000000-0000-4000-8000-000000000001';
    raise exception 'raw event update unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when integrity_constraint_violation then null;
  end;

  begin
    delete from public.raw_event_tokens
    where id = '96000000-0000-4000-8000-000000000001';
    raise exception 'raw event delete unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when integrity_constraint_violation then null;
  end;
end;
$$;

insert into public.workspace_invites (
  workspace_id,
  code_hash,
  created_by,
  revoked_at
)
values (
  '92000000-0000-4000-8000-000000000001',
  encode(extensions.digest('revoked-code-123', 'sha256'), 'hex'),
  '91000000-0000-4000-8000-000000000001',
  now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":true}',
  true
);

do $$
begin
  begin
    perform public.join_workspace_by_invite(
      'not-a-real-code',
      '94000000-0000-4000-8000-000000000002'
    );
    raise exception 'invalid invite unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when invalid_parameter_value then null;
  end;

  begin
    perform public.join_workspace_by_invite(
      'revoked-code-123',
      '94000000-0000-4000-8000-000000000002'
    );
    raise exception 'revoked invite unexpectedly succeeded' using errcode = 'ZX001';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
rollback;

select 'Phase 1 RLS, domain, invite, and immutability checks passed.' as result;
