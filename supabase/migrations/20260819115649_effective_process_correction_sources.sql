do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(procedure.oid)
  into function_definition
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private'
    and procedure.proname = 'create_process_candidate_correction';

  if function_definition is null then
    raise exception 'create_process_candidate_correction_not_found';
  end if;

  function_definition := replace(
    function_definition,
    'candidate_count = 1',
    'candidate_count >= 1'
  );
  function_definition := replace(
    function_definition,
    'member.process_candidate_id = target_process_candidate_ids[1]',
    'member.process_candidate_id = any(target_process_candidate_ids)'
  );
  function_definition := replace(
    function_definition,
    ') <> cardinality(target_selected_process_instance_ids) then',
    ') <> cardinality(target_selected_process_instance_ids)
      or cardinality(target_selected_process_instance_ids) >= (
        select count(*) from public.process_candidate_instances as member
        where member.process_candidate_id = any(target_process_candidate_ids)
      ) then'
  );
  execute function_definition;
end;
$$;
