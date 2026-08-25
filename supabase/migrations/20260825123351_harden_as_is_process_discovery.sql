alter table public.process_instances
  add column disposition text not null default 'legacy_unclassified',
  add column range_fingerprint text not null default repeat('0', 64),
  add column related_candidate_key text,
  add column match_diagnostics jsonb not null default '{}'::jsonb;

alter table public.process_instances
  add constraint process_instances_disposition_check
    check (disposition in (
      'complete_match', 'partial_fragment', 'non_recurring', 'uncertain',
      'legacy_unclassified'
    )) not valid,
  add constraint process_instances_range_fingerprint_check
    check (range_fingerprint ~ '^[a-f0-9]{64}$') not valid,
  add constraint process_instances_related_candidate_key_check
    check (
      related_candidate_key is null
      or related_candidate_key ~ '^[a-f0-9]{64}$'
    ) not valid,
  add constraint process_instances_match_diagnostics_check
    check (jsonb_typeof(match_diagnostics) = 'object') not valid;

alter table public.process_instances
  validate constraint process_instances_disposition_check;
alter table public.process_instances
  validate constraint process_instances_range_fingerprint_check;
alter table public.process_instances
  validate constraint process_instances_related_candidate_key_check;
alter table public.process_instances
  validate constraint process_instances_match_diagnostics_check;

alter table public.process_candidates
  add column scope text not null default 'primary',
  add column evidence_rationale text not null default 'Legacy process mining run.';

alter table public.process_candidates
  add constraint process_candidates_scope_check
    check (scope in ('primary')) not valid,
  add constraint process_candidates_evidence_rationale_check
    check (char_length(btrim(evidence_rationale)) between 1 and 500) not valid;

alter table public.process_candidates
  validate constraint process_candidates_scope_check;
alter table public.process_candidates
  validate constraint process_candidates_evidence_rationale_check;

create index process_instances_run_disposition_idx
  on public.process_instances (mining_run_id, disposition, started_at, id);
create index process_instances_run_related_candidate_idx
  on public.process_instances (mining_run_id, related_candidate_key)
  where related_candidate_key is not null;

create or replace function private.persist_process_mining_result_v2(
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
  variant jsonb;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'process_mining_persistence_forbidden' using errcode = '42501';
  end if;
  if target_algorithm_version <> 2 or target_prompt_version <> 2 then
    raise exception 'invalid_process_mining_v2_versions' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.process_mining_runs where id = target_run_id
  ) then
    return target_run_id;
  end if;
  if not exists (
    select 1
    from public.departments
    where id = target_department_id
      and workspace_id = target_workspace_id
  ) then
    raise exception 'invalid_process_mining_department' using errcode = '22023';
  end if;

  insert into public.process_mining_runs (
    id, workspace_id, department_id, input_digest, model, prompt_version,
    algorithm_version, task_snapshot_count, process_instance_count,
    process_candidate_count
  ) values (
    target_run_id, target_workspace_id, target_department_id,
    target_input_digest, target_model, target_prompt_version,
    target_algorithm_version, jsonb_array_length(target_snapshots),
    jsonb_array_length(target_instances), jsonb_array_length(target_candidates)
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
      snapshot->>'department', snapshot->>'role',
      (snapshot->>'ordinal')::integer,
      (snapshot->>'hard_segment_ordinal')::integer,
      snapshot->>'neutral_label', snapshot->>'apparent_objective',
      array(select jsonb_array_elements_text(snapshot->'participating_systems')),
      (snapshot->>'start_step_ordinal')::integer,
      (snapshot->>'end_step_ordinal')::integer,
      (snapshot->>'started_at')::timestamptz,
      (snapshot->>'ended_at')::timestamptz,
      (snapshot->>'confidence')::numeric,
      snapshot->>'feature_signature', snapshot->>'cluster_key',
      snapshot->'feature_tokens',
      nullif(snapshot->>'source_correction_id', '')::uuid
    );
    insert into public.process_task_snapshot_sources (
      task_snapshot_id, task_instance_id, source_position
    )
    select (snapshot->>'id')::uuid, value::text::uuid, ordinality::integer
    from jsonb_array_elements_text(
      snapshot->'source_task_instance_ids'
    ) with ordinality;
  end loop;

  for instance in select value from jsonb_array_elements(target_instances) loop
    insert into public.process_instances (
      id, mining_run_id, workspace_id, observation_window_id, neutral_label,
      apparent_outcome, boundary_rationale, confidence, started_at, ended_at,
      duration_seconds, cluster_sequence, task_snapshot_ids,
      department_snapshot, role_snapshot, disposition, range_fingerprint,
      related_candidate_key, match_diagnostics
    ) values (
      (instance->>'id')::uuid, target_run_id, target_workspace_id,
      (instance->>'observation_window_id')::uuid,
      instance->>'neutral_label', instance->>'apparent_outcome',
      instance->>'boundary_rationale', (instance->>'confidence')::numeric,
      (instance->>'started_at')::timestamptz,
      (instance->>'ended_at')::timestamptz,
      (instance->>'duration_seconds')::numeric,
      array(select jsonb_array_elements_text(instance->'cluster_sequence')),
      array(
        select value::text::uuid
        from jsonb_array_elements_text(instance->'task_snapshot_ids')
      ),
      instance->>'department', instance->>'role',
      instance->>'disposition', instance->>'range_fingerprint',
      nullif(instance->>'related_candidate_key', ''),
      instance->'match_diagnostics'
    );
  end loop;

  for unmatched in select value from jsonb_array_elements(target_unmatched) loop
    insert into public.process_unmatched_work (
      mining_run_id, workspace_id, observation_window_id, classification,
      reason, task_snapshot_ids
    ) values (
      target_run_id, target_workspace_id,
      (unmatched->>'observation_window_id')::uuid,
      unmatched->>'classification', unmatched->>'reason',
      array(
        select value::text::uuid
        from jsonb_array_elements_text(unmatched->'task_snapshot_ids')
      )
    );
  end loop;

  for candidate in select value from jsonb_array_elements(target_candidates) loop
    if jsonb_array_length(candidate->'variants')
      <> (candidate->>'variant_count')::integer then
      raise exception 'invalid_process_variant_count' using errcode = '22023';
    end if;
    if (
      select count(*)
      from jsonb_array_elements(candidate->'variants') as variant_row
      cross join lateral jsonb_array_elements_text(
        variant_row.value->'instance_ids'
      ) as variant_instance
    ) <> jsonb_array_length(candidate->'instance_ids') then
      raise exception 'invalid_process_variant_coverage' using errcode = '22023';
    end if;
    if (
      select count(distinct variant_instance.value)
      from jsonb_array_elements(candidate->'variants') as variant_row
      cross join lateral jsonb_array_elements_text(
        variant_row.value->'instance_ids'
      ) as variant_instance
    ) <> jsonb_array_length(candidate->'instance_ids') then
      raise exception 'overlapping_process_variant_coverage' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(candidate->'variants') as variant_row
      cross join lateral jsonb_array_elements_text(
        variant_row.value->'instance_ids'
      ) as variant_instance
      where not (candidate->'instance_ids' ? variant_instance.value)
    ) then
      raise exception 'invented_process_variant_instance' using errcode = '22023';
    end if;

    insert into public.process_candidates (
      id, mining_run_id, workspace_id, candidate_key, neutral_label,
      apparent_outcome, confidence, participating_systems,
      canonical_cluster_sequence, instance_count, observation_count,
      variant_count, metrics, scope, evidence_rationale
    ) values (
      (candidate->>'id')::uuid, target_run_id, target_workspace_id,
      candidate->>'candidate_key', candidate->>'neutral_label',
      candidate->>'apparent_outcome', (candidate->>'confidence')::numeric,
      array(select jsonb_array_elements_text(candidate->'participating_systems')),
      array(
        select jsonb_array_elements_text(
          candidate->'canonical_cluster_sequence'
        )
      ),
      jsonb_array_length(candidate->'instance_ids'),
      (candidate->'metrics'->>'observationCount')::integer,
      (candidate->>'variant_count')::integer, candidate->'metrics',
      candidate->>'scope', candidate->>'evidence_rationale'
    );

    insert into public.process_candidate_instances (
      process_candidate_id, process_instance_id, source_position
    )
    select (candidate->>'id')::uuid, value::text::uuid, ordinality::integer
    from jsonb_array_elements_text(candidate->'instance_ids') with ordinality;

    for variant in select value from jsonb_array_elements(candidate->'variants') loop
      insert into public.process_variants (
        id, process_candidate_id, variant_key, cluster_sequence,
        occurrence_count, representative_process_instance_id
      ) values (
        gen_random_uuid(), (candidate->>'id')::uuid,
        variant->>'variant_key',
        array(
          select jsonb_array_elements_text(
            variant->'canonical_cluster_sequence'
          )
        ),
        jsonb_array_length(variant->'instance_ids'),
        (variant->>'representative_instance_id')::uuid
      );
    end loop;

    for edge in select value from jsonb_array_elements(candidate->'graph_edges') loop
      insert into public.process_graph_edges (
        id, process_candidate_id, source_cluster_key, target_cluster_key,
        occurrence_count, median_transition_seconds
      ) values (
        gen_random_uuid(), (candidate->>'id')::uuid,
        edge->>'sourceClusterKey', edge->>'targetClusterKey',
        (edge->>'occurrenceCount')::integer,
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
        array(
          select value::text::uuid
          from jsonb_array_elements_text(
            finding->'evidenceTaskSnapshotIds'
          )
        ),
        array(
          select value::text::uuid
          from jsonb_array_elements_text(
            finding->'evidenceObservationWindowIds'
          )
        )
      );
    end loop;
  end loop;

  perform private.validate_process_mining_result(
    target_run_id,
    target_workspace_id
  );

  if exists (
    select 1
    from public.process_instances as process_instance
    where process_instance.mining_run_id = target_run_id
      and process_instance.disposition = 'legacy_unclassified'
  ) then
    raise exception 'invalid_process_instance_disposition' using errcode = '22023';
  end if;
  if exists (
    select evidence.snapshot_id
    from public.process_instances as process_instance
    cross join lateral unnest(
      process_instance.task_snapshot_ids
    ) as evidence(snapshot_id)
    where process_instance.mining_run_id = target_run_id
    group by evidence.snapshot_id
    having count(*) <> 1
  ) then
    raise exception 'overlapping_process_instance_evidence' using errcode = '22023';
  end if;
  if (
    select count(distinct evidence.snapshot_id)
    from public.process_instances as process_instance
    cross join lateral unnest(
      process_instance.task_snapshot_ids
    ) as evidence(snapshot_id)
    where process_instance.mining_run_id = target_run_id
  ) <> (
    select count(*)
    from public.process_task_snapshots
    where mining_run_id = target_run_id
  ) then
    raise exception 'incomplete_process_instance_evidence' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.process_candidate_instances as member
    join public.process_candidates as candidate
      on candidate.id = member.process_candidate_id
    join public.process_instances as process_instance
      on process_instance.id = member.process_instance_id
    where candidate.mining_run_id = target_run_id
      and (
        process_instance.mining_run_id <> target_run_id
        or process_instance.disposition <> 'complete_match'
        or process_instance.related_candidate_key <> candidate.candidate_key
      )
  ) then
    raise exception 'invalid_complete_process_membership' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.process_instances as process_instance
    left join public.process_candidates as candidate
      on candidate.mining_run_id = process_instance.mining_run_id
      and candidate.candidate_key = process_instance.related_candidate_key
    where process_instance.mining_run_id = target_run_id
      and (
        (process_instance.disposition in ('complete_match', 'partial_fragment')
          and candidate.id is null)
        or (process_instance.disposition in ('non_recurring', 'uncertain')
          and process_instance.related_candidate_key is not null)
      )
  ) then
    raise exception 'invalid_process_instance_disposition_link' using errcode = '22023';
  end if;

  return target_run_id;
end;
$$;

create or replace function public.persist_process_mining_result_v2(
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
language sql
security invoker
set search_path = ''
as $$
  select private.persist_process_mining_result_v2(
    target_run_id, target_workspace_id, target_department_id,
    target_input_digest, target_model, target_prompt_version,
    target_algorithm_version, target_snapshots, target_instances,
    target_unmatched, target_candidates
  );
$$;

revoke all on function private.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function private.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) to service_role;
revoke all on function public.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) to service_role;

grant select on public.process_instances, public.process_candidates
  to authenticated;
grant all on public.process_instances, public.process_candidates
  to service_role;

comment on column public.process_instances.disposition is
  'Algorithm-versioned classification as a complete match, partial fragment, non-recurring range, uncertain range, or preserved legacy row.';
comment on column public.process_instances.range_fingerprint is
  'Stable evidence-derived fingerprint for the complete observed range, independent of generated wording.';
comment on column public.process_instances.related_candidate_key is
  'Candidate evidence key for complete or partial ranges; null for unrelated work.';
comment on column public.process_instances.match_diagnostics is
  'Versioned component similarity, containment, and completion-anchor diagnostics explaining the disposition.';
comment on column public.process_candidates.scope is
  'Candidate presentation scope; Phase 5A promotes only primary recurring process envelopes.';
comment on column public.process_candidates.evidence_rationale is
  'Gateway-generated label rationale constrained to deterministic candidate membership and source evidence.';
comment on function private.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) is
  'Privileged atomic Phase 5A persistence with exact snapshot coverage, disposition, membership, variant, and provenance validation.';
comment on function public.persist_process_mining_result_v2(
  uuid, uuid, uuid, text, text, integer, integer,
  jsonb, jsonb, jsonb, jsonb
) is
  'Service-only security-invoker boundary for atomic Phase 5A process-mining persistence.';
