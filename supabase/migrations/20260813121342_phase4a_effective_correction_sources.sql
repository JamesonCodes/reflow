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
  minimum_step_ordinal integer;
  maximum_step_ordinal integer;
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

  select
    count(*),
    count(distinct task.inference_run_id),
    min(task.task_ordinal),
    max(task.task_ordinal),
    min(task.start_step_ordinal),
    max(task.end_step_ordinal)
  into
    found_source_count,
    source_run_count,
    minimum_task_ordinal,
    maximum_task_ordinal,
    minimum_step_ordinal,
    maximum_step_ordinal
  from public.task_instances as task
  where task.id = any(target_task_instance_ids)
    and task.workspace_id = target_workspace_id;

  if found_source_count <> source_count then
    raise exception 'task_source_not_found' using errcode = '22023';
  end if;
  if source_run_count <> 1 then
    raise exception 'correction_requires_one_inference_run' using errcode = '22023';
  end if;
  if source_count > 1
    and maximum_task_ordinal - minimum_task_ordinal + 1 <> source_count then
    raise exception 'correction_requires_adjacent_tasks' using errcode = '22023';
  end if;

  if target_correction_type = 'split'
    and (
      target_split_after_step_ordinal is null
      or target_split_after_step_ordinal < minimum_step_ordinal
      or target_split_after_step_ordinal >= maximum_step_ordinal
    ) then
    raise exception 'split_boundary_outside_task' using errcode = '22023';
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
  'Stores immutable correction overlays; multi-source operations require adjacent tasks from one inference run so corrected tasks remain editable.';
