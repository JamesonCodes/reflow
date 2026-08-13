alter table public.normalized_steps
  drop constraint normalized_steps_v2_interaction_group;

create or replace function public.persist_task_inference_result_v2(
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

  select result.*
  into persisted_run
  from public.persist_task_inference_result_v2_inner(
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
  ) as result;

  if exists (
    select 1
    from public.normalized_steps as step
    where step.observation_window_id = target_observation_window_id
      and step.normalization_version = target_normalization_version
      and step.interaction_group_id is null
  ) then
    raise exception 'v2_interaction_group_required' using errcode = '22023';
  end if;

  return persisted_run;
end;
$$;

revoke all on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) is
  'Idempotently persists version-2 inference and rejects the transaction unless every normalized step has an interaction group.';
