-- The public wrapper is callable only by service_role. Definer execution lets
-- it cross the deliberately private schema boundary without granting broad
-- schema usage to the service role or any Data API user.
alter function public.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) security definer;

revoke all on function public.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on function public.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) is
  'Service-role-only transactional persistence wrapper for validated Phase 5A mining results.';
