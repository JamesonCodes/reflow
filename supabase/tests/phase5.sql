begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase5-admin@reflow.invalid', '', '{}', '{}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase5-outsider@reflow.invalid', '', '{}', '{}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', 'd1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', null, '', '{}', '{}', now(), now(), true);

insert into public.workspaces (id, name, created_by)
values
  ('d2000000-0000-4000-8000-000000000001', 'Phase 5 Workspace', 'd1000000-0000-4000-8000-000000000001'),
  ('d2000000-0000-4000-8000-000000000002', 'Phase 5 Other', 'd1000000-0000-4000-8000-000000000002');

insert into public.workspace_members (workspace_id, user_id, member_role)
values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'admin'),
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 'observer'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'admin');

insert into public.departments (id, workspace_id, name)
values ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Accounts Payable');

insert into public.observer_installations (id, workspace_id, owner_id)
values ('d4000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003');

insert into public.observation_windows (
  id, workspace_id, observer_id, installation_id, department_id,
  department_snapshot, role_snapshot, status, started_at, ended_at
)
values
  ('d5000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 'd4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'Accounts Payable', 'Analyst', 'completed', '2026-08-19T10:00:00Z', '2026-08-19T10:02:00Z'),
  ('d5000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', 'd4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'Accounts Payable', 'Analyst', 'completed', '2026-08-19T11:00:00Z', '2026-08-19T11:02:00Z');

insert into public.task_inference_runs (
  id, workspace_id, observation_window_id, input_digest, model,
  prompt_version, normalization_version, task_count
)
values
  ('d6000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', repeat('1', 64), 'openai/gpt-5-mini', 2, 2, 1),
  ('d6000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002', repeat('2', 64), 'openai/gpt-5-mini', 2, 2, 1);

insert into public.task_instances (
  id, workspace_id, observation_window_id, inference_run_id, task_ordinal,
  neutral_label, apparent_objective, participating_systems, confidence,
  boundary_rationale, start_step_ordinal, end_step_ordinal, started_at, ended_at,
  boundary_confidence, label_confidence, objective_confidence
)
values
  ('d7000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000001', 1, 'Pay invoice', 'Validate and pay an invoice', array['ap.localhost'], 0.9, 'Supported task.', 1, 3, '2026-08-19T10:00:00Z', '2026-08-19T10:02:00Z', 0.9, 0.9, 0.9),
  ('d7000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002', 'd6000000-0000-4000-8000-000000000002', 1, 'Pay invoice', 'Validate and pay an invoice', array['ap.localhost'], 0.9, 'Supported task.', 1, 3, '2026-08-19T11:00:00Z', '2026-08-19T11:02:00Z', 0.9, 0.9, 0.9);

select set_config('request.jwt.claim.role', 'service_role', true);

select public.persist_process_mining_result(
  'd8000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  repeat('a', 64), 'openai/gpt-5-mini', 1, 1,
  '[
    {"id":"d9000000-0000-4000-8000-000000000001","observation_window_id":"d5000000-0000-4000-8000-000000000001","department":"Accounts Payable","role":"Analyst","ordinal":1,"hard_segment_ordinal":1,"neutral_label":"Pay invoice","apparent_objective":"Validate and pay an invoice","participating_systems":["ap.localhost"],"start_step_ordinal":1,"end_step_ordinal":3,"started_at":"2026-08-19T10:00:00Z","ended_at":"2026-08-19T10:02:00Z","confidence":0.9,"feature_signature":"1111111111111111111111111111111111111111111111111111111111111111","cluster_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","feature_tokens":["action:submit"],"source_correction_id":null,"source_task_instance_ids":["d7000000-0000-4000-8000-000000000001"]},
    {"id":"d9000000-0000-4000-8000-000000000002","observation_window_id":"d5000000-0000-4000-8000-000000000002","department":"Accounts Payable","role":"Analyst","ordinal":1,"hard_segment_ordinal":1,"neutral_label":"Pay invoice","apparent_objective":"Validate and pay an invoice","participating_systems":["ap.localhost"],"start_step_ordinal":1,"end_step_ordinal":3,"started_at":"2026-08-19T11:00:00Z","ended_at":"2026-08-19T11:02:00Z","confidence":0.9,"feature_signature":"2222222222222222222222222222222222222222222222222222222222222222","cluster_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","feature_tokens":["action:submit"],"source_correction_id":null,"source_task_instance_ids":["d7000000-0000-4000-8000-000000000002"]}
  ]'::jsonb,
  '[
    {"id":"da000000-0000-4000-8000-000000000001","observation_window_id":"d5000000-0000-4000-8000-000000000001","neutral_label":"Invoice payment","apparent_outcome":"Invoice submitted for payment","boundary_rationale":"One complete observed outcome.","confidence":0.9,"started_at":"2026-08-19T10:00:00Z","ended_at":"2026-08-19T10:02:00Z","duration_seconds":120,"cluster_sequence":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],"task_snapshot_ids":["d9000000-0000-4000-8000-000000000001"],"department":"Accounts Payable","role":"Analyst"},
    {"id":"da000000-0000-4000-8000-000000000002","observation_window_id":"d5000000-0000-4000-8000-000000000002","neutral_label":"Invoice payment","apparent_outcome":"Invoice submitted for payment","boundary_rationale":"One complete observed outcome.","confidence":0.9,"started_at":"2026-08-19T11:00:00Z","ended_at":"2026-08-19T11:02:00Z","duration_seconds":120,"cluster_sequence":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],"task_snapshot_ids":["d9000000-0000-4000-8000-000000000002"],"department":"Accounts Payable","role":"Analyst"}
  ]'::jsonb,
  '[]'::jsonb,
  '[{
    "id":"db000000-0000-4000-8000-000000000001",
    "candidate_key":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "neutral_label":"Invoice payment","apparent_outcome":"Invoice submitted for payment","confidence":0.9,
    "participating_systems":["ap.localhost"],
    "canonical_cluster_sequence":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    "instance_ids":["da000000-0000-4000-8000-000000000001","da000000-0000-4000-8000-000000000002"],
    "variant_count":1,
    "metrics":{"instanceCount":2,"observationCount":2,"medianDurationSeconds":120,"p90DurationSeconds":120,"medianTaskCount":1,"taskFrequency":{"a":2},"roleFrequency":{"Analyst":2},"departmentFrequency":{"Accounts Payable":2},"systemFrequency":{"ap.localhost":2},"loopCount":0,"backtrackCount":0,"crossSystemTransitionCount":0,"possibleRepeatedEntryCount":0,"longWaitCount":0,"possibleAbandonmentCount":0},
    "graph_edges":[],"findings":[]
  }]'::jsonb
);

-- Idempotent retry returns before parsing replacement payloads.
select public.persist_process_mining_result(
  'd8000000-0000-4000-8000-000000000001',
  'd2000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000001',
  repeat('a', 64), 'openai/gpt-5-mini', 1, 1,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
);

do $$
begin
  begin
    perform public.persist_process_mining_result(
      'dc000000-0000-4000-8000-000000000001',
      'd2000000-0000-4000-8000-000000000001',
      'd3000000-0000-4000-8000-000000000001',
      repeat('c', 64), 'openai/gpt-5-mini', 1, 1,
      '[]'::jsonb,
      '[{"id":"dd000000-0000-4000-8000-000000000001","observation_window_id":"d5000000-0000-4000-8000-000000000001","neutral_label":"Invalid process","apparent_outcome":"Invalid evidence","boundary_rationale":"Deliberately invalid fixture.","confidence":0.5,"started_at":"2026-08-19T10:00:00Z","ended_at":"2026-08-19T10:01:00Z","duration_seconds":60,"cluster_sequence":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],"task_snapshot_ids":["de000000-0000-4000-8000-000000000001"],"department":"Accounts Payable","role":"Analyst"}]'::jsonb,
      '[]'::jsonb, '[]'::jsonb
    );
    raise exception 'invalid process evidence unexpectedly persisted' using errcode = 'ZX001';
  exception when sqlstate '22023' then null;
  end;
  if exists (select 1 from public.process_mining_runs where id = 'dc000000-0000-4000-8000-000000000001') then
    raise exception 'invalid process result left a partial mining run';
  end if;
end;
$$;

do $$
begin
  if (select count(*) from public.process_mining_runs where id = 'd8000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'process mining retry duplicated the run';
  end if;
  if (select count(*) from public.process_candidates where mining_run_id = 'd8000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'recurring candidate was not persisted exactly once';
  end if;
  if (select count(*) from public.process_variants) <> 1 then
    raise exception 'exact process variant was not persisted';
  end if;
  if exists (
    select 1 from information_schema.columns as column_info
    where column_info.table_schema = 'public'
      and column_info.table_name like 'process_%'
      and col_description(
        (quote_ident(column_info.table_schema) || '.' || quote_ident(column_info.table_name))::regclass,
        column_info.ordinal_position
      ) is null
  ) then raise exception 'a process mining column is missing its description'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);

select public.enqueue_process_mining(
  'd3000000-0000-4000-8000-000000000001'
);

do $$
begin
  if not exists (
    select 1
    from public.processing_jobs
    where workspace_id = 'd2000000-0000-4000-8000-000000000001'
      and job_type = 'process_mining'
      and entity_id = 'd3000000-0000-4000-8000-000000000001'
      and status = 'queued'
  ) then
    raise exception 'authorized analyst could not queue process mining';
  end if;

  begin
    insert into public.processing_jobs (workspace_id, job_type, entity_id)
    values (
      'd2000000-0000-4000-8000-000000000001',
      'process_mining',
      gen_random_uuid()
    );
    raise exception 'authenticated analyst unexpectedly inserted a job directly'
      using errcode = 'ZX001';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select public.create_process_candidate_correction(
  'd2000000-0000-4000-8000-000000000001',
  'd8000000-0000-4000-8000-000000000001',
  'confirm', array['db000000-0000-4000-8000-000000000001']::uuid[],
  '{}'::uuid[], '{}'::text[], 'Confirmed from evidence'
);

do $$
begin
  if (select count(*) from public.process_candidate_corrections) <> 1 then
    raise exception 'analyst confirmation was not stored';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);

do $$
begin
  begin
    perform public.enqueue_process_mining(
      'd3000000-0000-4000-8000-000000000001'
    );
    raise exception 'cross-workspace user unexpectedly queued process mining'
      using errcode = 'ZX001';
  exception when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  if (select count(*) from public.process_mining_runs) <> 0 then
    raise exception 'cross-workspace process mining runs were visible';
  end if;
  if (select count(*) from public.process_candidates) <> 0 then
    raise exception 'cross-workspace process candidates were visible';
  end if;
  if (select count(*) from public.process_findings) <> 0 then
    raise exception 'cross-workspace process findings were visible';
  end if;
end;
$$;

reset role;
rollback;

select 'Phase 5 As-Is process mining persistence and RLS checks passed.' as result;
