begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase4a-admin@reflow.invalid', '', '{}', '{}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase4a-outsider@reflow.invalid', '', '{}', '{}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', null, '', '{}', '{}', now(), now(), true);

insert into public.workspaces (id, name, created_by)
values
  ('c2000000-0000-4000-8000-000000000001', 'Phase 4A Workspace', 'c1000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000002', 'Phase 4A Other', 'c1000000-0000-4000-8000-000000000002');

insert into public.workspace_members (workspace_id, user_id, member_role)
values
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'admin'),
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 'observer'),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'admin');

insert into public.departments (id, workspace_id, name)
values ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Finance');

insert into public.observer_installations (id, workspace_id, owner_id)
values ('c4000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003');

insert into public.observation_windows (
  id, workspace_id, observer_id, installation_id, department_id,
  department_snapshot, role_snapshot, status, started_at, ended_at
)
values (
  'c5000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000003',
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000001',
  'Finance', 'Analyst', 'completed',
  '2026-08-13T10:00:00Z', '2026-08-13T10:01:00Z'
);

insert into public.raw_event_tokens (
  id, observation_window_id, workspace_id, observer_id, sequence_no,
  action_type, hostname, normalized_path, element_role, element_label,
  tab_id, occurred_at
)
values
  ('c6000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 1, 'page_context', 'ap.localhost', '/', null, null, 1, '2026-08-13T10:00:01Z'),
  ('c6000000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 2, 'click', 'ap.localhost', '/invoices', 'button', 'Validate invoice', 1, '2026-08-13T10:00:02Z'),
  ('c6000000-0000-4000-8000-000000000003', 'c5000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 3, 'click', 'erp.localhost', '/vendors/:id', 'button', 'Confirm vendor', 1, '2026-08-13T10:00:03Z'),
  ('c6000000-0000-4000-8000-000000000004', 'c5000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003', 4, 'submit', 'bank.localhost', '/payments/new', 'button', 'Submit payment', 1, '2026-08-13T10:00:04Z');

select public.persist_task_inference_result_v2(
  'c7000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  repeat('e', 64), 'openai/gpt-5-mini', 2, 2,
  '[
    {"id":"c8000000-0000-4000-8000-000000000001","workspace_id":"c2000000-0000-4000-8000-000000000001","observation_window_id":"c5000000-0000-4000-8000-000000000001","ordinal":1,"step_key":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","action_type":"page_context","hostname":"ap.localhost","normalized_path":"/","element_role":null,"element_label":null,"page_landmark":null,"semantic_input_token":null,"tab_id":1,"started_at":"2026-08-13T10:00:01Z","ended_at":"2026-08-13T10:00:01Z","source_event_ids":["c6000000-0000-4000-8000-000000000001"],"interaction_group_id":"cd000000-0000-4000-8000-000000000001","candidate_boundary_before":false,"boundary_reasons":[]},
    {"id":"c8000000-0000-4000-8000-000000000002","workspace_id":"c2000000-0000-4000-8000-000000000001","observation_window_id":"c5000000-0000-4000-8000-000000000001","ordinal":2,"step_key":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","action_type":"click","hostname":"ap.localhost","normalized_path":"/invoices","element_role":"button","element_label":"Validate invoice","page_landmark":null,"semantic_input_token":null,"tab_id":1,"started_at":"2026-08-13T10:00:02Z","ended_at":"2026-08-13T10:00:02Z","source_event_ids":["c6000000-0000-4000-8000-000000000002"],"interaction_group_id":"cd000000-0000-4000-8000-000000000002","candidate_boundary_before":false,"boundary_reasons":[]},
    {"id":"c8000000-0000-4000-8000-000000000003","workspace_id":"c2000000-0000-4000-8000-000000000001","observation_window_id":"c5000000-0000-4000-8000-000000000001","ordinal":3,"step_key":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","action_type":"click","hostname":"erp.localhost","normalized_path":"/vendors/:id","element_role":"button","element_label":"Confirm vendor","page_landmark":null,"semantic_input_token":null,"tab_id":1,"started_at":"2026-08-13T10:00:03Z","ended_at":"2026-08-13T10:00:03Z","source_event_ids":["c6000000-0000-4000-8000-000000000003"],"interaction_group_id":"cd000000-0000-4000-8000-000000000003","candidate_boundary_before":true,"boundary_reasons":["cross_domain"]},
    {"id":"c8000000-0000-4000-8000-000000000004","workspace_id":"c2000000-0000-4000-8000-000000000001","observation_window_id":"c5000000-0000-4000-8000-000000000001","ordinal":4,"step_key":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","action_type":"submit","hostname":"bank.localhost","normalized_path":"/payments/new","element_role":"button","element_label":"Submit payment","page_landmark":null,"semantic_input_token":null,"tab_id":1,"started_at":"2026-08-13T10:00:04Z","ended_at":"2026-08-13T10:00:04Z","source_event_ids":["c6000000-0000-4000-8000-000000000004"],"interaction_group_id":"cd000000-0000-4000-8000-000000000004","candidate_boundary_before":true,"boundary_reasons":["cross_domain"]}
  ]'::jsonb,
  '[{"id":"c9000000-0000-4000-8000-000000000001","workspace_id":"c2000000-0000-4000-8000-000000000001","observation_window_id":"c5000000-0000-4000-8000-000000000001","ordinal":1,"start_step_ordinal":1,"end_step_ordinal":4,"boundary_reason":"observation_start","started_at":"2026-08-13T10:00:01Z","ended_at":"2026-08-13T10:00:04Z"}]'::jsonb,
  '[
    {"id":"ca000000-0000-4000-8000-000000000001","ordinal":1,"neutral_label":"Validate invoice","apparent_objective":"Validate an invoice","participating_systems":["ap.localhost"],"confidence":0.8,"boundary_confidence":0.8,"label_confidence":0.9,"objective_confidence":0.85,"boundary_rationale":"One supported action.","start_step_ordinal":2,"end_step_ordinal":2,"started_at":"2026-08-13T10:00:02Z","ended_at":"2026-08-13T10:00:02Z","supporting_step_ids":["c8000000-0000-4000-8000-000000000002"],"cluster_id":"cb000000-0000-4000-8000-000000000001","cluster_key":"1111111111111111111111111111111111111111111111111111111111111111"},
    {"id":"ca000000-0000-4000-8000-000000000002","ordinal":2,"neutral_label":"Confirm vendor","apparent_objective":"Confirm vendor details","participating_systems":["erp.localhost"],"confidence":0.8,"boundary_confidence":0.8,"label_confidence":0.9,"objective_confidence":0.85,"boundary_rationale":"One supported action.","start_step_ordinal":3,"end_step_ordinal":3,"started_at":"2026-08-13T10:00:03Z","ended_at":"2026-08-13T10:00:03Z","supporting_step_ids":["c8000000-0000-4000-8000-000000000003"],"cluster_id":"cb000000-0000-4000-8000-000000000002","cluster_key":"2222222222222222222222222222222222222222222222222222222222222222"},
    {"id":"ca000000-0000-4000-8000-000000000003","ordinal":3,"neutral_label":"Submit payment","apparent_objective":"Submit a payment","participating_systems":["bank.localhost"],"confidence":0.8,"boundary_confidence":0.8,"label_confidence":0.9,"objective_confidence":0.85,"boundary_rationale":"One supported action.","start_step_ordinal":4,"end_step_ordinal":4,"started_at":"2026-08-13T10:00:04Z","ended_at":"2026-08-13T10:00:04Z","supporting_step_ids":["c8000000-0000-4000-8000-000000000004"],"cluster_id":"cb000000-0000-4000-8000-000000000003","cluster_key":"3333333333333333333333333333333333333333333333333333333333333333"}
  ]'::jsonb,
  '[{"id":"cc000000-0000-4000-8000-000000000001","ordinal":1,"classification":"observation_context","reason":"Initial active-tab context.","start_step_ordinal":1,"end_step_ordinal":1,"supporting_step_ids":["c8000000-0000-4000-8000-000000000001"]}]'::jsonb
);

-- A retry returns the existing run before parsing replacement payloads.
select public.persist_task_inference_result_v2(
  'c7000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001',
  repeat('e', 64), 'openai/gpt-5-mini', 2, 2,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
);

do $$
begin
  if (select count(*) from public.task_instances where inference_run_id = 'c7000000-0000-4000-8000-000000000001') <> 3 then
    raise exception 'version-2 tasks were not persisted exactly once';
  end if;
  if (select count(*) from public.task_inference_exclusions where inference_run_id = 'c7000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'version-2 exclusion was not persisted exactly once';
  end if;
  if exists (
    select 1 from public.normalized_steps
    where observation_window_id = 'c5000000-0000-4000-8000-000000000001'
      and normalization_version = 2
      and interaction_group_id is null
  ) then
    raise exception 'version-2 interaction group was not persisted';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}', true);

do $$
begin
  begin
    perform public.create_task_correction(
      'c2000000-0000-4000-8000-000000000001',
      'merge',
      array['ca000000-0000-4000-8000-000000000001', 'ca000000-0000-4000-8000-000000000003']::uuid[],
      array['Invalid nonadjacent merge'], null, null
    );
    raise exception 'nonadjacent merge unexpectedly succeeded' using errcode = 'ZX001';
  exception when sqlstate '22023' then null;
  end;

  perform public.create_task_correction(
    'c2000000-0000-4000-8000-000000000001',
    'merge',
    array['ca000000-0000-4000-8000-000000000001', 'ca000000-0000-4000-8000-000000000002']::uuid[],
    array['Validate invoice and vendor'], null, null
  );
  perform public.create_task_correction(
    'c2000000-0000-4000-8000-000000000001',
    'rename',
    array['ca000000-0000-4000-8000-000000000001', 'ca000000-0000-4000-8000-000000000002']::uuid[],
    array['Confirm invoice and vendor'], null, null
  );
  if (select count(*) from public.task_corrections) <> 2 then
    raise exception 'effective merged task could not be corrected again';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}', true);

do $$
begin
  if (select count(*) from public.task_inference_exclusions) <> 0 then
    raise exception 'cross-workspace inference exclusions were visible';
  end if;
  if (select count(*) from public.task_inference_exclusion_steps) <> 0 then
    raise exception 'cross-workspace exclusion evidence was visible';
  end if;
end;
$$;

reset role;
rollback;

select 'Phase 4A task inference hardening and RLS checks passed.' as result;
