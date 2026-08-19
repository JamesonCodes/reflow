create table public.process_mining_runs (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  department_id uuid not null,
  input_digest text not null check (input_digest ~ '^[a-f0-9]{64}$'),
  model text not null check (char_length(btrim(model)) between 3 and 160),
  prompt_version integer not null check (prompt_version > 0),
  algorithm_version integer not null check (algorithm_version > 0),
  task_snapshot_count integer not null check (task_snapshot_count >= 0),
  process_instance_count integer not null check (process_instance_count >= 0),
  process_candidate_count integer not null check (process_candidate_count >= 0),
  created_at timestamptz not null default now(),
  constraint process_mining_runs_department_fkey
    foreign key (workspace_id, department_id)
    references public.departments (workspace_id, id)
    on delete cascade,
  unique (workspace_id, department_id, input_digest, model, prompt_version, algorithm_version)
);

create index process_mining_runs_department_created_idx
  on public.process_mining_runs (workspace_id, department_id, created_at desc);

create table public.process_task_snapshots (
  id uuid primary key,
  mining_run_id uuid not null references public.process_mining_runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observation_window_id uuid not null,
  department_id uuid not null,
  department_snapshot text not null check (char_length(btrim(department_snapshot)) between 1 and 120),
  role_snapshot text check (role_snapshot is null or char_length(btrim(role_snapshot)) between 1 and 120),
  task_ordinal integer not null check (task_ordinal > 0),
  hard_segment_ordinal integer not null check (hard_segment_ordinal > 0),
  neutral_label text not null check (char_length(btrim(neutral_label)) between 1 and 120),
  apparent_objective text not null check (char_length(btrim(apparent_objective)) between 1 and 300),
  participating_systems text[] not null check (cardinality(participating_systems) between 1 and 20),
  start_step_ordinal integer not null check (start_step_ordinal > 0),
  end_step_ordinal integer not null check (end_step_ordinal >= start_step_ordinal),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  feature_signature text not null check (feature_signature ~ '^[a-f0-9]{64}$'),
  cluster_key text not null check (cluster_key ~ '^[a-f0-9]{64}$'),
  feature_tokens jsonb not null check (jsonb_typeof(feature_tokens) = 'array'),
  source_correction_id uuid references public.task_corrections (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint process_task_snapshots_window_fkey
    foreign key (observation_window_id, workspace_id)
    references public.observation_windows (id, workspace_id)
    on delete cascade,
  constraint process_task_snapshots_department_fkey
    foreign key (workspace_id, department_id)
    references public.departments (workspace_id, id)
    on delete cascade,
  constraint process_task_snapshots_timeline check (ended_at >= started_at),
  unique (mining_run_id, observation_window_id, task_ordinal)
);

create index process_task_snapshots_run_cluster_idx
  on public.process_task_snapshots (mining_run_id, cluster_key);
create index process_task_snapshots_window_idx
  on public.process_task_snapshots (observation_window_id, mining_run_id);
create index process_task_snapshots_source_correction_idx
  on public.process_task_snapshots (source_correction_id) where source_correction_id is not null;

create table public.process_task_snapshot_sources (
  task_snapshot_id uuid not null references public.process_task_snapshots (id) on delete cascade,
  task_instance_id uuid not null references public.task_instances (id) on delete restrict,
  source_position integer not null check (source_position > 0),
  primary key (task_snapshot_id, task_instance_id),
  unique (task_snapshot_id, source_position)
);

create index process_task_snapshot_sources_instance_idx
  on public.process_task_snapshot_sources (task_instance_id, task_snapshot_id);

create table public.process_instances (
  id uuid primary key,
  mining_run_id uuid not null references public.process_mining_runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observation_window_id uuid not null,
  neutral_label text not null check (char_length(btrim(neutral_label)) between 1 and 140),
  apparent_outcome text not null check (char_length(btrim(apparent_outcome)) between 1 and 400),
  boundary_rationale text not null check (char_length(btrim(boundary_rationale)) between 1 and 500),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds numeric not null check (duration_seconds >= 0),
  cluster_sequence text[] not null check (cardinality(cluster_sequence) > 0),
  task_snapshot_ids uuid[] not null check (cardinality(task_snapshot_ids) > 0),
  department_snapshot text not null check (char_length(btrim(department_snapshot)) between 1 and 120),
  role_snapshot text check (role_snapshot is null or char_length(btrim(role_snapshot)) between 1 and 120),
  created_at timestamptz not null default now(),
  constraint process_instances_window_fkey
    foreign key (observation_window_id, workspace_id)
    references public.observation_windows (id, workspace_id)
    on delete cascade,
  constraint process_instances_timeline check (ended_at >= started_at)
);

create index process_instances_run_window_idx
  on public.process_instances (mining_run_id, observation_window_id, started_at);

create table public.process_unmatched_work (
  id uuid primary key default gen_random_uuid(),
  mining_run_id uuid not null references public.process_mining_runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observation_window_id uuid not null,
  classification text not null check (classification in ('standalone_work', 'noise', 'uncertain')),
  reason text not null check (char_length(btrim(reason)) between 1 and 500),
  task_snapshot_ids uuid[] not null check (cardinality(task_snapshot_ids) > 0),
  created_at timestamptz not null default now(),
  constraint process_unmatched_work_window_fkey
    foreign key (observation_window_id, workspace_id)
    references public.observation_windows (id, workspace_id)
    on delete cascade
);

create index process_unmatched_work_run_idx
  on public.process_unmatched_work (mining_run_id, classification);

create table public.process_candidates (
  id uuid primary key,
  mining_run_id uuid not null references public.process_mining_runs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  candidate_key text not null check (candidate_key ~ '^[a-f0-9]{64}$'),
  neutral_label text not null check (char_length(btrim(neutral_label)) between 1 and 140),
  apparent_outcome text not null check (char_length(btrim(apparent_outcome)) between 1 and 400),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  participating_systems text[] not null check (cardinality(participating_systems) between 1 and 20),
  canonical_cluster_sequence text[] not null check (cardinality(canonical_cluster_sequence) > 0),
  instance_count integer not null check (instance_count >= 2),
  observation_count integer not null check (observation_count > 0),
  variant_count integer not null check (variant_count > 0),
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  created_at timestamptz not null default now(),
  unique (mining_run_id, candidate_key)
);

create index process_candidates_run_created_idx
  on public.process_candidates (mining_run_id, created_at, id);

create table public.process_candidate_instances (
  process_candidate_id uuid not null references public.process_candidates (id) on delete cascade,
  process_instance_id uuid not null references public.process_instances (id) on delete restrict,
  source_position integer not null check (source_position > 0),
  primary key (process_candidate_id, process_instance_id),
  unique (process_candidate_id, source_position),
  unique (process_instance_id)
);

create table public.process_variants (
  id uuid primary key,
  process_candidate_id uuid not null references public.process_candidates (id) on delete cascade,
  variant_key text not null check (variant_key ~ '^[a-f0-9]{64}$'),
  cluster_sequence text[] not null check (cardinality(cluster_sequence) > 0),
  occurrence_count integer not null check (occurrence_count > 0),
  representative_process_instance_id uuid not null references public.process_instances (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (process_candidate_id, variant_key)
);

create index process_variants_representative_idx
  on public.process_variants (representative_process_instance_id);

create table public.process_graph_edges (
  id uuid primary key,
  process_candidate_id uuid not null references public.process_candidates (id) on delete cascade,
  source_cluster_key text not null check (source_cluster_key ~ '^[a-f0-9]{64}$'),
  target_cluster_key text not null check (target_cluster_key ~ '^[a-f0-9]{64}$'),
  occurrence_count integer not null check (occurrence_count > 0),
  median_transition_seconds numeric not null check (median_transition_seconds >= 0),
  unique (process_candidate_id, source_cluster_key, target_cluster_key)
);

create table public.process_findings (
  id uuid primary key,
  process_candidate_id uuid not null references public.process_candidates (id) on delete cascade,
  finding_type text not null check (finding_type in ('loop', 'backtracking', 'repeated_entry', 'navigation_churn', 'long_wait', 'possible_abandonment', 'role_difference')),
  severity text not null check (severity in ('low', 'medium', 'high')),
  summary text not null check (char_length(btrim(summary)) between 1 and 300),
  evidence_task_snapshot_ids uuid[] not null check (cardinality(evidence_task_snapshot_ids) > 0),
  evidence_observation_window_ids uuid[] not null check (cardinality(evidence_observation_window_ids) > 0),
  created_at timestamptz not null default now()
);

create index process_findings_candidate_type_idx
  on public.process_findings (process_candidate_id, finding_type);

create table public.process_candidate_corrections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  mining_run_id uuid not null references public.process_mining_runs (id) on delete cascade,
  correction_type text not null check (correction_type in ('rename', 'merge', 'split', 'reject', 'confirm')),
  replacement_labels text[] not null default '{}',
  selected_process_instance_ids uuid[] not null default '{}',
  reason text check (reason is null or char_length(btrim(reason)) between 1 and 500),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint process_candidate_corrections_shape check (
    (correction_type = 'rename' and cardinality(replacement_labels) = 1 and cardinality(selected_process_instance_ids) = 0)
    or (correction_type = 'merge' and cardinality(replacement_labels) = 1 and cardinality(selected_process_instance_ids) = 0)
    or (correction_type = 'split' and cardinality(replacement_labels) = 2 and cardinality(selected_process_instance_ids) > 0)
    or (correction_type in ('reject', 'confirm') and cardinality(replacement_labels) = 0 and cardinality(selected_process_instance_ids) = 0)
  )
);

create index process_candidate_corrections_run_created_idx
  on public.process_candidate_corrections (mining_run_id, created_at desc);

create table public.process_candidate_correction_sources (
  correction_id uuid not null references public.process_candidate_corrections (id) on delete cascade,
  process_candidate_id uuid not null references public.process_candidates (id) on delete restrict,
  source_position integer not null check (source_position > 0),
  primary key (correction_id, process_candidate_id),
  unique (correction_id, source_position)
);

create index process_candidate_correction_sources_candidate_idx
  on public.process_candidate_correction_sources (process_candidate_id, correction_id);

create or replace function public.enqueue_process_mining(target_department_id uuid)
returns public.processing_jobs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_workspace_id uuid;
  queued_job public.processing_jobs;
begin
  select department.workspace_id into target_workspace_id
  from public.departments as department
  where department.id = target_department_id;
  if target_workspace_id is null
    or not (select private.has_workspace_role(target_workspace_id, array['admin', 'analyst'])) then
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

create or replace function private.create_process_candidate_correction(
  target_workspace_id uuid,
  target_mining_run_id uuid,
  target_correction_type text,
  target_process_candidate_ids uuid[],
  target_selected_process_instance_ids uuid[] default '{}',
  target_replacement_labels text[] default '{}',
  target_reason text default null
)
returns public.process_candidate_corrections
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_correction public.process_candidate_corrections;
  candidate_count integer := cardinality(target_process_candidate_ids);
  source_candidate_id uuid;
  source_position integer := 0;
begin
  if actor_id is null
    or not (select private.has_workspace_role(target_workspace_id, array['admin', 'analyst'])) then
    raise exception 'process_candidate_correction_forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.process_mining_runs as run
    where run.id = target_mining_run_id and run.workspace_id = target_workspace_id
  ) then raise exception 'invalid_process_mining_run' using errcode = '22023'; end if;
  if candidate_count is null or candidate_count = 0
    or (select count(*) from public.process_candidates as candidate
        where candidate.id = any(target_process_candidate_ids)
          and candidate.mining_run_id = target_mining_run_id
          and candidate.workspace_id = target_workspace_id) <> candidate_count then
    raise exception 'invalid_process_candidate_sources' using errcode = '22023';
  end if;
  if (target_correction_type = 'rename' and not (candidate_count >= 1 and cardinality(target_replacement_labels) = 1 and cardinality(target_selected_process_instance_ids) = 0))
    or (target_correction_type = 'merge' and not (candidate_count >= 2 and cardinality(target_replacement_labels) = 1 and cardinality(target_selected_process_instance_ids) = 0))
    or (target_correction_type = 'split' and not (candidate_count >= 1 and cardinality(target_replacement_labels) = 2 and cardinality(target_selected_process_instance_ids) > 0))
    or (target_correction_type in ('reject', 'confirm') and not (candidate_count >= 1 and cardinality(target_replacement_labels) = 0 and cardinality(target_selected_process_instance_ids) = 0))
    or target_correction_type not in ('rename', 'merge', 'split', 'reject', 'confirm') then
    raise exception 'invalid_process_candidate_correction_shape' using errcode = '22023';
  end if;
  if target_correction_type = 'split' and (
    select count(*) from public.process_candidate_instances as member
    where member.process_candidate_id = any(target_process_candidate_ids)
      and member.process_instance_id = any(target_selected_process_instance_ids)
  ) <> cardinality(target_selected_process_instance_ids)
    or cardinality(target_selected_process_instance_ids) >= (
      select count(*) from public.process_candidate_instances as member
      where member.process_candidate_id = any(target_process_candidate_ids)
    ) then
    raise exception 'invalid_split_process_instances' using errcode = '22023';
  end if;
  insert into public.process_candidate_corrections (
    workspace_id, mining_run_id, correction_type, replacement_labels,
    selected_process_instance_ids, reason, created_by
  ) values (
    target_workspace_id, target_mining_run_id, target_correction_type,
    target_replacement_labels, target_selected_process_instance_ids,
    target_reason, actor_id
  ) returning * into created_correction;
  foreach source_candidate_id in array target_process_candidate_ids loop
    source_position := source_position + 1;
    insert into public.process_candidate_correction_sources
      (correction_id, process_candidate_id, source_position)
    values (created_correction.id, source_candidate_id, source_position);
  end loop;
  return created_correction;
end;
$$;

create or replace function public.create_process_candidate_correction(
  target_workspace_id uuid,
  target_mining_run_id uuid,
  target_correction_type text,
  target_process_candidate_ids uuid[],
  target_selected_process_instance_ids uuid[] default '{}',
  target_replacement_labels text[] default '{}',
  target_reason text default null
)
returns public.process_candidate_corrections
language sql
security invoker
set search_path = ''
as $$
  select private.create_process_candidate_correction(
    target_workspace_id, target_mining_run_id, target_correction_type,
    target_process_candidate_ids, target_selected_process_instance_ids,
    target_replacement_labels, target_reason
  );
$$;

create or replace function public.persist_process_mining_result(
  target_run_id uuid,
  target_workspace_id uuid,
  target_department_id uuid,
  target_input_digest text,
  target_model text,
  target_prompt_version integer,
  target_algorithm_version integer,
  target_snapshots jsonb,
  target_instances jsonb,
  target_unmatched jsonb,
  target_candidates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate jsonb;
  edge jsonb;
  finding jsonb;
  instance jsonb;
  snapshot jsonb;
  unmatched jsonb;
  variant record;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'process_mining_persistence_forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.process_mining_runs where id = target_run_id) then return target_run_id; end if;
  if not exists (
    select 1 from public.departments
    where id = target_department_id and workspace_id = target_workspace_id
  ) then raise exception 'invalid_process_mining_department' using errcode = '22023'; end if;
  insert into public.process_mining_runs (
    id, workspace_id, department_id, input_digest, model, prompt_version,
    algorithm_version, task_snapshot_count, process_instance_count,
    process_candidate_count
  ) values (
    target_run_id, target_workspace_id, target_department_id, target_input_digest,
    target_model, target_prompt_version, target_algorithm_version,
    jsonb_array_length(target_snapshots), jsonb_array_length(target_instances),
    jsonb_array_length(target_candidates)
  );
  for snapshot in select value from jsonb_array_elements(target_snapshots) loop
    insert into public.process_task_snapshots (
      id, mining_run_id, workspace_id, observation_window_id, department_id,
      department_snapshot, role_snapshot, task_ordinal, hard_segment_ordinal,
      neutral_label, apparent_objective, participating_systems,
      start_step_ordinal, end_step_ordinal, started_at, ended_at, confidence,
      feature_signature, cluster_key, feature_tokens, source_correction_id
    ) values (
      (snapshot->>'id')::uuid, target_run_id, target_workspace_id,
      (snapshot->>'observation_window_id')::uuid, target_department_id,
      snapshot->>'department', snapshot->>'role', (snapshot->>'ordinal')::integer,
      (snapshot->>'hard_segment_ordinal')::integer, snapshot->>'neutral_label',
      snapshot->>'apparent_objective', array(select jsonb_array_elements_text(snapshot->'participating_systems')),
      (snapshot->>'start_step_ordinal')::integer, (snapshot->>'end_step_ordinal')::integer,
      (snapshot->>'started_at')::timestamptz, (snapshot->>'ended_at')::timestamptz,
      (snapshot->>'confidence')::numeric, snapshot->>'feature_signature',
      snapshot->>'cluster_key', snapshot->'feature_tokens',
      nullif(snapshot->>'source_correction_id', '')::uuid
    );
    insert into public.process_task_snapshot_sources (task_snapshot_id, task_instance_id, source_position)
    select (snapshot->>'id')::uuid, value::text::uuid, ordinality::integer
    from jsonb_array_elements_text(snapshot->'source_task_instance_ids') with ordinality;
  end loop;
  for instance in select value from jsonb_array_elements(target_instances) loop
    insert into public.process_instances (
      id, mining_run_id, workspace_id, observation_window_id, neutral_label,
      apparent_outcome, boundary_rationale, confidence, started_at, ended_at,
      duration_seconds, cluster_sequence, task_snapshot_ids,
      department_snapshot, role_snapshot
    ) values (
      (instance->>'id')::uuid, target_run_id, target_workspace_id,
      (instance->>'observation_window_id')::uuid, instance->>'neutral_label',
      instance->>'apparent_outcome', instance->>'boundary_rationale',
      (instance->>'confidence')::numeric, (instance->>'started_at')::timestamptz,
      (instance->>'ended_at')::timestamptz, (instance->>'duration_seconds')::numeric,
      array(select jsonb_array_elements_text(instance->'cluster_sequence')),
      array(select value::text::uuid from jsonb_array_elements_text(instance->'task_snapshot_ids')),
      instance->>'department', instance->>'role'
    );
  end loop;
  for unmatched in select value from jsonb_array_elements(target_unmatched) loop
    insert into public.process_unmatched_work (
      mining_run_id, workspace_id, observation_window_id, classification, reason, task_snapshot_ids
    ) values (
      target_run_id, target_workspace_id, (unmatched->>'observation_window_id')::uuid,
      unmatched->>'classification', unmatched->>'reason',
      array(select value::text::uuid from jsonb_array_elements_text(unmatched->'task_snapshot_ids'))
    );
  end loop;
  for candidate in select value from jsonb_array_elements(target_candidates) loop
    insert into public.process_candidates (
      id, mining_run_id, workspace_id, candidate_key, neutral_label,
      apparent_outcome, confidence, participating_systems,
      canonical_cluster_sequence, instance_count, observation_count,
      variant_count, metrics
    ) values (
      (candidate->>'id')::uuid, target_run_id, target_workspace_id,
      candidate->>'candidate_key', candidate->>'neutral_label',
      candidate->>'apparent_outcome', (candidate->>'confidence')::numeric,
      array(select jsonb_array_elements_text(candidate->'participating_systems')),
      array(select jsonb_array_elements_text(candidate->'canonical_cluster_sequence')),
      jsonb_array_length(candidate->'instance_ids'),
      (candidate->'metrics'->>'observationCount')::integer,
      (candidate->>'variant_count')::integer, candidate->'metrics'
    );
    insert into public.process_candidate_instances (process_candidate_id, process_instance_id, source_position)
    select (candidate->>'id')::uuid, value::text::uuid, ordinality::integer
    from jsonb_array_elements_text(candidate->'instance_ids') with ordinality;
    for variant in
      select md5(instance_row.cluster_sequence::text) as variant_key,
             instance_row.cluster_sequence,
             count(*)::integer as occurrence_count,
             (array_agg(instance_row.id order by instance_row.id::text))[1] as representative_id
      from public.process_instances as instance_row
      where instance_row.id = any(array(select value::text::uuid from jsonb_array_elements_text(candidate->'instance_ids')))
      group by instance_row.cluster_sequence
    loop
      insert into public.process_variants (
        id, process_candidate_id, variant_key, cluster_sequence,
        occurrence_count, representative_process_instance_id
      ) values (
        gen_random_uuid(), (candidate->>'id')::uuid,
        lpad(variant.variant_key, 64, '0'), variant.cluster_sequence,
        variant.occurrence_count, variant.representative_id
      );
    end loop;
    for edge in select value from jsonb_array_elements(candidate->'graph_edges') loop
      insert into public.process_graph_edges (
        id, process_candidate_id, source_cluster_key, target_cluster_key,
        occurrence_count, median_transition_seconds
      ) values (
        gen_random_uuid(), (candidate->>'id')::uuid, edge->>'sourceClusterKey',
        edge->>'targetClusterKey', (edge->>'occurrenceCount')::integer,
        (edge->>'medianTransitionSeconds')::numeric
      );
    end loop;
    for finding in select value from jsonb_array_elements(candidate->'findings') loop
      insert into public.process_findings (
        id, process_candidate_id, finding_type, severity, summary,
        evidence_task_snapshot_ids, evidence_observation_window_ids
      ) values (
        (finding->>'id')::uuid, (candidate->>'id')::uuid,
        finding->>'findingType', finding->>'severity', finding->>'summary',
        array(select value::text::uuid from jsonb_array_elements_text(finding->'evidenceTaskSnapshotIds')),
        array(select value::text::uuid from jsonb_array_elements_text(finding->'evidenceObservationWindowIds'))
      );
    end loop;
  end loop;
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
  return target_run_id;
end;
$$;

alter table public.process_mining_runs enable row level security;
alter table public.process_task_snapshots enable row level security;
alter table public.process_task_snapshot_sources enable row level security;
alter table public.process_instances enable row level security;
alter table public.process_unmatched_work enable row level security;
alter table public.process_candidates enable row level security;
alter table public.process_candidate_instances enable row level security;
alter table public.process_variants enable row level security;
alter table public.process_graph_edges enable row level security;
alter table public.process_findings enable row level security;
alter table public.process_candidate_corrections enable row level security;
alter table public.process_candidate_correction_sources enable row level security;

create policy process_mining_runs_select_analyst on public.process_mining_runs for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));
create policy process_task_snapshots_select_analyst on public.process_task_snapshots for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));
create policy process_task_snapshot_sources_select_analyst on public.process_task_snapshot_sources for select to authenticated
using (exists (select 1 from public.process_task_snapshots s where s.id = task_snapshot_id and (select private.has_workspace_role(s.workspace_id, array['admin', 'analyst']))));
create policy process_instances_select_analyst on public.process_instances for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));
create policy process_unmatched_work_select_analyst on public.process_unmatched_work for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));
create policy process_candidates_select_analyst on public.process_candidates for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));
create policy process_candidate_instances_select_analyst on public.process_candidate_instances for select to authenticated
using (exists (select 1 from public.process_candidates c where c.id = process_candidate_id and (select private.has_workspace_role(c.workspace_id, array['admin', 'analyst']))));
create policy process_variants_select_analyst on public.process_variants for select to authenticated
using (exists (select 1 from public.process_candidates c where c.id = process_candidate_id and (select private.has_workspace_role(c.workspace_id, array['admin', 'analyst']))));
create policy process_graph_edges_select_analyst on public.process_graph_edges for select to authenticated
using (exists (select 1 from public.process_candidates c where c.id = process_candidate_id and (select private.has_workspace_role(c.workspace_id, array['admin', 'analyst']))));
create policy process_findings_select_analyst on public.process_findings for select to authenticated
using (exists (select 1 from public.process_candidates c where c.id = process_candidate_id and (select private.has_workspace_role(c.workspace_id, array['admin', 'analyst']))));
create policy process_candidate_corrections_select_analyst on public.process_candidate_corrections for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));
create policy process_candidate_correction_sources_select_analyst on public.process_candidate_correction_sources for select to authenticated
using (exists (select 1 from public.process_candidate_corrections c where c.id = correction_id and (select private.has_workspace_role(c.workspace_id, array['admin', 'analyst']))));

revoke all on public.process_mining_runs, public.process_task_snapshots,
  public.process_task_snapshot_sources, public.process_instances,
  public.process_unmatched_work, public.process_candidates,
  public.process_candidate_instances, public.process_variants,
  public.process_graph_edges, public.process_findings,
  public.process_candidate_corrections,
  public.process_candidate_correction_sources from anon, authenticated;
grant select on public.process_mining_runs, public.process_task_snapshots,
  public.process_task_snapshot_sources, public.process_instances,
  public.process_unmatched_work, public.process_candidates,
  public.process_candidate_instances, public.process_variants,
  public.process_graph_edges, public.process_findings,
  public.process_candidate_corrections,
  public.process_candidate_correction_sources to authenticated;
grant all on public.process_mining_runs, public.process_task_snapshots,
  public.process_task_snapshot_sources, public.process_instances,
  public.process_unmatched_work, public.process_candidates,
  public.process_candidate_instances, public.process_variants,
  public.process_graph_edges, public.process_findings,
  public.process_candidate_corrections,
  public.process_candidate_correction_sources to service_role;

revoke all on function public.enqueue_process_mining(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_process_mining(uuid) to authenticated;
revoke all on function private.create_process_candidate_correction(uuid, uuid, text, uuid[], uuid[], text[], text) from public, anon, authenticated;
grant execute on function private.create_process_candidate_correction(uuid, uuid, text, uuid[], uuid[], text[], text) to authenticated;
revoke all on function public.create_process_candidate_correction(uuid, uuid, text, uuid[], uuid[], text[], text) from public, anon, authenticated;
grant execute on function public.create_process_candidate_correction(uuid, uuid, text, uuid[], uuid[], text[], text) to authenticated;
revoke all on function public.persist_process_mining_result(uuid, uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.persist_process_mining_result(uuid, uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb) to service_role;

comment on table public.process_mining_runs is 'Immutable, versioned executions that transform effective browser tasks into As-Is process evidence.';
comment on table public.process_task_snapshots is 'Frozen effective analyst-corrected tasks used by one process mining run.';
comment on table public.process_task_snapshot_sources is 'Ordered provenance links from frozen mining tasks to original inferred tasks.';
comment on table public.process_instances is 'Bounded observed executions of a browser business process.';
comment on table public.process_unmatched_work is 'Effective tasks excluded from recurring candidates as standalone, noise, or uncertain work.';
comment on table public.process_candidates is 'Recurring process candidates supported by at least two observed process instances.';
comment on table public.process_candidate_instances is 'Ordered evidence membership between a recurring candidate and its observed instances.';
comment on table public.process_variants is 'Exact task-cluster sequences observed within a process candidate.';
comment on table public.process_graph_edges is 'Deterministic task-cluster transitions and timing metrics for a process candidate.';
comment on table public.process_findings is 'Evidence-backed As-Is findings derived from process metrics.';
comment on table public.process_candidate_corrections is 'Immutable analyst decisions and correction overlays for process candidates.';
comment on table public.process_candidate_correction_sources is 'Ordered candidate provenance referenced by an analyst correction.';

comment on column public.process_mining_runs.id is 'Deterministic UUID identifying the mining run.';
comment on column public.process_mining_runs.workspace_id is 'Workspace owning the mining evidence.';
comment on column public.process_mining_runs.department_id is 'Department whose effective tasks were analyzed.';
comment on column public.process_mining_runs.input_digest is 'SHA-256 digest of effective tasks, corrections, configuration, and evidence.';
comment on column public.process_mining_runs.model is 'Provider-neutral Vercel AI Gateway model identifier.';
comment on column public.process_mining_runs.prompt_version is 'Version of structured process-boundary instructions.';
comment on column public.process_mining_runs.algorithm_version is 'Version of deterministic clustering and metrics.';
comment on column public.process_mining_runs.task_snapshot_count is 'Number of effective tasks frozen into this run.';
comment on column public.process_mining_runs.process_instance_count is 'Number of bounded process executions found.';
comment on column public.process_mining_runs.process_candidate_count is 'Number of recurring candidates supported by at least two instances.';
comment on column public.process_mining_runs.created_at is 'Timestamp when the complete result was committed.';

comment on column public.process_task_snapshots.id is 'Stable UUID for the frozen effective task.';
comment on column public.process_task_snapshots.mining_run_id is 'Mining run that owns this snapshot.';
comment on column public.process_task_snapshots.workspace_id is 'Workspace owning the snapshot.';
comment on column public.process_task_snapshots.observation_window_id is 'Observation that supplied the task evidence.';
comment on column public.process_task_snapshots.department_id is 'Department selected for process mining.';
comment on column public.process_task_snapshots.department_snapshot is 'Historical department name captured with the observation.';
comment on column public.process_task_snapshots.role_snapshot is 'Historical role captured with the observation.';
comment on column public.process_task_snapshots.task_ordinal is 'One-based effective-task order within the observation.';
comment on column public.process_task_snapshots.hard_segment_ordinal is 'Five-minute-bounded activity segment containing the task.';
comment on column public.process_task_snapshots.neutral_label is 'Effective display label after analyst correction resolution.';
comment on column public.process_task_snapshots.apparent_objective is 'Evidence-bounded task objective.';
comment on column public.process_task_snapshots.participating_systems is 'Approved browser systems supported by source steps.';
comment on column public.process_task_snapshots.start_step_ordinal is 'First normalized source step.';
comment on column public.process_task_snapshots.end_step_ordinal is 'Last normalized source step.';
comment on column public.process_task_snapshots.started_at is 'Observed task start time.';
comment on column public.process_task_snapshots.ended_at is 'Observed task end time.';
comment on column public.process_task_snapshots.confidence is 'Minimum effective task confidence.';
comment on column public.process_task_snapshots.feature_signature is 'Stable digest of ordered structured browser evidence.';
comment on column public.process_task_snapshots.cluster_key is 'Deterministic task cluster identity independent of model wording.';
comment on column public.process_task_snapshots.feature_tokens is 'Ordered structured signals used for deterministic clustering.';
comment on column public.process_task_snapshots.source_correction_id is 'Analyst correction applied to produce the effective task, when present.';
comment on column public.process_task_snapshots.created_at is 'Timestamp when the snapshot was committed.';

comment on column public.process_task_snapshot_sources.task_snapshot_id is 'Frozen mining task receiving the provenance link.';
comment on column public.process_task_snapshot_sources.task_instance_id is 'Original inferred task retained as evidence.';
comment on column public.process_task_snapshot_sources.source_position is 'One-based order of source tasks within the effective task.';

comment on column public.process_instances.id is 'Stable UUID for the bounded observed process execution.';
comment on column public.process_instances.mining_run_id is 'Mining run that produced the instance.';
comment on column public.process_instances.workspace_id is 'Workspace owning the process instance.';
comment on column public.process_instances.observation_window_id is 'Observation containing the process execution.';
comment on column public.process_instances.neutral_label is 'Evidence-backed process display name.';
comment on column public.process_instances.apparent_outcome is 'Browser-observable business outcome.';
comment on column public.process_instances.boundary_rationale is 'Bounded explanation for the selected process range.';
comment on column public.process_instances.confidence is 'Minimum boundary and source-task confidence.';
comment on column public.process_instances.started_at is 'Observed process start time.';
comment on column public.process_instances.ended_at is 'Observed process end time.';
comment on column public.process_instances.duration_seconds is 'Elapsed browser-observation duration.';
comment on column public.process_instances.cluster_sequence is 'Ordered deterministic task-cluster identities.';
comment on column public.process_instances.task_snapshot_ids is 'Ordered frozen task evidence.';
comment on column public.process_instances.department_snapshot is 'Historical department grouping context.';
comment on column public.process_instances.role_snapshot is 'Historical role grouping context.';
comment on column public.process_instances.created_at is 'Timestamp when the process instance was committed.';

comment on column public.process_unmatched_work.id is 'UUID identifying the unmatched range.';
comment on column public.process_unmatched_work.mining_run_id is 'Mining run that classified the work.';
comment on column public.process_unmatched_work.workspace_id is 'Workspace owning the work evidence.';
comment on column public.process_unmatched_work.observation_window_id is 'Observation containing the unmatched work.';
comment on column public.process_unmatched_work.classification is 'Standalone, noise, or uncertain classification.';
comment on column public.process_unmatched_work.reason is 'Evidence-bounded exclusion explanation.';
comment on column public.process_unmatched_work.task_snapshot_ids is 'Ordered task evidence covered by the exclusion.';
comment on column public.process_unmatched_work.created_at is 'Timestamp when the classification was committed.';

comment on column public.process_candidates.id is 'Deterministic UUID identifying the recurring candidate.';
comment on column public.process_candidates.mining_run_id is 'Mining run that discovered the candidate.';
comment on column public.process_candidates.workspace_id is 'Workspace owning the candidate.';
comment on column public.process_candidates.candidate_key is 'Evidence-derived identity independent of model wording.';
comment on column public.process_candidates.neutral_label is 'Editable display label inferred from evidence.';
comment on column public.process_candidates.apparent_outcome is 'Browser-observable outcome shared by instances.';
comment on column public.process_candidates.confidence is 'Minimum supporting instance confidence.';
comment on column public.process_candidates.participating_systems is 'Approved browser systems supported by candidate evidence.';
comment on column public.process_candidates.canonical_cluster_sequence is 'Representative ordered task-cluster sequence.';
comment on column public.process_candidates.instance_count is 'Number of supporting observed instances.';
comment on column public.process_candidates.observation_count is 'Number of distinct supporting observations.';
comment on column public.process_candidates.variant_count is 'Number of exact task-sequence variants.';
comment on column public.process_candidates.metrics is 'Deterministically calculated process performance and behavior metrics.';
comment on column public.process_candidates.created_at is 'Timestamp when the candidate was committed.';

comment on column public.process_candidate_instances.process_candidate_id is 'Recurring process candidate.';
comment on column public.process_candidate_instances.process_instance_id is 'Supporting observed process instance.';
comment on column public.process_candidate_instances.source_position is 'Stable evidence order within the candidate.';
comment on column public.process_variants.id is 'UUID identifying the exact process variant.';
comment on column public.process_variants.process_candidate_id is 'Candidate containing the variant.';
comment on column public.process_variants.variant_key is 'Stable digest of the exact cluster sequence.';
comment on column public.process_variants.cluster_sequence is 'Exact ordered task-cluster sequence.';
comment on column public.process_variants.occurrence_count is 'Number of observed instances with this exact sequence.';
comment on column public.process_variants.representative_process_instance_id is 'Representative source instance for evidence drill-down.';
comment on column public.process_variants.created_at is 'Timestamp when the variant was committed.';
comment on column public.process_graph_edges.id is 'UUID identifying the candidate transition edge.';
comment on column public.process_graph_edges.process_candidate_id is 'Candidate containing the transition.';
comment on column public.process_graph_edges.source_cluster_key is 'Deterministic source task cluster.';
comment on column public.process_graph_edges.target_cluster_key is 'Deterministic target task cluster.';
comment on column public.process_graph_edges.occurrence_count is 'Observed transition frequency.';
comment on column public.process_graph_edges.median_transition_seconds is 'Median elapsed time between source and target tasks.';
comment on column public.process_findings.id is 'Stable UUID identifying the finding.';
comment on column public.process_findings.process_candidate_id is 'Candidate supported by the finding.';
comment on column public.process_findings.finding_type is 'Deterministic As-Is behavior classification.';
comment on column public.process_findings.severity is 'Evidence-based review priority.';
comment on column public.process_findings.summary is 'Bounded finding description.';
comment on column public.process_findings.evidence_task_snapshot_ids is 'Frozen tasks supporting the finding.';
comment on column public.process_findings.evidence_observation_window_ids is 'Source observations supporting the finding.';
comment on column public.process_findings.created_at is 'Timestamp when the finding was committed.';
comment on column public.process_candidate_corrections.id is 'UUID identifying the immutable analyst correction.';
comment on column public.process_candidate_corrections.workspace_id is 'Workspace owning the correction.';
comment on column public.process_candidate_corrections.mining_run_id is 'Mining run whose candidates are corrected.';
comment on column public.process_candidate_corrections.correction_type is 'Rename, merge, split, reject, or confirm action.';
comment on column public.process_candidate_corrections.replacement_labels is 'Analyst labels required by rename, merge, or split.';
comment on column public.process_candidate_corrections.selected_process_instance_ids is 'Instances assigned to the second result of a split.';
comment on column public.process_candidate_corrections.reason is 'Optional bounded analyst rationale.';
comment on column public.process_candidate_corrections.created_by is 'Authenticated administrator or analyst who acted.';
comment on column public.process_candidate_corrections.created_at is 'Timestamp when the immutable correction was recorded.';
comment on column public.process_candidate_correction_sources.correction_id is 'Analyst correction receiving the source link.';
comment on column public.process_candidate_correction_sources.process_candidate_id is 'Original candidate retained as provenance.';
comment on column public.process_candidate_correction_sources.source_position is 'One-based candidate order for merge and other actions.';

comment on function public.enqueue_process_mining(uuid) is 'Queues durable department-scoped As-Is process mining for an authorized analyst.';
comment on function public.create_process_candidate_correction(uuid, uuid, text, uuid[], uuid[], text[], text) is 'Validates and stores an immutable analyst correction without changing mined evidence.';
comment on function public.persist_process_mining_result(uuid, uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb) is 'Atomically validates and persists one complete process mining result for the local worker.';
