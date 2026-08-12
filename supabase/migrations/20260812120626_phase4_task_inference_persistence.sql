create or replace function public.persist_task_inference_result(
  target_run_id uuid,
  target_observation_window_id uuid,
  target_input_digest text,
  target_model text,
  target_prompt_version integer,
  target_normalization_version integer,
  target_steps jsonb,
  target_segments jsonb,
  target_tasks jsonb
)
returns public.task_inference_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_window public.observation_windows;
  existing_run public.task_inference_runs;
  persisted_run public.task_inference_runs;
  step_record jsonb;
  segment_record jsonb;
  task_record jsonb;
  source_record record;
  supporting_record record;
  inserted_evidence_count integer;
  task_systems text[];
begin
  if jsonb_typeof(target_steps) <> 'array'
    or jsonb_typeof(target_segments) <> 'array'
    or jsonb_typeof(target_tasks) <> 'array' then
    raise exception 'inference_arrays_required' using errcode = '22023';
  end if;

  if jsonb_array_length(target_steps) = 0 then
    raise exception 'observation_events_required' using errcode = '22023';
  end if;

  select observation_window.*
  into target_window
  from public.observation_windows as observation_window
  where observation_window.id = target_observation_window_id
    and observation_window.status = 'completed';

  if not found then
    raise exception 'completed_observation_required' using errcode = '22023';
  end if;

  select inference_run.*
  into existing_run
  from public.task_inference_runs as inference_run
  where inference_run.id = target_run_id;
  if found then
    return existing_run;
  end if;

  for step_record in select value from jsonb_array_elements(target_steps) loop
    if (step_record ->> 'observation_window_id')::uuid <> target_window.id
      or (step_record ->> 'workspace_id')::uuid <> target_window.workspace_id then
      raise exception 'step_scope_mismatch' using errcode = '22023';
    end if;

    insert into public.normalized_steps (
      id,
      workspace_id,
      observation_window_id,
      step_ordinal,
      step_key,
      action_type,
      hostname,
      normalized_path,
      element_role,
      element_label,
      page_landmark,
      semantic_input_token,
      tab_id,
      started_at,
      ended_at,
      source_event_count,
      candidate_boundary_before,
      boundary_reasons,
      normalization_version
    )
    values (
      (step_record ->> 'id')::uuid,
      target_window.workspace_id,
      target_window.id,
      (step_record ->> 'ordinal')::integer,
      step_record ->> 'step_key',
      step_record ->> 'action_type',
      step_record ->> 'hostname',
      step_record ->> 'normalized_path',
      step_record ->> 'element_role',
      step_record ->> 'element_label',
      step_record ->> 'page_landmark',
      step_record ->> 'semantic_input_token',
      (step_record ->> 'tab_id')::integer,
      (step_record ->> 'started_at')::timestamptz,
      (step_record ->> 'ended_at')::timestamptz,
      jsonb_array_length(step_record -> 'source_event_ids'),
      (step_record ->> 'candidate_boundary_before')::boolean,
      array(
        select jsonb_array_elements_text(step_record -> 'boundary_reasons')
      ),
      target_normalization_version
    )
    on conflict (observation_window_id, normalization_version, step_ordinal)
    do update set
      step_key = excluded.step_key,
      action_type = excluded.action_type,
      hostname = excluded.hostname,
      normalized_path = excluded.normalized_path,
      element_role = excluded.element_role,
      element_label = excluded.element_label,
      page_landmark = excluded.page_landmark,
      semantic_input_token = excluded.semantic_input_token,
      tab_id = excluded.tab_id,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      source_event_count = excluded.source_event_count,
      candidate_boundary_before = excluded.candidate_boundary_before,
      boundary_reasons = excluded.boundary_reasons;

    inserted_evidence_count := 0;
    for source_record in
      select value #>> '{}' as source_event_id, ordinality as source_position
      from jsonb_array_elements(step_record -> 'source_event_ids')
        with ordinality
    loop
      insert into public.normalized_step_events (
        normalized_step_id,
        raw_event_id,
        source_position
      )
      select
        (step_record ->> 'id')::uuid,
        source_event.id,
        source_record.source_position
      from public.raw_event_tokens as source_event
      where source_event.id = source_record.source_event_id::uuid
        and source_event.observation_window_id = target_window.id
        and source_event.workspace_id = target_window.workspace_id
      on conflict (normalized_step_id, raw_event_id) do nothing;

      if exists (
        select 1
        from public.normalized_step_events as evidence
        where evidence.normalized_step_id = (step_record ->> 'id')::uuid
          and evidence.raw_event_id = source_record.source_event_id::uuid
      ) then
        inserted_evidence_count := inserted_evidence_count + 1;
      end if;
    end loop;
    if inserted_evidence_count <> jsonb_array_length(step_record -> 'source_event_ids') then
      raise exception 'step_source_evidence_mismatch' using errcode = '22023';
    end if;
  end loop;

  for segment_record in select value from jsonb_array_elements(target_segments) loop
    insert into public.activity_segments (
      id,
      workspace_id,
      observation_window_id,
      segment_ordinal,
      start_step_ordinal,
      end_step_ordinal,
      boundary_reason,
      started_at,
      ended_at,
      normalization_version
    )
    values (
      (segment_record ->> 'id')::uuid,
      target_window.workspace_id,
      target_window.id,
      (segment_record ->> 'ordinal')::integer,
      (segment_record ->> 'start_step_ordinal')::integer,
      (segment_record ->> 'end_step_ordinal')::integer,
      segment_record ->> 'boundary_reason',
      (segment_record ->> 'started_at')::timestamptz,
      (segment_record ->> 'ended_at')::timestamptz,
      target_normalization_version
    )
    on conflict (observation_window_id, normalization_version, segment_ordinal)
    do update set
      start_step_ordinal = excluded.start_step_ordinal,
      end_step_ordinal = excluded.end_step_ordinal,
      boundary_reason = excluded.boundary_reason,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at;
  end loop;

  insert into public.task_inference_runs (
    id,
    workspace_id,
    observation_window_id,
    input_digest,
    model,
    prompt_version,
    normalization_version,
    task_count
  )
  values (
    target_run_id,
    target_window.workspace_id,
    target_window.id,
    target_input_digest,
    btrim(target_model),
    target_prompt_version,
    target_normalization_version,
    jsonb_array_length(target_tasks)
  )
  returning * into persisted_run;

  for task_record in select value from jsonb_array_elements(target_tasks) loop
    task_systems := array(
      select jsonb_array_elements_text(task_record -> 'participating_systems')
    );
    insert into public.task_instances (
      id,
      workspace_id,
      observation_window_id,
      inference_run_id,
      task_ordinal,
      neutral_label,
      apparent_objective,
      participating_systems,
      confidence,
      boundary_rationale,
      start_step_ordinal,
      end_step_ordinal,
      started_at,
      ended_at
    )
    values (
      (task_record ->> 'id')::uuid,
      target_window.workspace_id,
      target_window.id,
      target_run_id,
      (task_record ->> 'ordinal')::integer,
      task_record ->> 'neutral_label',
      task_record ->> 'apparent_objective',
      task_systems,
      (task_record ->> 'confidence')::numeric,
      task_record ->> 'boundary_rationale',
      (task_record ->> 'start_step_ordinal')::integer,
      (task_record ->> 'end_step_ordinal')::integer,
      (task_record ->> 'started_at')::timestamptz,
      (task_record ->> 'ended_at')::timestamptz
    );

    for supporting_record in
      select value #>> '{}' as normalized_step_id, ordinality as step_position
      from jsonb_array_elements(task_record -> 'supporting_step_ids')
        with ordinality
    loop
      insert into public.task_instance_steps (
        task_instance_id,
        normalized_step_id,
        step_position
      )
      select
        (task_record ->> 'id')::uuid,
        step.id,
        supporting_record.step_position
      from public.normalized_steps as step
      where step.id = supporting_record.normalized_step_id::uuid
        and step.observation_window_id = target_window.id;
      if not found then
        raise exception 'task_step_evidence_mismatch' using errcode = '22023';
      end if;
    end loop;

    insert into public.task_clusters (
      id,
      workspace_id,
      cluster_key,
      canonical_label,
      participating_systems
    )
    values (
      (task_record ->> 'cluster_id')::uuid,
      target_window.workspace_id,
      task_record ->> 'cluster_key',
      task_record ->> 'neutral_label',
      task_systems
    )
    on conflict (workspace_id, cluster_key)
    do update set
      canonical_label = excluded.canonical_label,
      participating_systems = excluded.participating_systems,
      updated_at = now();

    insert into public.task_cluster_members (cluster_id, task_instance_id)
    values (
      (task_record ->> 'cluster_id')::uuid,
      (task_record ->> 'id')::uuid
    );
  end loop;

  return persisted_run;
end;
$$;

revoke all on function public.persist_task_inference_result(
  uuid,
  uuid,
  text,
  text,
  integer,
  integer,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_task_inference_result(
  uuid,
  uuid,
  text,
  text,
  integer,
  integer,
  jsonb,
  jsonb,
  jsonb
) to service_role;

comment on function public.persist_task_inference_result(
  uuid,
  uuid,
  text,
  text,
  integer,
  integer,
  jsonb,
  jsonb,
  jsonb
) is
  'Transactionally persists deterministic steps, evidence links, segments, validated task inference, and recurring clusters using stable identities.';

create or replace function private.enqueue_task_inference(
  target_observation_window_id uuid
)
returns public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_window public.observation_windows;
  queued_job public.processing_jobs;
begin
  select observation_window.*
  into target_window
  from public.observation_windows as observation_window
  where observation_window.id = target_observation_window_id;

  if not found
    or not private.has_workspace_role(
      target_window.workspace_id,
      array['admin', 'analyst']
    ) then
    raise exception 'observation_not_found' using errcode = '42501';
  end if;

  if target_window.status <> 'completed' then
    raise exception 'completed_observation_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.raw_event_tokens as event
    where event.observation_window_id = target_window.id
  ) then
    raise exception 'observation_events_required' using errcode = '22023';
  end if;

  insert into public.processing_jobs (
    workspace_id,
    job_type,
    entity_id
  )
  values (
    target_window.workspace_id,
    'task_inference',
    target_window.id
  )
  on conflict (workspace_id, job_type, entity_id)
    where status in ('queued', 'running')
  do update set updated_at = now()
  returning * into queued_job;

  return queued_job;
end;
$$;

comment on function private.enqueue_task_inference(uuid) is
  'Queues completed browser observations that contain at least one sanitized event for durable task inference.';
