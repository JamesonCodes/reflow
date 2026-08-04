#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${REFLOW_TEST_DATABASE_URL:-}" ]]; then
  echo "REFLOW_TEST_DATABASE_URL is required." >&2
  exit 1
fi

test_dir="$(mktemp -d)"
trap 'rm -r "$test_dir"' EXIT

user_id="97000000-0000-4000-8000-000000000001"
workspace_id="98000000-0000-4000-8000-000000000001"
entity_id="99000000-0000-4000-8000-000000000001"

cleanup_sql="
delete from public.workspaces where id = '${workspace_id}';
delete from auth.users where id = '${user_id}';
"

psql "$REFLOW_TEST_DATABASE_URL" --set ON_ERROR_STOP=on --quiet <<SQL
${cleanup_sql}
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '${user_id}',
  'authenticated',
  'authenticated',
  'phase1-job-test@reflow.invalid',
  '',
  '{}',
  '{}',
  now(),
  now(),
  false
);
insert into public.workspaces (id, name, created_by)
values ('${workspace_id}', 'Phase 1 Job Claim Test', '${user_id}');
insert into public.processing_jobs (workspace_id, job_type, entity_id)
values ('${workspace_id}', 'session_aggregation', '${entity_id}');
SQL

claim_sql="
begin;
set local role service_role;
select id from public.claim_processing_jobs('phase1-worker', array['session_aggregation'], 1);
select pg_sleep(2);
commit;
"

psql "$REFLOW_TEST_DATABASE_URL" --set ON_ERROR_STOP=on --tuples-only --no-align \
  --command "$claim_sql" >"$test_dir/claim-a.txt" &
claim_a_pid=$!

psql "$REFLOW_TEST_DATABASE_URL" --set ON_ERROR_STOP=on --tuples-only --no-align \
  --command "$claim_sql" >"$test_dir/claim-b.txt" &
claim_b_pid=$!

claim_failed=false
wait "$claim_a_pid" || claim_failed=true
wait "$claim_b_pid" || claim_failed=true

if [[ "$claim_failed" == "true" ]]; then
  echo "A concurrent claim query failed." >&2
  exit 1
fi

job_state="$(
  psql "$REFLOW_TEST_DATABASE_URL" --set ON_ERROR_STOP=on --tuples-only --no-align \
    --command "select status || ':' || attempt_count from public.processing_jobs where workspace_id = '${workspace_id}';"
)"

psql "$REFLOW_TEST_DATABASE_URL" --set ON_ERROR_STOP=on --quiet --command "$cleanup_sql"

if [[ "$job_state" != "running:1" ]]; then
  echo "Expected one durable claim; observed job state ${job_state}." >&2
  exit 1
fi

echo "Concurrent job claim check passed."
