create or replace function public.enqueue_process_mining(
  target_department_id uuid
)
returns public.processing_jobs
language sql
security invoker
set search_path = ''
as $$
  select private.enqueue_process_mining(target_department_id);
$$;

revoke all on function private.enqueue_process_mining(uuid)
  from public, anon, authenticated;
grant execute on function private.enqueue_process_mining(uuid)
  to authenticated;

revoke all on function public.enqueue_process_mining(uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_process_mining(uuid)
  to authenticated;

comment on function public.enqueue_process_mining(uuid) is
  'Security-invoker Data API boundary that delegates to a non-exposed private role-checking enqueue function.';
