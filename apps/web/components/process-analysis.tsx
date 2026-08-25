'use client';

import {
  processCandidateCorrectionInputSchema,
  processCandidateCorrectionTypeSchema,
  resolveEffectiveProcessCandidates,
  type Json,
  type Tables,
} from '@reflow/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { getSupabaseBrowserClient } from '../lib/supabase-browser';

type Supabase = NonNullable<ReturnType<typeof getSupabaseBrowserClient>>;
type Department = Tables<'departments'>;
type ProcessingJob = Tables<'processing_jobs'>;
type MiningRun = Tables<'process_mining_runs'>;
type Candidate = Tables<'process_candidates'>;
type ProcessInstance = Tables<'process_instances'>;
type CandidateMember = Tables<'process_candidate_instances'>;
type Finding = Tables<'process_findings'>;
type TaskSnapshot = Tables<'process_task_snapshots'>;
type Correction = Tables<'process_candidate_corrections'>;
type CorrectionSource = Tables<'process_candidate_correction_sources'>;

function objectMetric(metrics: Json, key: string) {
  if (!metrics || Array.isArray(metrics) || typeof metrics !== 'object')
    return 0;
  const value = metrics[key];
  return typeof value === 'number' ? value : 0;
}

function diagnosticMetric(diagnostics: Json, key: string) {
  return objectMetric(diagnostics, key);
}

function formatSystem(hostname: string) {
  return hostname.replace(/\.localhost$/, '').toUpperCase();
}

export function ProcessAnalysisPanel({
  supabase,
  workspaceId,
}: {
  supabase: Supabase;
  workspaceId: string;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [runs, setRuns] = useState<MiningRun[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [instances, setInstances] = useState<ProcessInstance[]>([]);
  const [members, setMembers] = useState<CandidateMember[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [taskSnapshots, setTaskSnapshots] = useState<TaskSnapshot[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [correctionSources, setCorrectionSources] = useState<
    CorrectionSource[]
  >([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [primaryLabel, setPrimaryLabel] = useState('');
  const [secondaryLabel, setSecondaryLabel] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [departmentResult, jobResult, runResult] = await Promise.all([
      supabase
        .from('departments')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('processing_jobs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('job_type', 'process_mining')
        .order('created_at', { ascending: false }),
      supabase
        .from('process_mining_runs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false }),
    ]);
    const failure = [
      departmentResult.error,
      jobResult.error,
      runResult.error,
    ].find(Boolean);
    if (failure) return setError(failure.message);
    const nextDepartments = departmentResult.data ?? [];
    setDepartments(nextDepartments);
    setDepartmentId((current) => current || nextDepartments[0]?.id || '');
    setJobs(jobResult.data ?? []);
    setRuns(runResult.data ?? []);
  }, [supabase, workspaceId]);

  useEffect(() => void reload(), [reload]);

  const latestRun = useMemo(
    () => runs.find((run) => run.department_id === departmentId),
    [departmentId, runs],
  );

  const loadRun = useCallback(async () => {
    if (!latestRun) {
      setCandidates([]);
      setInstances([]);
      setMembers([]);
      setFindings([]);
      setTaskSnapshots([]);
      setCorrections([]);
      setCorrectionSources([]);
      return;
    }
    const [candidateResult, instanceResult, snapshotResult, correctionResult] =
      await Promise.all([
        supabase
          .from('process_candidates')
          .select('*')
          .eq('mining_run_id', latestRun.id)
          .order('created_at'),
        supabase
          .from('process_instances')
          .select('*')
          .eq('mining_run_id', latestRun.id)
          .order('started_at'),
        supabase
          .from('process_task_snapshots')
          .select('*')
          .eq('mining_run_id', latestRun.id)
          .order('started_at'),
        supabase
          .from('process_candidate_corrections')
          .select('*')
          .eq('mining_run_id', latestRun.id)
          .order('created_at', { ascending: false }),
      ]);
    const failure = [
      candidateResult.error,
      instanceResult.error,
      snapshotResult.error,
      correctionResult.error,
    ].find(Boolean);
    if (failure) return setError(failure.message);
    const nextCandidates = candidateResult.data ?? [];
    const candidateIds = nextCandidates.map((candidate) => candidate.id);
    const correctionIds = (correctionResult.data ?? []).map(
      (correction) => correction.id,
    );
    const [memberResult, findingResult, sourceResult] = await Promise.all([
      candidateIds.length
        ? supabase
            .from('process_candidate_instances')
            .select('*')
            .in('process_candidate_id', candidateIds)
            .order('source_position')
        : Promise.resolve({ data: [] as CandidateMember[], error: null }),
      candidateIds.length
        ? supabase
            .from('process_findings')
            .select('*')
            .in('process_candidate_id', candidateIds)
        : Promise.resolve({ data: [] as Finding[], error: null }),
      correctionIds.length
        ? supabase
            .from('process_candidate_correction_sources')
            .select('*')
            .in('correction_id', correctionIds)
            .order('source_position')
        : Promise.resolve({ data: [] as CorrectionSource[], error: null }),
    ]);
    const relatedFailure = [
      memberResult.error,
      findingResult.error,
      sourceResult.error,
    ].find(Boolean);
    if (relatedFailure) return setError(relatedFailure.message);
    setCandidates(nextCandidates);
    setInstances(instanceResult.data ?? []);
    setMembers(memberResult.data ?? []);
    setFindings(findingResult.data ?? []);
    setTaskSnapshots(snapshotResult.data ?? []);
    setCorrections(correctionResult.data ?? []);
    setCorrectionSources(sourceResult.data ?? []);
  }, [latestRun, supabase]);

  useEffect(() => void loadRun(), [loadRun]);

  async function enqueue() {
    if (!departmentId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: enqueueError } = await supabase.rpc(
      'enqueue_process_mining',
      { target_department_id: departmentId },
    );
    setBusy(false);
    if (enqueueError) setError(enqueueError.message);
    else {
      setMessage('Process mining queued. Keep the local worker running.');
      await reload();
    }
  }

  async function correct(
    correctionType: 'rename' | 'merge' | 'split' | 'reject' | 'confirm',
  ) {
    if (!latestRun) return;
    const parsed = processCandidateCorrectionInputSchema.safeParse({
      correctionType,
      miningRunId: latestRun.id,
      processCandidateIds: selectedCandidates,
      reason: reason.trim() || null,
      replacementLabels:
        correctionType === 'rename' || correctionType === 'merge'
          ? [primaryLabel]
          : correctionType === 'split'
            ? [primaryLabel, secondaryLabel]
            : [],
      selectedProcessInstanceIds:
        correctionType === 'split' ? selectedInstances : [],
      workspaceId,
    });
    if (!parsed.success)
      return setError(
        parsed.error.issues[0]?.message ?? 'Check the correction fields.',
      );
    setBusy(true);
    setError(null);
    const value = parsed.data;
    const { error: correctionError } = await supabase.rpc(
      'create_process_candidate_correction',
      {
        target_correction_type: value.correctionType,
        target_mining_run_id: value.miningRunId,
        target_process_candidate_ids: value.processCandidateIds,
        ...(value.reason ? { target_reason: value.reason } : {}),
        target_replacement_labels: value.replacementLabels,
        target_selected_process_instance_ids: value.selectedProcessInstanceIds,
        target_workspace_id: value.workspaceId,
      },
    );
    setBusy(false);
    if (correctionError) setError(correctionError.message);
    else {
      setMessage('Process decision saved without changing original evidence.');
      setSelectedCandidates([]);
      setSelectedInstances([]);
      setPrimaryLabel('');
      setSecondaryLabel('');
      setReason('');
      await loadRun();
    }
  }

  const activeJob = jobs.find(
    (job) =>
      job.entity_id === departmentId &&
      (job.status === 'queued' || job.status === 'running'),
  );
  const effectiveResolution = useMemo(
    () =>
      resolveEffectiveProcessCandidates(
        candidates.map((candidate) => ({
          apparentOutcome: candidate.apparent_outcome,
          confidence: Number(candidate.confidence),
          id: candidate.id,
          instanceIds: members
            .filter((member) => member.process_candidate_id === candidate.id)
            .sort((left, right) => left.source_position - right.source_position)
            .map((member) => member.process_instance_id),
          neutralLabel: candidate.neutral_label,
          participatingSystems: candidate.participating_systems,
        })),
        corrections.map((correction) => ({
          correctionType: processCandidateCorrectionTypeSchema.parse(
            correction.correction_type,
          ),
          createdAt: correction.created_at,
          id: correction.id,
          replacementLabels: correction.replacement_labels,
          selectedProcessInstanceIds: correction.selected_process_instance_ids,
          sourceCandidateIds: correctionSources
            .filter((source) => source.correction_id === correction.id)
            .sort((left, right) => left.source_position - right.source_position)
            .map((source) => source.process_candidate_id),
        })),
      ),
    [candidates, correctionSources, corrections, members],
  );
  const partialInstances = instances.filter(
    (instance) => instance.disposition === 'partial_fragment',
  );
  const unpromotedInstances = instances.filter((instance) =>
    ['non_recurring', 'uncertain'].includes(instance.disposition),
  );

  return (
    <section className="card setup-section" id="process-analysis">
      <div className="section-heading">
        <div>
          <span className="step-number">06</span>
          <h2>As-Is process mining</h2>
        </div>
        <p>
          Group repeated effective tasks into evidence-backed process candidates
          and variants.
        </p>
      </div>
      {error ? <p className="notice notice-error">{error}</p> : null}
      {message ? <p className="notice notice-success">{message}</p> : null}
      <div className="process-toolbar">
        <label>
          Department
          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          disabled={busy || !departmentId || Boolean(activeJob)}
          onClick={() => void enqueue()}
          type="button"
        >
          {activeJob?.status ??
            (latestRun ? 'Re-run process mining' : 'Mine processes')}
        </button>
      </div>
      {latestRun ? (
        <p className="muted-copy">
          Latest run: {latestRun.task_snapshot_count} effective tasks ·{' '}
          {effectiveResolution.candidates.length} primary process{' '}
          {effectiveResolution.candidates.length === 1 ? '' : 'es'} ·{' '}
          {
            instances.filter(
              (instance) => instance.disposition === 'complete_match',
            ).length
          }{' '}
          complete observations · {partialInstances.length} partial
          {partialInstances.length === 1 ? '' : 's'}
        </p>
      ) : (
        <p className="muted-copy">
          At least two similar process instances are required for a recurring
          candidate.
        </p>
      )}
      <div className="process-candidate-list">
        {effectiveResolution.candidates.map((candidate) => {
          const sourceCandidate = candidates.find((source) =>
            candidate.sourceCandidateIds.includes(source.id),
          )!;
          const candidateInstances = candidate.instanceIds
            .map((id) => instances.find((instance) => instance.id === id))
            .filter((instance): instance is ProcessInstance =>
              Boolean(instance),
            );
          const candidateFindings = findings.filter((finding) =>
            candidate.sourceCandidateIds.includes(finding.process_candidate_id),
          );
          const sourceKeys = candidates
            .filter((source) =>
              candidate.sourceCandidateIds.includes(source.id),
            )
            .map((source) => source.candidate_key);
          const candidatePartials = partialInstances.filter(
            (instance) =>
              instance.related_candidate_key &&
              sourceKeys.includes(instance.related_candidate_key),
          );
          const representativeInstance = candidateInstances.reduce<
            ProcessInstance | undefined
          >(
            (current, instance) =>
              !current ||
              instance.task_snapshot_ids.length >
                current.task_snapshot_ids.length
                ? instance
                : current,
            undefined,
          );
          const canonicalSnapshots =
            representativeInstance?.task_snapshot_ids
              .map((id) => taskSnapshots.find((snapshot) => snapshot.id === id))
              .filter((snapshot): snapshot is TaskSnapshot =>
                Boolean(snapshot),
              ) ?? [];
          return (
            <article className="process-candidate" key={candidate.effectiveId}>
              <label className="process-title">
                <input
                  className="selection-checkbox"
                  checked={candidate.sourceCandidateIds.every((id) =>
                    selectedCandidates.includes(id),
                  )}
                  onChange={(event) =>
                    setSelectedCandidates((current) => {
                      const next = new Set(current);
                      for (const id of candidate.sourceCandidateIds)
                        if (event.target.checked) next.add(id);
                        else next.delete(id);
                      return [...next];
                    })
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{candidate.neutralLabel}</strong>
                  <small>
                    {candidate.instanceIds.length} instances ·{' '}
                    {sourceCandidate.observation_count} observations ·{' '}
                    {sourceCandidate.variant_count} variants ·{' '}
                    {Math.round(candidate.confidence * 100)}% confidence ·{' '}
                    {candidate.status}
                    {candidate.correctionId ? ' · analyst corrected' : ''}
                  </small>
                </span>
              </label>
              <p>{candidate.apparentOutcome}</p>
              <p className="evidence-rationale">
                <strong>Why Reflow grouped this:</strong>{' '}
                {sourceCandidate.evidence_rationale}
              </p>
              <div className="metric-strip">
                <span>
                  Median{' '}
                  {Math.round(
                    objectMetric(
                      sourceCandidate.metrics,
                      'medianDurationSeconds',
                    ),
                  )}
                  s
                </span>
                <span>
                  P90{' '}
                  {Math.round(
                    objectMetric(sourceCandidate.metrics, 'p90DurationSeconds'),
                  )}
                  s
                </span>
                <span>
                  {candidate.participatingSystems.map(formatSystem).join(' → ')}
                </span>
              </div>
              <div className="canonical-process">
                <h3>Canonical observed process</h3>
                <ol>
                  {canonicalSnapshots.map((snapshot, index) => (
                    <li key={snapshot.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{snapshot.neutral_label}</strong>
                        <small>
                          {snapshot.participating_systems
                            .map(formatSystem)
                            .join(' → ')}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <details>
                <summary>
                  Supporting evidence ({candidateInstances.length} complete ·{' '}
                  {candidatePartials.length} partial)
                </summary>
                <div className="instance-list">
                  {candidateInstances.map((instance) => (
                    <label key={instance.id}>
                      <input
                        className="selection-checkbox"
                        checked={selectedInstances.includes(instance.id)}
                        onChange={(event) =>
                          setSelectedInstances((current) =>
                            event.target.checked
                              ? [...new Set([...current, instance.id])]
                              : current.filter((id) => id !== instance.id),
                          )
                        }
                        type="checkbox"
                      />
                      {new Date(instance.started_at).toLocaleString()} ·{' '}
                      {Math.round(Number(instance.duration_seconds))}s ·
                      complete
                    </label>
                  ))}
                </div>
                {candidatePartials.length ? (
                  <div className="partial-evidence">
                    <strong>Partial supporting evidence</strong>
                    <ul>
                      {candidatePartials.map((instance) => (
                        <li key={instance.id}>
                          {new Date(instance.started_at).toLocaleString()} ·{' '}
                          {instance.task_snapshot_ids.length} observed stage
                          {instance.task_snapshot_ids.length === 1
                            ? ''
                            : 's'} ·{' '}
                          {Math.round(
                            diagnosticMetric(
                              instance.match_diagnostics,
                              'containmentScore',
                            ) * 100,
                          )}
                          % evidence overlap. This observation supports the
                          process but is not counted as a complete occurrence.
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {candidateFindings.length ? (
                  <ul>
                    {candidateFindings.map((finding) => (
                      <li key={finding.id}>{finding.summary}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted-copy">
                    No deterministic friction findings.
                  </p>
                )}
              </details>
            </article>
          );
        })}
      </div>
      {unpromotedInstances.length ? (
        <details className="unpromoted-processes">
          <summary>
            Not promoted ({unpromotedInstances.length} isolated activity
            {unpromotedInstances.length === 1 ? '' : ' ranges'})
          </summary>
          <ul>
            {unpromotedInstances.map((instance) => (
              <li key={instance.id}>
                <strong>{instance.neutral_label}</strong> ·{' '}
                {instance.task_snapshot_ids.length} observed task
                {instance.task_snapshot_ids.length === 1 ? '' : 's'} ·{' '}
                {instance.disposition === 'uncertain'
                  ? 'similarity was inconclusive'
                  : 'not observed often enough to establish a recurring process'}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {effectiveResolution.rejectedSourceCandidateIds.length ? (
        <p className="muted-copy">
          {effectiveResolution.rejectedSourceCandidateIds.length} mined
          candidate
          {effectiveResolution.rejectedSourceCandidateIds.length === 1
            ? ''
            : 's'}{' '}
          rejected by an analyst; original evidence remains available.
        </p>
      ) : null}
      {latestRun && candidates.length === 0 ? (
        <p className="muted-copy">
          No recurring candidate yet. Record another comparable workflow or
          repeat it within an all-day observation.
        </p>
      ) : null}
      {candidates.length ? (
        <div className="correction-panel">
          <h3>Process candidate review</h3>
          <p className="muted-copy">
            Select candidates to rename, merge, confirm, or reject. For a split,
            select one candidate and the instances that belong in the second
            result.
          </p>
          <div className="correction-fields">
            <label>
              Primary label
              <input
                value={primaryLabel}
                onChange={(event) => setPrimaryLabel(event.target.value)}
              />
            </label>
            <label>
              Second split label
              <input
                value={secondaryLabel}
                onChange={(event) => setSecondaryLabel(event.target.value)}
              />
            </label>
            <label>
              Reason (optional)
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </div>
          <div className="button-row">
            {(['rename', 'merge', 'split', 'confirm', 'reject'] as const).map(
              (action) => (
                <button
                  className={
                    action === 'reject'
                      ? 'button button-quiet danger'
                      : 'button button-secondary'
                  }
                  disabled={busy}
                  key={action}
                  onClick={() => void correct(action)}
                  type="button"
                >
                  {action[0]!.toUpperCase() + action.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
