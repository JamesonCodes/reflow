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
    error_code = null,
    error_detail = null,
    updated_at = now()
  where job.id in (
    select candidate.id
    from public.processing_jobs as candidate
    where (
        (candidate.status = 'queued' and candidate.available_at <= now())
        or (
          candidate.status = 'running'
          and candidate.locked_at < now() - interval '10 minutes'
        )
      )
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

revoke all on function private.enqueue_task_inference(uuid)
  from public, anon, authenticated;
revoke all on function private.create_task_correction(uuid, text, uuid[], text[], integer, text)
  from public, anon, authenticated;

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

  foreach source_task_id in array target_task_instance_ids loop
    select task.*
    into source_task
    from public.task_instances as task
    where task.id = source_task_id
      and task.workspace_id = target_workspace_id;
    if not found then
      raise exception 'task_source_not_found' using errcode = '22023';
    end if;
  end loop;

  if target_correction_type = 'split'
    and (
      target_split_after_step_ordinal is null
      or target_split_after_step_ordinal < source_task.start_step_ordinal
      or target_split_after_step_ordinal >= source_task.end_step_ordinal
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

comment on function public.claim_processing_jobs(text, text[], integer) is
  'Atomically claims queued jobs or reclaims jobs abandoned by a local worker for ten minutes using row locks and fresh lock tokens.';

comment on function private.create_task_correction(uuid, text, uuid[], text[], integer, text) is
  'Validates and stores immutable analyst correction overlays while preserving original inferred tasks.';
