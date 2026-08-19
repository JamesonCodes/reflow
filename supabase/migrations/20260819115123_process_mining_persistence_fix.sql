do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(procedure.oid)
  into function_definition
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'persist_process_mining_result'
    and pg_get_function_identity_arguments(procedure.oid) =
      'target_run_id uuid, target_workspace_id uuid, target_department_id uuid, target_input_digest text, target_model text, target_prompt_version integer, target_algorithm_version integer, target_snapshots jsonb, target_instances jsonb, target_unmatched jsonb, target_candidates jsonb';

  if function_definition is null then
    raise exception 'persist_process_mining_result_not_found';
  end if;

  function_definition := replace(
    function_definition,
    'min(instance_row.id) as representative_id',
    '(array_agg(instance_row.id order by instance_row.id::text))[1] as representative_id'
  );
  execute function_definition;
end;
$$;
