alter table public.raw_event_tokens
  drop constraint if exists raw_event_tokens_action_type_check;
alter table public.raw_event_tokens
  add constraint raw_event_tokens_action_type_check check (
    action_type in (
      'click', 'input', 'submit', 'navigate', 'spa_navigate',
      'hash_navigate', 'tab_activate', 'domain_transition', 'file_upload',
      'file_download', 'page_context', 'out_of_scope_gap'
    )
  );

alter table public.normalized_steps
  drop constraint if exists normalized_steps_action_type_check;
alter table public.normalized_steps
  add constraint normalized_steps_action_type_check check (
    action_type in (
      'click', 'input', 'submit', 'navigate', 'spa_navigate',
      'hash_navigate', 'tab_activate', 'domain_transition', 'file_upload',
      'file_download', 'page_context', 'out_of_scope_gap'
    )
  );

alter table public.normalized_steps
  add column interaction_group_id uuid;
alter table public.normalized_steps
  add constraint normalized_steps_v2_interaction_group check (
    normalization_version < 2 or interaction_group_id is not null
  );
create index normalized_steps_window_interaction_idx
  on public.normalized_steps (
    observation_window_id,
    normalization_version,
    interaction_group_id,
    step_ordinal
  );

alter table public.task_instances
  add column boundary_confidence numeric(4, 3),
  add column label_confidence numeric(4, 3),
  add column objective_confidence numeric(4, 3);
update public.task_instances
set
  boundary_confidence = confidence,
  label_confidence = confidence,
  objective_confidence = confidence;
alter table public.task_instances
  alter column boundary_confidence set not null,
  alter column label_confidence set not null,
  alter column objective_confidence set not null,
  add constraint task_instances_boundary_confidence_check
    check (boundary_confidence between 0 and 1),
  add constraint task_instances_label_confidence_check
    check (label_confidence between 0 and 1),
  add constraint task_instances_objective_confidence_check
    check (objective_confidence between 0 and 1),
  add constraint task_instances_overall_confidence_check
    check (
      confidence = least(
        boundary_confidence,
        label_confidence,
        objective_confidence
      )
    );

create or replace function private.set_task_confidence_components()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.boundary_confidence := coalesce(new.boundary_confidence, new.confidence);
  new.label_confidence := coalesce(new.label_confidence, new.confidence);
  new.objective_confidence := coalesce(new.objective_confidence, new.confidence);
  return new;
end;
$$;

create trigger task_instances_set_confidence_components
before insert on public.task_instances
for each row execute function private.set_task_confidence_components();

create table public.task_inference_exclusions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  observation_window_id uuid not null,
  inference_run_id uuid not null
    references public.task_inference_runs (id) on delete cascade,
  exclusion_ordinal integer not null check (exclusion_ordinal > 0),
  classification text not null check (
    classification in (
      'observation_context', 'transport_only', 'noise', 'uncertain_gap'
    )
  ),
  reason text not null
    check (char_length(btrim(reason)) between 1 and 500),
  start_step_ordinal integer not null check (start_step_ordinal > 0),
  end_step_ordinal integer not null
    check (end_step_ordinal >= start_step_ordinal),
  created_at timestamptz not null default now(),
  constraint task_inference_exclusions_window_fkey
    foreign key (observation_window_id, workspace_id)
    references public.observation_windows (id, workspace_id)
    on delete cascade,
  unique (inference_run_id, exclusion_ordinal)
);

create index task_inference_exclusions_window_order_idx
  on public.task_inference_exclusions (
    observation_window_id,
    inference_run_id,
    exclusion_ordinal
  );

create table public.task_inference_exclusion_steps (
  exclusion_id uuid not null
    references public.task_inference_exclusions (id) on delete cascade,
  normalized_step_id uuid not null
    references public.normalized_steps (id) on delete restrict,
  step_position integer not null check (step_position > 0),
  created_at timestamptz not null default now(),
  primary key (exclusion_id, normalized_step_id),
  unique (exclusion_id, step_position)
);

create index task_inference_exclusion_steps_step_idx
  on public.task_inference_exclusion_steps (normalized_step_id, exclusion_id);

alter table public.task_inference_exclusions enable row level security;
alter table public.task_inference_exclusion_steps enable row level security;

create policy task_inference_exclusions_select_analyst
on public.task_inference_exclusions for select to authenticated
using ((select private.has_workspace_role(workspace_id, array['admin', 'analyst'])));

create policy task_inference_exclusion_steps_select_analyst
on public.task_inference_exclusion_steps for select to authenticated
using (
  exists (
    select 1
    from public.task_inference_exclusions as exclusion
    where exclusion.id = exclusion_id
      and (select private.has_workspace_role(
        exclusion.workspace_id,
        array['admin', 'analyst']
      ))
  )
);

revoke all on public.task_inference_exclusions from anon, authenticated;
revoke all on public.task_inference_exclusion_steps from anon, authenticated;
grant select on public.task_inference_exclusions to authenticated;
grant select on public.task_inference_exclusion_steps to authenticated;
grant all on public.task_inference_exclusions to service_role;
grant all on public.task_inference_exclusion_steps to service_role;

create or replace function public.persist_task_inference_result_v2(
  target_run_id uuid,
  target_observation_window_id uuid,
  target_input_digest text,
  target_model text,
  target_prompt_version integer,
  target_normalization_version integer,
  target_steps jsonb,
  target_segments jsonb,
  target_tasks jsonb,
  target_exclusions jsonb
)
returns public.task_inference_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  persisted_run public.task_inference_runs;
  coverage_count integer;
  coverage_distinct_count integer;
  coverage_min integer;
  coverage_max integer;
  step_record jsonb;
  task_record jsonb;
  exclusion_record jsonb;
  supporting_record record;
  inserted_evidence_count integer;
begin
  if jsonb_typeof(target_exclusions) <> 'array' then
    raise exception 'inference_exclusions_array_required' using errcode = '22023';
  end if;
  if target_normalization_version < 2 then
    raise exception 'v2_normalization_required' using errcode = '22023';
  end if;

  with ranges as (
    select
      (value ->> 'start_step_ordinal')::integer as range_start,
      (value ->> 'end_step_ordinal')::integer as range_end
    from jsonb_array_elements(target_tasks)
    union all
    select
      (value ->> 'start_step_ordinal')::integer,
      (value ->> 'end_step_ordinal')::integer
    from jsonb_array_elements(target_exclusions)
  ), coverage as (
    select generate_series(range_start, range_end) as step_ordinal
    from ranges
  )
  select
    count(*),
    count(distinct step_ordinal),
    min(step_ordinal),
    max(step_ordinal)
  into
    coverage_count,
    coverage_distinct_count,
    coverage_min,
    coverage_max
  from coverage;

  if coverage_count <> jsonb_array_length(target_steps)
    or coverage_distinct_count <> jsonb_array_length(target_steps)
    or coverage_min <> 1
    or coverage_max <> jsonb_array_length(target_steps) then
    raise exception 'inference_step_coverage_invalid' using errcode = '22023';
  end if;

  select public.persist_task_inference_result(
    target_run_id,
    target_observation_window_id,
    target_input_digest,
    target_model,
    target_prompt_version,
    target_normalization_version,
    target_steps,
    target_segments,
    target_tasks
  ) into persisted_run;

  for step_record in select value from jsonb_array_elements(target_steps) loop
    update public.normalized_steps
    set interaction_group_id = (step_record ->> 'interaction_group_id')::uuid
    where id = (step_record ->> 'id')::uuid
      and observation_window_id = target_observation_window_id
      and normalization_version = target_normalization_version;
    if not found then
      raise exception 'normalized_step_v2_update_failed' using errcode = '22023';
    end if;
  end loop;

  for task_record in select value from jsonb_array_elements(target_tasks) loop
    update public.task_instances
    set
      boundary_confidence = (task_record ->> 'boundary_confidence')::numeric,
      label_confidence = (task_record ->> 'label_confidence')::numeric,
      objective_confidence = (task_record ->> 'objective_confidence')::numeric
    where id = (task_record ->> 'id')::uuid
      and inference_run_id = target_run_id;
    if not found then
      raise exception 'task_confidence_update_failed' using errcode = '22023';
    end if;
  end loop;

  for exclusion_record in
    select value from jsonb_array_elements(target_exclusions)
  loop
    insert into public.task_inference_exclusions (
      id,
      workspace_id,
      observation_window_id,
      inference_run_id,
      exclusion_ordinal,
      classification,
      reason,
      start_step_ordinal,
      end_step_ordinal
    )
    values (
      (exclusion_record ->> 'id')::uuid,
      persisted_run.workspace_id,
      target_observation_window_id,
      target_run_id,
      (exclusion_record ->> 'ordinal')::integer,
      exclusion_record ->> 'classification',
      exclusion_record ->> 'reason',
      (exclusion_record ->> 'start_step_ordinal')::integer,
      (exclusion_record ->> 'end_step_ordinal')::integer
    );

    inserted_evidence_count := 0;
    for supporting_record in
      select value #>> '{}' as normalized_step_id, ordinality as step_position
      from jsonb_array_elements(exclusion_record -> 'supporting_step_ids')
        with ordinality
    loop
      insert into public.task_inference_exclusion_steps (
        exclusion_id,
        normalized_step_id,
        step_position
      )
      select
        (exclusion_record ->> 'id')::uuid,
        step.id,
        supporting_record.step_position
      from public.normalized_steps as step
      where step.id = supporting_record.normalized_step_id::uuid
        and step.observation_window_id = target_observation_window_id
        and step.normalization_version = target_normalization_version
        and step.step_ordinal between
          (exclusion_record ->> 'start_step_ordinal')::integer
          and (exclusion_record ->> 'end_step_ordinal')::integer;
      if found then
        inserted_evidence_count := inserted_evidence_count + 1;
      end if;
    end loop;
    if inserted_evidence_count <>
      (exclusion_record ->> 'end_step_ordinal')::integer
      - (exclusion_record ->> 'start_step_ordinal')::integer + 1 then
      raise exception 'exclusion_step_evidence_mismatch' using errcode = '22023';
    end if;
  end loop;

  return persisted_run;
end;
$$;

revoke all on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) to service_role;

comment on column public.raw_event_tokens.action_type is
  'Sanitized browser action; page_context is active-tab startup/resume context and not user work.';
comment on column public.normalized_steps.interaction_group_id is
  'Stable identifier grouping related browser telemetry without removing source evidence.';
comment on column public.task_instances.boundary_confidence is
  'Model confidence that the inferred task starts and ends at the selected evidence boundaries.';
comment on column public.task_instances.label_confidence is
  'Model confidence that the neutral task label is supported by the evidence.';
comment on column public.task_instances.objective_confidence is
  'Model confidence that the apparent task objective is supported by the evidence.';
comment on table public.task_inference_exclusions is
  'Versioned inference ranges classified as context, transport, noise, or uncertain gaps instead of business tasks.';
comment on column public.task_inference_exclusions.id is
  'Stable exclusion identifier derived from the inference run and exclusion order.';
comment on column public.task_inference_exclusions.workspace_id is
  'Workspace that owns the exclusion and its supporting evidence.';
comment on column public.task_inference_exclusions.observation_window_id is
  'Completed browser observation containing the excluded step range.';
comment on column public.task_inference_exclusions.inference_run_id is
  'Versioned inference run that classified the range.';
comment on column public.task_inference_exclusions.exclusion_ordinal is
  'One-based order of the exclusion within its inference run.';
comment on column public.task_inference_exclusions.classification is
  'Reason category: observation_context, transport_only, noise, or uncertain_gap.';
comment on column public.task_inference_exclusions.reason is
  'Bounded evidence-based explanation for excluding the range from business tasks.';
comment on column public.task_inference_exclusions.start_step_ordinal is
  'First normalized step covered by the exclusion.';
comment on column public.task_inference_exclusions.end_step_ordinal is
  'Last normalized step covered by the exclusion.';
comment on column public.task_inference_exclusions.created_at is
  'Database timestamp when the exclusion was persisted.';
comment on table public.task_inference_exclusion_steps is
  'Ordered evidence links from an inference exclusion to its normalized steps.';
comment on column public.task_inference_exclusion_steps.exclusion_id is
  'Inference exclusion supported by the normalized step.';
comment on column public.task_inference_exclusion_steps.normalized_step_id is
  'Normalized browser step classified outside a business task.';
comment on column public.task_inference_exclusion_steps.step_position is
  'One-based evidence order within the exclusion.';
comment on column public.task_inference_exclusion_steps.created_at is
  'Database timestamp when the exclusion evidence link was created.';
comment on function public.persist_task_inference_result_v2(
  uuid, uuid, text, text, integer, integer, jsonb, jsonb, jsonb, jsonb
) is
  'Transactionally persists version-2 normalized evidence, tasks, complete exclusions, and confidence dimensions after validating exact step coverage.';
