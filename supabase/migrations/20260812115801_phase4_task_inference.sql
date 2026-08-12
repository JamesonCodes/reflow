alter table public.observation_windows
  add constraint observation_windows_workspace_identity_key
  unique (id, workspace_id);

create table public.normalized_steps (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observation_window_id uuid not null,
  step_ordinal integer not null check (step_ordinal > 0),
  step_key text not null check (step_key ~ '^[a-f0-9]{64}$'),
  action_type text not null check (
    action_type in (
      'click',
      'input',
      'submit',
      'navigate',
      'spa_navigate',
      'hash_navigate',
      'tab_activate',
      'domain_transition',
      'file_upload',
      'file_download',
      'out_of_scope_gap'
    )
  ),
  hostname text,
  normalized_path text,
  element_role text,
  element_label text,
  page_landmark text,
  semantic_input_token text,
  tab_id integer not null check (tab_id > 0),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  source_event_count integer not null check (source_event_count > 0),
  candidate_boundary_before boolean not null default false,
  boundary_reasons text[] not null default '{}',
  normalization_version integer not null check (normalization_version > 0),
  created_at timestamptz not null default now(),
  constraint normalized_steps_window_fkey
    foreign key (observation_window_id, workspace_id)
    references public.observation_windows (id, workspace_id)
    on delete cascade,
  constraint normalized_steps_timeline check (ended_at >= started_at),
  constraint normalized_steps_boundary_reasons check (
    cardinality(boundary_reasons) <= 8
    and not (candidate_boundary_before = false and cardinality(boundary_reasons) > 0)
  ),
  constraint normalized_steps_scope check (
    (
      action_type = 'out_of_scope_gap'
      and hostname is null
      and normalized_path is null
      and element_role is null
      and element_label is null
      and page_landmark is null
      and semantic_input_token is null
    )
    or (action_type <> 'out_of_scope_gap' and hostname is not null)
  ),
  unique (observation_window_id, normalization_version, step_ordinal)
);

create index normalized_steps_window_order_idx
  on public.normalized_steps (
    observation_window_id,
    normalization_version,
    step_ordinal
  );

create index normalized_steps_workspace_key_idx
  on public.normalized_steps (workspace_id, step_key);

create table public.normalized_step_events (
  normalized_step_id uuid not null references public.normalized_steps (id) on delete cascade,
  raw_event_id uuid not null references public.raw_event_tokens (id) on delete restrict,
  source_position integer not null check (source_position > 0),
  created_at timestamptz not null default now(),
  primary key (normalized_step_id, raw_event_id),
  unique (normalized_step_id, source_position)
);

create index normalized_step_events_raw_event_idx
  on public.normalized_step_events (raw_event_id, normalized_step_id);

create table public.activity_segments (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observation_window_id uuid not null,
  segment_ordinal integer not null check (segment_ordinal > 0),
  start_step_ordinal integer not null check (start_step_ordinal > 0),
  end_step_ordinal integer not null check (end_step_ordinal >= start_step_ordinal),
  boundary_reason text not null check (
    boundary_reason in ('observation_start', 'idle_5m', 'out_of_scope_gap')
  ),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  normalization_version integer not null check (normalization_version > 0),
  created_at timestamptz not null default now(),
  constraint activity_segments_window_fkey
    foreign key (observation_window_id, workspace_id)
    references public.observation_windows (id, workspace_id)
    on delete cascade,
  constraint activity_segments_timeline check (ended_at >= started_at),
  unique (observation_window_id, normalization_version, segment_ordinal)
);

create index activity_segments_window_order_idx
  on public.activity_segments (
    observation_window_id,
    normalization_version,
    segment_ordinal
  );

create table public.task_inference_runs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observation_window_id uuid not null,
  input_digest text not null check (input_digest ~ '^[a-f0-9]{64}$'),
  model text not null check (char_length(btrim(model)) between 3 and 160),
  prompt_version integer not null check (prompt_version > 0),
  normalization_version integer not null check (normalization_version > 0),
  task_count integer not null check (task_count >= 0),
  created_at timestamptz not null default now(),
  constraint task_inference_runs_window_fkey
    foreign key (observation_window_id, workspace_id)
    references public.observation_windows (id, workspace_id)
    on delete cascade,
  unique (
    observation_window_id,
    input_digest,
    model,
    prompt_version,
    normalization_version
  )
);

create index task_inference_runs_window_created_idx
  on public.task_inference_runs (observation_window_id, created_at desc);

create table public.task_instances (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observation_window_id uuid not null,
  inference_run_id uuid not null references public.task_inference_runs (id) on delete cascade,
  task_ordinal integer not null check (task_ordinal > 0),
  neutral_label text not null check (char_length(btrim(neutral_label)) between 1 and 120),
  apparent_objective text not null
    check (char_length(btrim(apparent_objective)) between 1 and 300),
  participating_systems text[] not null,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  boundary_rationale text not null
    check (char_length(btrim(boundary_rationale)) between 1 and 500),
  start_step_ordinal integer not null check (start_step_ordinal > 0),
  end_step_ordinal integer not null check (end_step_ordinal >= start_step_ordinal),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint task_instances_window_fkey
    foreign key (observation_window_id, workspace_id)
    references public.observation_windows (id, workspace_id)
    on delete cascade,
  constraint task_instances_timeline check (ended_at >= started_at),
  constraint task_instances_systems check (
    cardinality(participating_systems) between 1 and 20
  ),
  unique (inference_run_id, task_ordinal)
);

create index task_instances_window_order_idx
  on public.task_instances (observation_window_id, inference_run_id, task_ordinal);

create index task_instances_workspace_created_idx
  on public.task_instances (workspace_id, created_at desc);

create table public.task_instance_steps (
  task_instance_id uuid not null references public.task_instances (id) on delete cascade,
  normalized_step_id uuid not null references public.normalized_steps (id) on delete restrict,
  step_position integer not null check (step_position > 0),
  created_at timestamptz not null default now(),
  primary key (task_instance_id, normalized_step_id),
  unique (task_instance_id, step_position)
);

create index task_instance_steps_normalized_step_idx
  on public.task_instance_steps (normalized_step_id, task_instance_id);

create table public.task_clusters (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  cluster_key text not null check (cluster_key ~ '^[a-f0-9]{64}$'),
  canonical_label text not null
    check (char_length(btrim(canonical_label)) between 1 and 120),
  participating_systems text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_clusters_systems check (
    cardinality(participating_systems) between 1 and 20
  ),
  unique (workspace_id, cluster_key)
);

create index task_clusters_workspace_label_idx
  on public.task_clusters (workspace_id, canonical_label);

create table public.task_cluster_members (
  cluster_id uuid not null references public.task_clusters (id) on delete cascade,
  task_instance_id uuid not null references public.task_instances (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cluster_id, task_instance_id),
  unique (task_instance_id)
);

create index task_cluster_members_task_instance_idx
  on public.task_cluster_members (task_instance_id, cluster_id);

create table public.task_corrections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  correction_type text not null
    check (correction_type in ('rename', 'merge', 'split', 'reject')),
  replacement_labels text[] not null default '{}',
  split_after_step_ordinal integer check (split_after_step_ordinal > 0),
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 500),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint task_corrections_shape check (
    (correction_type = 'rename' and cardinality(replacement_labels) = 1 and split_after_step_ordinal is null)
    or (correction_type = 'merge' and cardinality(replacement_labels) = 1 and split_after_step_ordinal is null)
    or (correction_type = 'split' and cardinality(replacement_labels) = 2 and split_after_step_ordinal is not null)
    or (correction_type = 'reject' and cardinality(replacement_labels) = 0 and split_after_step_ordinal is null)
  )
);

create index task_corrections_workspace_created_idx
  on public.task_corrections (workspace_id, created_at desc);

create table public.task_correction_sources (
  correction_id uuid not null references public.task_corrections (id) on delete cascade,
  task_instance_id uuid not null references public.task_instances (id) on delete restrict,
  source_position integer not null check (source_position > 0),
  primary key (correction_id, task_instance_id),
  unique (correction_id, source_position)
);

create index task_correction_sources_task_instance_idx
  on public.task_correction_sources (task_instance_id, correction_id);

create trigger task_clusters_set_updated_at
before update on public.task_clusters
for each row execute function private.set_updated_at();

alter table public.normalized_steps enable row level security;
alter table public.normalized_step_events enable row level security;
alter table public.activity_segments enable row level security;
alter table public.task_inference_runs enable row level security;
alter table public.task_instances enable row level security;
alter table public.task_instance_steps enable row level security;
alter table public.task_clusters enable row level security;
alter table public.task_cluster_members enable row level security;
alter table public.task_corrections enable row level security;
alter table public.task_correction_sources enable row level security;

create policy normalized_steps_select_analyst
on public.normalized_steps for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));

create policy normalized_step_events_select_analyst
on public.normalized_step_events for select to authenticated
using (
  exists (
    select 1
    from public.normalized_steps as step
    where step.id = normalized_step_id
      and (select private.has_workspace_role(step.workspace_id, array['admin', 'analyst']))
  )
);

create policy activity_segments_select_analyst
on public.activity_segments for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));

create policy task_inference_runs_select_analyst
on public.task_inference_runs for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));

create policy task_instances_select_analyst
on public.task_instances for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));

create policy task_instance_steps_select_analyst
on public.task_instance_steps for select to authenticated
using (
  exists (
    select 1
    from public.task_instances as task
    where task.id = task_instance_id
      and (select private.has_workspace_role(task.workspace_id, array['admin', 'analyst']))
  )
);

create policy task_clusters_select_analyst
on public.task_clusters for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));

create policy task_cluster_members_select_analyst
on public.task_cluster_members for select to authenticated
using (
  exists (
    select 1
    from public.task_clusters as cluster
    where cluster.id = cluster_id
      and (select private.has_workspace_role(cluster.workspace_id, array['admin', 'analyst']))
  )
);

create policy task_corrections_select_analyst
on public.task_corrections for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));

create policy task_correction_sources_select_analyst
on public.task_correction_sources for select to authenticated
using (
  exists (
    select 1
    from public.task_corrections as correction
    where correction.id = correction_id
      and (select private.has_workspace_role(correction.workspace_id, array['admin', 'analyst']))
  )
);

create or replace function private.enqueue_task_inference(
  target_observation_window_id uuid
)
returns public.processing_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_window public.observation_windows;
  queued_job public.processing_jobs;
begin
  select observation_window.*
  into target_window
  from public.observation_windows as observation_window
  where observation_window.id = target_observation_window_id;

  if not found
    or not private.has_workspace_role(
      target_window.workspace_id,
      array['admin', 'analyst']
    ) then
    raise exception 'observation_not_found' using errcode = '42501';
  end if;

  if target_window.status <> 'completed' then
    raise exception 'completed_observation_required' using errcode = '22023';
  end if;

  insert into public.processing_jobs (
    workspace_id,
    job_type,
    entity_id
  )
  values (
    target_window.workspace_id,
    'task_inference',
    target_window.id
  )
  on conflict (workspace_id, job_type, entity_id)
    where status in ('queued', 'running')
  do update set updated_at = now()
  returning * into queued_job;

  return queued_job;
end;
$$;

create or replace function public.enqueue_task_inference(
  target_observation_window_id uuid
)
returns public.processing_jobs
language sql
security invoker
set search_path = ''
as $$
  select private.enqueue_task_inference(target_observation_window_id);
$$;

create or replace function public.complete_processing_job(
  target_job_id bigint,
  target_lock_token uuid
)
returns public.processing_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_job public.processing_jobs;
begin
  update public.processing_jobs
  set
    status = 'succeeded',
    locked_at = null,
    lock_token = null,
    locked_by = null,
    error_code = null,
    error_detail = null,
    updated_at = now()
  where id = target_job_id
    and status = 'running'
    and lock_token = target_lock_token
  returning * into completed_job;

  if not found then
    raise exception 'processing_job_lock_mismatch' using errcode = '40001';
  end if;

  return completed_job;
end;
$$;

create or replace function public.fail_processing_job(
  target_job_id bigint,
  target_lock_token uuid,
  target_error_code text,
  target_error_detail text,
  retryable boolean default false
)
returns public.processing_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failed_job public.processing_jobs;
begin
  update public.processing_jobs
  set
    status = case
      when retryable and attempt_count < max_attempts then 'queued'
      else 'failed'
    end,
    available_at = case
      when retryable and attempt_count < max_attempts
        then now() + make_interval(secs => least(300, 2 ^ attempt_count))
      else available_at
    end,
    locked_at = null,
    lock_token = null,
    locked_by = null,
    error_code = left(coalesce(nullif(btrim(target_error_code), ''), 'unknown_error'), 80),
    error_detail = left(nullif(btrim(target_error_detail), ''), 500),
    updated_at = now()
  where id = target_job_id
    and status = 'running'
    and lock_token = target_lock_token
  returning * into failed_job;

  if not found then
    raise exception 'processing_job_lock_mismatch' using errcode = '40001';
  end if;

  return failed_job;
end;
$$;

create or replace function private.create_task_correction(
  target_workspace_id uuid,
  target_correction_type text,
  target_task_instance_ids uuid[],
  target_replacement_labels text[],
  target_split_after_step_ordinal integer,
  target_reason text
)
returns public.task_corrections
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_correction public.task_corrections;
  source_count integer;
  source_task public.task_instances;
  source_position integer := 0;
  source_task_id uuid;
begin
  if not private.has_workspace_role(target_workspace_id, array['admin', 'analyst']) then
    raise exception 'analyst_required' using errcode = '42501';
  end if;

  source_count := cardinality(target_task_instance_ids);
  if source_count is null or source_count = 0 then
    raise exception 'task_sources_required' using errcode = '22023';
  end if;
  if target_correction_type = 'merge' and source_count < 2 then
    raise exception 'merge_requires_multiple_tasks' using errcode = '22023';
  end if;
  if target_correction_type <> 'merge' and source_count <> 1 then
    raise exception 'single_task_source_required' using errcode = '22023';
  end if;

  foreach source_task_id in array target_task_instance_ids loop
    select task.*
    into source_task
    from public.task_instances as task
    where task.id = source_task_id
      and task.workspace_id = target_workspace_id;
    if not found then
      raise exception 'task_source_not_found' using errcode = '22023';
    end if;
  end loop;

  insert into public.task_corrections (
    workspace_id,
    correction_type,
    replacement_labels,
    split_after_step_ordinal,
    reason,
    created_by
  )
  values (
    target_workspace_id,
    target_correction_type,
    coalesce(target_replacement_labels, '{}'),
    target_split_after_step_ordinal,
    nullif(btrim(target_reason), ''),
    (select auth.uid())
  )
  returning * into created_correction;

  foreach source_task_id in array target_task_instance_ids loop
    source_position := source_position + 1;
    insert into public.task_correction_sources (
      correction_id,
      task_instance_id,
      source_position
    )
    values (created_correction.id, source_task_id, source_position);
  end loop;

  return created_correction;
end;
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
security invoker
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

revoke all on public.normalized_steps from anon, authenticated;
revoke all on public.normalized_step_events from anon, authenticated;
revoke all on public.activity_segments from anon, authenticated;
revoke all on public.task_inference_runs from anon, authenticated;
revoke all on public.task_instances from anon, authenticated;
revoke all on public.task_instance_steps from anon, authenticated;
revoke all on public.task_clusters from anon, authenticated;
revoke all on public.task_cluster_members from anon, authenticated;
revoke all on public.task_corrections from anon, authenticated;
revoke all on public.task_correction_sources from anon, authenticated;

grant select on public.normalized_steps to authenticated;
grant select on public.normalized_step_events to authenticated;
grant select on public.activity_segments to authenticated;
grant select on public.task_inference_runs to authenticated;
grant select on public.task_instances to authenticated;
grant select on public.task_instance_steps to authenticated;
grant select on public.task_clusters to authenticated;
grant select on public.task_cluster_members to authenticated;
grant select on public.task_corrections to authenticated;
grant select on public.task_correction_sources to authenticated;

grant all on public.normalized_steps to service_role;
grant all on public.normalized_step_events to service_role;
grant all on public.activity_segments to service_role;
grant all on public.task_inference_runs to service_role;
grant all on public.task_instances to service_role;
grant all on public.task_instance_steps to service_role;
grant all on public.task_clusters to service_role;
grant all on public.task_cluster_members to service_role;
grant all on public.task_corrections to service_role;
grant all on public.task_correction_sources to service_role;

revoke all on function private.enqueue_task_inference(uuid)
  from public, anon, authenticated;
revoke all on function private.create_task_correction(uuid, text, uuid[], text[], integer, text)
  from public, anon, authenticated;
revoke all on function public.enqueue_task_inference(uuid)
  from public, anon;
revoke all on function public.create_task_correction(uuid, text, uuid[], text[], integer, text)
  from public, anon;
revoke all on function public.complete_processing_job(bigint, uuid)
  from public, anon, authenticated;
revoke all on function public.fail_processing_job(bigint, uuid, text, text, boolean)
  from public, anon, authenticated;

grant execute on function private.enqueue_task_inference(uuid) to authenticated;
grant execute on function private.create_task_correction(uuid, text, uuid[], text[], integer, text)
  to authenticated;
grant execute on function public.enqueue_task_inference(uuid) to authenticated;
grant execute on function public.create_task_correction(uuid, text, uuid[], text[], integer, text)
  to authenticated;
grant execute on function public.complete_processing_job(bigint, uuid)
  to service_role;
grant execute on function public.fail_processing_job(bigint, uuid, text, text, boolean)
  to service_role;

comment on table public.normalized_steps is
  'Deterministic browser-action steps derived from immutable sanitized source events.';
comment on column public.normalized_steps.id is
  'Stable UUID derived from the observation window, normalization version, and step ordinal.';
comment on column public.normalized_steps.workspace_id is
  'Workspace that owns the derived step.';
comment on column public.normalized_steps.observation_window_id is
  'Completed observation window from which the step was derived.';
comment on column public.normalized_steps.step_ordinal is
  'One-based deterministic order of the step within its observation window.';
comment on column public.normalized_steps.step_key is
  'SHA-256 signature of the normalized action fields used for repeat matching.';
comment on column public.normalized_steps.action_type is
  'Sanitized browser action represented by the normalized step.';
comment on column public.normalized_steps.hostname is
  'Approved hostname, or null only for an anonymous out-of-scope gap.';
comment on column public.normalized_steps.normalized_path is
  'Privacy-safe browser path with dynamic identifiers generalized.';
comment on column public.normalized_steps.element_role is
  'Bounded semantic role of the interacted browser control.';
comment on column public.normalized_steps.element_label is
  'Bounded sanitized label for the interacted browser control.';
comment on column public.normalized_steps.page_landmark is
  'Bounded sanitized page region containing the interaction.';
comment on column public.normalized_steps.semantic_input_token is
  'Semantic classification of an input without its raw value.';
comment on column public.normalized_steps.tab_id is
  'Observation-local tab identifier assigned by the extension.';
comment on column public.normalized_steps.started_at is
  'Browser timestamp of the first source event collapsed into the step.';
comment on column public.normalized_steps.ended_at is
  'Browser timestamp of the final source event collapsed into the step.';
comment on column public.normalized_steps.source_event_count is
  'Number of immutable raw events supporting the normalized step.';
comment on column public.normalized_steps.candidate_boundary_before is
  'Whether deterministic preprocessing detected a possible task boundary before this step.';
comment on column public.normalized_steps.boundary_reasons is
  'Deterministic reasons supporting the candidate task boundary.';
comment on column public.normalized_steps.normalization_version is
  'Version of deterministic preprocessing used to create the step.';
comment on column public.normalized_steps.created_at is
  'Timestamp when the derived step was persisted.';

comment on table public.normalized_step_events is
  'Evidence links from each normalized step to its immutable raw source events.';
comment on column public.normalized_step_events.normalized_step_id is
  'Normalized step supported by the source event.';
comment on column public.normalized_step_events.raw_event_id is
  'Immutable sanitized source event supporting the normalized step.';
comment on column public.normalized_step_events.source_position is
  'One-based source-event order within the normalized step.';
comment on column public.normalized_step_events.created_at is
  'Timestamp when the evidence link was persisted.';

comment on table public.activity_segments is
  'Deterministic hard-boundary activity segments prepared for task inference.';
comment on column public.activity_segments.id is
  'Stable UUID derived from the observation window, version, and segment ordinal.';
comment on column public.activity_segments.workspace_id is
  'Workspace that owns the activity segment.';
comment on column public.activity_segments.observation_window_id is
  'Observation window containing the segment.';
comment on column public.activity_segments.segment_ordinal is
  'One-based deterministic order of the segment within the observation.';
comment on column public.activity_segments.start_step_ordinal is
  'First normalized step included in the segment.';
comment on column public.activity_segments.end_step_ordinal is
  'Last normalized step included in the segment.';
comment on column public.activity_segments.boundary_reason is
  'Hard rule that started the activity segment.';
comment on column public.activity_segments.started_at is
  'Timestamp of the first normalized step in the segment.';
comment on column public.activity_segments.ended_at is
  'Timestamp of the last normalized step in the segment.';
comment on column public.activity_segments.normalization_version is
  'Version of deterministic preprocessing used to create the segment.';
comment on column public.activity_segments.created_at is
  'Timestamp when the activity segment was persisted.';

comment on table public.task_inference_runs is
  'Versioned successful AI Gateway task-inference executions over normalized browser evidence.';
comment on column public.task_inference_runs.id is
  'Stable run UUID derived from its observation, input digest, model, and versions.';
comment on column public.task_inference_runs.workspace_id is
  'Workspace that owns the inference run.';
comment on column public.task_inference_runs.observation_window_id is
  'Observation window analyzed by the inference run.';
comment on column public.task_inference_runs.input_digest is
  'SHA-256 digest of the ordered normalized input supplied to the model.';
comment on column public.task_inference_runs.model is
  'Vercel AI Gateway model identifier used for inference.';
comment on column public.task_inference_runs.prompt_version is
  'Version of the task-inference prompt and output contract.';
comment on column public.task_inference_runs.normalization_version is
  'Version of deterministic preprocessing used by this run.';
comment on column public.task_inference_runs.task_count is
  'Number of bounded task instances produced by the run.';
comment on column public.task_inference_runs.created_at is
  'Timestamp when the successful inference result was persisted.';

comment on table public.task_instances is
  'Original evidence-backed bounded tasks inferred from one observation window.';
comment on column public.task_instances.id is
  'Stable inferred-task UUID within an inference run.';
comment on column public.task_instances.workspace_id is
  'Workspace that owns the inferred task.';
comment on column public.task_instances.observation_window_id is
  'Source observation window containing the inferred task.';
comment on column public.task_instances.inference_run_id is
  'Versioned inference execution that created the task.';
comment on column public.task_instances.task_ordinal is
  'One-based task order within the inference run.';
comment on column public.task_instances.neutral_label is
  'Neutral model-inferred description of the observed activity.';
comment on column public.task_instances.apparent_objective is
  'Evidence-grounded apparent objective without assuming undocumented intent.';
comment on column public.task_instances.participating_systems is
  'Approved browser hostnames represented by supporting steps.';
comment on column public.task_instances.confidence is
  'Model confidence between zero and one for the inferred task boundary and label.';
comment on column public.task_instances.boundary_rationale is
  'Concise evidence-grounded explanation for the inferred task boundaries.';
comment on column public.task_instances.start_step_ordinal is
  'First normalized step supporting the task.';
comment on column public.task_instances.end_step_ordinal is
  'Last normalized step supporting the task.';
comment on column public.task_instances.started_at is
  'Timestamp of the first supporting normalized step.';
comment on column public.task_instances.ended_at is
  'Timestamp of the final supporting normalized step.';
comment on column public.task_instances.created_at is
  'Timestamp when the inferred task was persisted.';

comment on table public.task_instance_steps is
  'Ordered evidence links from inferred tasks to their supporting normalized steps.';
comment on column public.task_instance_steps.task_instance_id is
  'Inferred task supported by the normalized step.';
comment on column public.task_instance_steps.normalized_step_id is
  'Normalized browser step supporting the inferred task.';
comment on column public.task_instance_steps.step_position is
  'One-based order of the supporting step within the task.';
comment on column public.task_instance_steps.created_at is
  'Timestamp when the task evidence link was persisted.';

comment on table public.task_clusters is
  'Recurring task groups built from deterministic task signatures.';
comment on column public.task_clusters.id is
  'Stable UUID derived from the workspace and deterministic cluster signature.';
comment on column public.task_clusters.workspace_id is
  'Workspace that owns the recurring task cluster.';
comment on column public.task_clusters.cluster_key is
  'SHA-256 signature of the normalized task label and participating systems.';
comment on column public.task_clusters.canonical_label is
  'Representative neutral label shared by cluster members.';
comment on column public.task_clusters.participating_systems is
  'Sorted approved browser hostnames represented in the cluster.';
comment on column public.task_clusters.created_at is
  'Timestamp when the recurring task cluster was created.';
comment on column public.task_clusters.updated_at is
  'Timestamp when the recurring task cluster was last changed.';

comment on table public.task_cluster_members is
  'Membership links from inferred task instances to recurring task clusters.';
comment on column public.task_cluster_members.cluster_id is
  'Recurring task cluster containing the inferred instance.';
comment on column public.task_cluster_members.task_instance_id is
  'Inferred task instance assigned to the cluster.';
comment on column public.task_cluster_members.created_at is
  'Timestamp when the task instance joined the cluster.';

comment on table public.task_corrections is
  'Immutable analyst correction overlays that preserve original model inference.';
comment on column public.task_corrections.id is
  'Stable UUID identifying the analyst correction.';
comment on column public.task_corrections.workspace_id is
  'Workspace in which the correction applies.';
comment on column public.task_corrections.correction_type is
  'Analyst operation: rename, merge, split, or reject.';
comment on column public.task_corrections.replacement_labels is
  'One replacement label for rename or merge, or two labels for split.';
comment on column public.task_corrections.split_after_step_ordinal is
  'Supporting step after which a split correction divides the source task.';
comment on column public.task_corrections.reason is
  'Optional bounded analyst rationale for the correction.';
comment on column public.task_corrections.created_by is
  'Authenticated administrator or analyst who created the correction.';
comment on column public.task_corrections.created_at is
  'Timestamp when the analyst correction was recorded.';

comment on table public.task_correction_sources is
  'Ordered links from an analyst correction to the original inferred task instances.';
comment on column public.task_correction_sources.correction_id is
  'Analyst correction that references the inferred task.';
comment on column public.task_correction_sources.task_instance_id is
  'Original inferred task retained as evidence for the correction.';
comment on column public.task_correction_sources.source_position is
  'One-based order of the source task within a merge or other correction.';

comment on function public.enqueue_task_inference(uuid) is
  'Queues an idempotent durable task-inference job for a completed observation visible to an analyst.';
comment on function public.complete_processing_job(bigint, uuid) is
  'Completes a running processing job only when the supplied durable lock token matches.';
comment on function public.fail_processing_job(bigint, uuid, text, text, boolean) is
  'Fails or retries a running processing job while preserving a bounded visible error.';
comment on function public.create_task_correction(uuid, text, uuid[], text[], integer, text) is
  'Creates a transactional analyst correction overlay without mutating original inferred tasks.';
