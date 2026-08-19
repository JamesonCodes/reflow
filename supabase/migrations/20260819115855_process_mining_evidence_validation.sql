do $$
declare
  function_definition text;
  validation_sql text := $validation$
  if exists (
    select 1
    from public.process_task_snapshot_sources as source_link
    join public.process_task_snapshots as snapshot on snapshot.id = source_link.task_snapshot_id
    join public.task_instances as source_task on source_task.id = source_link.task_instance_id
    where snapshot.mining_run_id = target_run_id
      and (source_task.workspace_id <> target_workspace_id
        or source_task.observation_window_id <> snapshot.observation_window_id)
  ) then raise exception 'invalid_process_task_source_evidence' using errcode = '22023'; end if;
  if exists (
    select 1
    from public.process_instances as process_instance
    cross join lateral unnest(process_instance.task_snapshot_ids) as evidence(snapshot_id)
    left join public.process_task_snapshots as snapshot
      on snapshot.id = evidence.snapshot_id
      and snapshot.mining_run_id = target_run_id
      and snapshot.observation_window_id = process_instance.observation_window_id
    where process_instance.mining_run_id = target_run_id and snapshot.id is null
  ) then raise exception 'invalid_process_instance_evidence' using errcode = '22023'; end if;
  if exists (
    select 1
    from public.process_unmatched_work as unmatched_work
    cross join lateral unnest(unmatched_work.task_snapshot_ids) as evidence(snapshot_id)
    left join public.process_task_snapshots as snapshot
      on snapshot.id = evidence.snapshot_id
      and snapshot.mining_run_id = target_run_id
      and snapshot.observation_window_id = unmatched_work.observation_window_id
    where unmatched_work.mining_run_id = target_run_id and snapshot.id is null
  ) then raise exception 'invalid_unmatched_process_evidence' using errcode = '22023'; end if;
  if exists (
    select 1
    from public.process_findings as process_finding
    join public.process_candidates as candidate on candidate.id = process_finding.process_candidate_id
    cross join lateral unnest(process_finding.evidence_task_snapshot_ids) as evidence(snapshot_id)
    left join public.process_task_snapshots as snapshot
      on snapshot.id = evidence.snapshot_id and snapshot.mining_run_id = target_run_id
    where candidate.mining_run_id = target_run_id and snapshot.id is null
  ) then raise exception 'invalid_process_finding_evidence' using errcode = '22023'; end if;
$validation$;
begin
  select pg_get_functiondef(procedure.oid)
  into function_definition
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = 'persist_process_mining_result';

  if function_definition is null then
    raise exception 'persist_process_mining_result_not_found';
  end if;

  if position('invalid_process_task_source_evidence' in function_definition) = 0 then
    function_definition := replace(
      function_definition,
      E'  return target_run_id;\nend;',
      validation_sql || E'\n  return target_run_id;\nend;'
    );
  end if;
  execute function_definition;
end;
$$;
