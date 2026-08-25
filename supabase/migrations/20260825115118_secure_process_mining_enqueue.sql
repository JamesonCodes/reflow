create or replace function private.enqueue_process_mining(
  target_department_id uuid
)
returns public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  queued_job public.processing_jobs;
begin
  select department.workspace_id
  into target_workspace_id
  from public.departments as department
  where department.id = target_department_id;

  if target_workspace_id is null
    or not (select private.has_workspace_role(
      target_workspace_id,
      array['admin', 'analyst']
    )) then
    raise exception 'process_mining_forbidden' using errcode = '42501';
  end if;

  insert into public.processing_jobs (workspace_id, job_type, entity_id)
  values (target_workspace_id, 'process_mining', target_department_id)
  on conflict (workspace_id, job_type, entity_id)
    where status in ('queued', 'running')
  do update set available_at = least(public.processing_jobs.available_at, now())
  returning * into queued_job;

  return queued_job;
end;
$$;

create or replace function public.enqueue_process_mining(
  target_department_id uuid
)
returns public.processing_jobs
language sql
security definer
set search_path = ''
as $$
  select private.enqueue_process_mining(target_department_id);
$$;

revoke all on function private.enqueue_process_mining(uuid)
  from public, anon, authenticated;
revoke all on function public.enqueue_process_mining(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_process_mining(uuid)
  to authenticated;

comment on function private.enqueue_process_mining(uuid) is
  'Privileged internal process-mining enqueue that validates the caller as a workspace administrator or analyst before inserting a durable job.';
comment on function public.enqueue_process_mining(uuid) is
  'Authenticated analyst boundary that delegates to the private role-checking process-mining enqueue function.';
