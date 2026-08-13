do $migration$
declare
  function_definition text;
  corrected_definition text;
begin
  select pg_get_functiondef(
    'public.persist_task_inference_result_v2_inner(uuid,uuid,text,text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure
  ) into function_definition;

  corrected_definition := replace(
    function_definition,
    'select public.persist_task_inference_result(
    target_run_id,
    target_observation_window_id,
    target_input_digest,
    target_model,
    target_prompt_version,
    target_normalization_version,
    target_steps,
    target_segments,
    target_tasks
  ) into persisted_run;',
    'select result.*
  into persisted_run
  from public.persist_task_inference_result(
    target_run_id,
    target_observation_window_id,
    target_input_digest,
    target_model,
    target_prompt_version,
    target_normalization_version,
    target_steps,
    target_segments,
    target_tasks
  ) as result;'
  );

  if corrected_definition = function_definition then
    raise exception 'phase4a_inner_function_patch_not_applied';
  end if;
  execute corrected_definition;
end;
$migration$;

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
  'Idempotently returns an existing version-2 inference or transactionally persists complete task and exclusion evidence.';
