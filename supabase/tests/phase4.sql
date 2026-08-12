begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase4-a@reflow.invalid', '', '{}', '{}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase4-b@reflow.invalid', '', '{}', '{}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', null, '', '{}', '{}', now(), now(), true),
  ('00000000-0000-0000-0000-000000000000', 'b1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', null, '', '{}', '{}', now(), now(), true);

insert into public.workspaces (id, name, created_by)
values
  ('b2000000-0000-4000-8000-000000000001', 'Phase 4 Workspace A', 'b1000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000002', 'Phase 4 Workspace B', 'b1000000-0000-4000-8000-000000000002');

insert into public.workspace_members (workspace_id, user_id, member_role)
values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'admin'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'observer'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'admin'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'observer');

insert into public.departments (id, workspace_id, name)
values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Accounts Payable'),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'Operations');

insert into public.observer_installations (id, workspace_id, owner_id)
values
  ('b4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003'),
  ('b4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004');

insert into public.observation_windows (
  id, workspace_id, observer_id, installation_id, department_id,
  department_snapshot, role_snapshot, status, started_at, ended_at
)
values
  ('b5000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 'b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'Accounts Payable', 'Invoice analyst', 'completed', '2026-08-12T10:00:00Z', '2026-08-12T10:01:00Z'),
  ('b5000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'b4000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'Operations', 'Coordinator', 'completed', '2026-08-12T10:00:00Z', '2026-08-12T10:01:00Z');

insert into public.raw_event_tokens (
  id, observation_window_id, workspace_id, observer_id, sequence_no,
  action_type, hostname, normalized_path, element_role, element_label,
  page_landmark, tab_id, occurred_at
)
values
  ('b6000000-0000-4000-8000-000000000001', 'b5000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000003', 1, 'click', 'ap.localhost', '/invoices', 'button', 'Review invoice', 'Invoice queue', 1, '2026-08-12T10:00:01Z'),
  ('b6000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 1, 'click', 'ops.localhost', '/requests', 'button', 'Review request', 'Request queue', 1, '2026-08-12T10:00:01Z');

select public.persist_task_inference_result(
  'b7000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  'openai/gpt-5-mini',
  1,
  1,
  '[{"id":"b8000000-0000-4000-8000-000000000001","workspace_id":"b2000000-0000-4000-8000-000000000001","observation_window_id":"b5000000-0000-4000-8000-000000000001","ordinal":1,"step_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","action_type":"click","hostname":"ap.localhost","normalized_path":"/invoices","element_role":"button","element_label":"Review invoice","page_landmark":"Invoice queue","semantic_input_token":null,"tab_id":1,"started_at":"2026-08-12T10:00:01Z","ended_at":"2026-08-12T10:00:01Z","source_event_ids":["b6000000-0000-4000-8000-000000000001"],"candidate_boundary_before":false,"boundary_reasons":[]}]'::jsonb,
  '[{"id":"b9000000-0000-4000-8000-000000000001","workspace_id":"b2000000-0000-4000-8000-000000000001","observation_window_id":"b5000000-0000-4000-8000-000000000001","ordinal":1,"start_step_ordinal":1,"end_step_ordinal":1,"boundary_reason":"observation_start","started_at":"2026-08-12T10:00:01Z","ended_at":"2026-08-12T10:00:01Z"}]'::jsonb,
  '[{"id":"ba000000-0000-4000-8000-000000000001","ordinal":1,"neutral_label":"Review invoice","apparent_objective":"Review an invoice","participating_systems":["ap.localhost"],"confidence":0.8,"boundary_rationale":"One supported browser step.","start_step_ordinal":1,"end_step_ordinal":1,"started_at":"2026-08-12T10:00:01Z","ended_at":"2026-08-12T10:00:01Z","supporting_step_ids":["b8000000-0000-4000-8000-000000000001"],"cluster_id":"bb000000-0000-4000-8000-000000000001","cluster_key":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}]'::jsonb
);

select public.persist_task_inference_result(
  'b7000000-0000-4000-8000-000000000002',
  'b5000000-0000-4000-8000-000000000002',
  repeat('c', 64),
  'openai/gpt-5-mini', 1, 1,
  '[{"id":"b8000000-0000-4000-8000-000000000002","workspace_id":"b2000000-0000-4000-8000-000000000002","observation_window_id":"b5000000-0000-4000-8000-000000000002","ordinal":1,"step_key":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","action_type":"click","hostname":"ops.localhost","normalized_path":"/requests","element_role":"button","element_label":"Review request","page_landmark":"Request queue","semantic_input_token":null,"tab_id":1,"started_at":"2026-08-12T10:00:01Z","ended_at":"2026-08-12T10:00:01Z","source_event_ids":["b6000000-0000-4000-8000-000000000002"],"candidate_boundary_before":false,"boundary_reasons":[]}]'::jsonb,
  '[{"id":"b9000000-0000-4000-8000-000000000002","workspace_id":"b2000000-0000-4000-8000-000000000002","observation_window_id":"b5000000-0000-4000-8000-000000000002","ordinal":1,"start_step_ordinal":1,"end_step_ordinal":1,"boundary_reason":"observation_start","started_at":"2026-08-12T10:00:01Z","ended_at":"2026-08-12T10:00:01Z"}]'::jsonb,
  '[{"id":"ba000000-0000-4000-8000-000000000002","ordinal":1,"neutral_label":"Review request","apparent_objective":"Review a request","participating_systems":["ops.localhost"],"confidence":0.8,"boundary_rationale":"One supported browser step.","start_step_ordinal":1,"end_step_ordinal":1,"started_at":"2026-08-12T10:00:01Z","ended_at":"2026-08-12T10:00:01Z","supporting_step_ids":["b8000000-0000-4000-8000-000000000002"],"cluster_id":"bb000000-0000-4000-8000-000000000002","cluster_key":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"}]'::jsonb
);

-- A retry with the same stable run identity returns the original transaction.
select public.persist_task_inference_result(
  'b7000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  'openai/gpt-5-mini', 1, 1,
  '[{}]'::jsonb, '[]'::jsonb, '[]'::jsonb
);

insert into public.processing_jobs (
  workspace_id, job_type, entity_id, status, attempt_count,
  locked_at, lock_token, locked_by
)
values (
  'b2000000-0000-4000-8000-000000000001',
  'task_inference',
  'b5000000-0000-4000-8000-000000000001',
  'running',
  1,
  now() - interval '11 minutes',
  'bc000000-0000-4000-8000-000000000001',
  'abandoned-worker'
);

select *
from public.claim_processing_jobs('replacement-worker', array['task_inference'], 1);

do $$
begin
  if not exists (
    select 1
    from public.processing_jobs
    where entity_id = 'b5000000-0000-4000-8000-000000000001'
      and locked_by = 'replacement-worker'
      and attempt_count = 2
  ) then
    raise exception 'stale processing job was not reclaimed after worker restart';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);

do $$
begin
  if (select count(*) from public.task_instances) <> 1 then
    raise exception 'cross-workspace inferred tasks were visible';
  end if;
  if (select count(*) from public.task_instance_steps) <> 1 then
    raise exception 'task evidence was not workspace isolated';
  end if;
end;
$$;

select public.create_task_correction(
  'b2000000-0000-4000-8000-000000000001',
  'rename',
  array['ba000000-0000-4000-8000-000000000001']::uuid[],
  array['Validate invoice'],
  null,
  'More precise observed activity'
);

do $$
begin
  if (select neutral_label from public.task_instances where id = 'ba000000-0000-4000-8000-000000000001') <> 'Review invoice' then
    raise exception 'analyst correction mutated original inference';
  end if;
  if (select count(*) from public.task_corrections) <> 1 then
    raise exception 'analyst correction was not persisted';
  end if;
end;
$$;

reset role;
rollback;

select 'Phase 4 task inference and RLS checks passed.' as result;
