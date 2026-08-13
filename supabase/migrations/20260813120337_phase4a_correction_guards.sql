create or replace function private.create_task_correction(
  target_workspace_id uuid,
  target_correction_type text,
  target_task_instance_ids uuid[],
  target_replacement_labels text[],
  target_split_after_step_ordinal integer,
  target_reason text
)
returns public.task_corrections
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_correction public.task_corrections;
  source_count integer;
  found_source_count integer;
  source_run_count integer;
  minimum_task_ordinal integer;
  maximum_task_ordinal integer;
  source_task public.task_instances;
  source_position integer := 0;
  source_task_id uuid;
begin
  if not private.has_workspace_role(target_workspace_id, array['admin', 'analyst']) then
    raise exception 'analyst_required' using errcode = '42501';
  end if;

  source_count := cardinality(target_task_instance_ids);
  if source_count is null or source_count = 0 then
    raise exception 'task_sources_required' using errcode = '22023';
  end if;
  if source_count <> (
    select count(distinct source_id)
    from unnest(target_task_instance_ids) as source(source_id)
  ) then
    raise exception 'duplicate_task_sources' using errcode = '22023';
  end if;
  if target_correction_type = 'merge' and source_count < 2 then
    raise exception 'merge_requires_multiple_tasks' using errcode = '22023';
  end if;
  if target_correction_type <> 'merge' and source_count <> 1 then
    raise exception 'single_task_source_required' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct task.inference_run_id),
    min(task.task_ordinal),
    max(task.task_ordinal)
  into
    found_source_count,
    source_run_count,
    minimum_task_ordinal,
    maximum_task_ordinal
  from public.task_instances as task
  where task.id = any(target_task_instance_ids)
    and task.workspace_id = target_workspace_id;

  if found_source_count <> source_count then
    raise exception 'task_source_not_found' using errcode = '22023';
  end if;
  if source_run_count <> 1 then
    raise exception 'correction_requires_one_inference_run' using errcode = '22023';
  end if;
  if target_correction_type = 'merge'
    and maximum_task_ordinal - minimum_task_ordinal + 1 <> source_count then
    raise exception 'merge_requires_adjacent_tasks' using errcode = '22023';
  end if;

  if target_correction_type = 'split' then
    select task.*
    into source_task
    from public.task_instances as task
    where task.id = target_task_instance_ids[1]
      and task.workspace_id = target_workspace_id;
    if target_split_after_step_ordinal is null
      or target_split_after_step_ordinal < source_task.start_step_ordinal
      or target_split_after_step_ordinal >= source_task.end_step_ordinal then
      raise exception 'split_boundary_outside_task' using errcode = '22023';
    end if;
  end if;

  insert into public.task_corrections (
    workspace_id,
    correction_type,
    replacement_labels,
    split_after_step_ordinal,
    reason,
    created_by
  )
  values (
    target_workspace_id,
    target_correction_type,
    coalesce(target_replacement_labels, '{}'),
    target_split_after_step_ordinal,
    nullif(btrim(target_reason), ''),
    (select auth.uid())
  )
  returning * into created_correction;

  foreach source_task_id in array target_task_instance_ids loop
    source_position := source_position + 1;
    insert into public.task_correction_sources (
      correction_id,
      task_instance_id,
      source_position
    )
    values (created_correction.id, source_task_id, source_position);
  end loop;

  return created_correction;
end;
$$;

revoke all on function private.create_task_correction(
  uuid, text, uuid[], text[], integer, text
) from public, anon, authenticated;
grant execute on function private.create_task_correction(
  uuid, text, uuid[], text[], integer, text
) to authenticated;

comment on function private.create_task_correction(
  uuid, text, uuid[], text[], integer, text
) is
  'Validates and stores immutable analyst correction overlays; merges require adjacent source tasks from one inference run.';

alter function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) rename to persist_task_inference_result_v2_inner;

create function public.persist_task_inference_result_v2(
  target_run_id uuid,
  target_observation_window_id uuid,
  target_input_digest text,
  target_model text,
  target_prompt_version integer,
  target_normalization_version integer,
  target_steps jsonb,
  target_segments jsonb,
  target_tasks jsonb,
  target_exclusions jsonb
)
returns public.task_inference_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_run public.task_inference_runs;
  persisted_run public.task_inference_runs;
begin
  select inference_run.*
  into existing_run
  from public.task_inference_runs as inference_run
  where inference_run.id = target_run_id;
  if found then
    return existing_run;
  end if;

  select public.persist_task_inference_result_v2_inner(
    target_run_id,
    target_observation_window_id,
    target_input_digest,
    target_model,
    target_prompt_version,
    target_normalization_version,
    target_steps,
    target_segments,
    target_tasks,
    target_exclusions
  ) into persisted_run;
  return persisted_run;
end;
$$;

revoke all on function public.persist_task_inference_result_v2_inner(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_task_inference_result_v2_inner(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) is
  'Idempotently returns an existing version-2 inference or transactionally persists complete task and exclusion evidence.';
