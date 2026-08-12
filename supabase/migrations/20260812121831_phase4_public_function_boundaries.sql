create or replace function public.enqueue_task_inference(
  target_observation_window_id uuid
)
returns public.processing_jobs
language sql
security definer
set search_path = ''
as $$
  select private.enqueue_task_inference(target_observation_window_id);
$$;

create or replace function public.create_task_correction(
  target_workspace_id uuid,
  target_correction_type text,
  target_task_instance_ids uuid[],
  target_replacement_labels text[] default '{}',
  target_split_after_step_ordinal integer default null,
  target_reason text default null
)
returns public.task_corrections
language sql
security definer
set search_path = ''
as $$
  select private.create_task_correction(
    target_workspace_id,
    target_correction_type,
    target_task_instance_ids,
    target_replacement_labels,
    target_split_after_step_ordinal,
    target_reason
  );
$$;

revoke all on function private.enqueue_task_inference(uuid)
  from public, anon, authenticated;
revoke all on function private.create_task_correction(uuid, text, uuid[], text[], integer, text)
  from public, anon, authenticated;
revoke all on function public.enqueue_task_inference(uuid)
  from public, anon;
revoke all on function public.create_task_correction(uuid, text, uuid[], text[], integer, text)
  from public, anon;

grant execute on function public.enqueue_task_inference(uuid)
  to authenticated;
grant execute on function public.create_task_correction(uuid, text, uuid[], text[], integer, text)
  to authenticated;

comment on function public.enqueue_task_inference(uuid) is
  'Authenticated analyst boundary that delegates to a private role-checking and event-validating durable enqueue function.';
comment on function public.create_task_correction(uuid, text, uuid[], text[], integer, text) is
  'Authenticated analyst boundary that delegates to private workspace, source-task, and correction-shape validation.';
