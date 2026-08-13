'use client';

import {
  resolveEffectiveTasks,
  taskCorrectionInputSchema,
  taskCorrectionTypeSchema,
  type Tables,
} from '@reflow/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { getSupabaseBrowserClient } from '../lib/supabase-browser';

type Supabase = NonNullable<ReturnType<typeof getSupabaseBrowserClient>>;
type ObservationWindow = Tables<'observation_windows'>;
type ProcessingJob = Tables<'processing_jobs'>;
type InferenceRun = Tables<'task_inference_runs'>;
type TaskInstance = Tables<'task_instances'>;
type TaskCorrection = Tables<'task_corrections'>;
type TaskCorrectionSource = Tables<'task_correction_sources'>;
type TaskExclusion = Tables<'task_inference_exclusions'>;

export function TaskAnalysisPanel({
  supabase,
  workspaceId,
}: {
  supabase: Supabase;
  workspaceId: string;
}) {
  const [windows, setWindows] = useState<ObservationWindow[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [runs, setRuns] = useState<InferenceRun[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [corrections, setCorrections] = useState<TaskCorrection[]>([]);
  const [correctionSources, setCorrectionSources] = useState<
    TaskCorrectionSource[]
  >([]);
  const [exclusions, setExclusions] = useState<TaskExclusion[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [primaryLabel, setPrimaryLabel] = useState('');
  const [secondaryLabel, setSecondaryLabel] = useState('');
  const [splitOrdinal, setSplitOrdinal] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [windowResult, jobResult, runResult, correctionResult] =
      await Promise.all([
        supabase
          .from('observation_windows')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('status', 'completed')
          .order('ended_at', { ascending: false }),
        supabase
          .from('processing_jobs')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('job_type', 'task_inference')
          .order('created_at', { ascending: false }),
        supabase
          .from('task_inference_runs')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_corrections')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
      ]);
    const failure = [
      windowResult.error,
      jobResult.error,
      runResult.error,
      correctionResult.error,
    ].find(Boolean);
    if (failure) return setError(failure.message);

    const nextRuns = runResult.data ?? [];
    setWindows(windowResult.data ?? []);
    setJobs(jobResult.data ?? []);
    setRuns(nextRuns);
    setCorrections(correctionResult.data ?? []);
    const correctionIds = (correctionResult.data ?? []).map(
      (correction) => correction.id,
    );
    const sourceResult =
      correctionIds.length === 0
        ? { data: [] as TaskCorrectionSource[], error: null }
        : await supabase
            .from('task_correction_sources')
            .select('*')
            .in('correction_id', correctionIds)
            .order('source_position');
    if (sourceResult.error) return setError(sourceResult.error.message);
    setCorrectionSources(sourceResult.data ?? []);
    const latestRun = nextRuns[0];
    if (!latestRun) {
      setTasks([]);
      setExclusions([]);
      return;
    }
    const [taskResult, exclusionResult] = await Promise.all([
      supabase
        .from('task_instances')
        .select('*')
        .eq('inference_run_id', latestRun.id)
        .order('task_ordinal'),
      supabase
        .from('task_inference_exclusions')
        .select('*')
        .eq('inference_run_id', latestRun.id)
        .order('exclusion_ordinal'),
    ]);
    if (taskResult.error || exclusionResult.error)
      setError((taskResult.error ?? exclusionResult.error)!.message);
    else {
      setTasks(taskResult.data ?? []);
      setExclusions(exclusionResult.data ?? []);
    }
  }, [supabase, workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const latestRun = runs[0];
  const latestWindow = useMemo(
    () =>
      windows.find((window) => window.id === latestRun?.observation_window_id),
    [latestRun?.observation_window_id, windows],
  );
  const effectiveResolution = useMemo(() => {
    const taskIds = new Set(tasks.map((task) => task.id));
    const relevantCorrections = corrections
      .map((correction) => ({
        correction,
        sourceTaskInstanceIds: correctionSources
          .filter((source) => source.correction_id === correction.id)
          .sort((left, right) => left.source_position - right.source_position)
          .map((source) => source.task_instance_id),
      }))
      .filter(
        ({ sourceTaskInstanceIds }) =>
          sourceTaskInstanceIds.length > 0 &&
          sourceTaskInstanceIds.every((id) => taskIds.has(id)),
      );
    return resolveEffectiveTasks(
      tasks.map((task) => ({
        apparentObjective: task.apparent_objective,
        confidence: Number(task.confidence),
        endStepOrdinal: task.end_step_ordinal,
        id: task.id,
        inferenceRunId: task.inference_run_id,
        neutralLabel: task.neutral_label,
        participatingSystems: task.participating_systems,
        startStepOrdinal: task.start_step_ordinal,
      })),
      relevantCorrections.map(({ correction, sourceTaskInstanceIds }) => ({
        correctionType: taskCorrectionTypeSchema.parse(
          correction.correction_type,
        ),
        createdAt: correction.created_at,
        id: correction.id,
        replacementLabels: correction.replacement_labels,
        sourceTaskInstanceIds,
        splitAfterStepOrdinal: correction.split_after_step_ordinal,
      })),
    );
  }, [correctionSources, corrections, tasks]);

  function toggleSources(sourceIds: string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of sourceIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return [...next];
    });
  }

  async function enqueue(windowId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: enqueueError } = await supabase.rpc(
      'enqueue_task_inference',
      { target_observation_window_id: windowId },
    );
    setBusy(false);
    if (enqueueError) setError(enqueueError.message);
    else {
      setMessage('Task inference queued. Keep the local worker running.');
      await reload();
    }
  }

  async function correct(
    correctionType: 'rename' | 'merge' | 'split' | 'reject',
  ) {
    const parsed = taskCorrectionInputSchema.safeParse({
      correctionType,
      reason: reason.trim() || null,
      replacementLabels:
        correctionType === 'reject'
          ? []
          : correctionType === 'split'
            ? [primaryLabel, secondaryLabel]
            : [primaryLabel],
      splitAfterStepOrdinal:
        correctionType === 'split' ? Number(splitOrdinal) : null,
      taskInstanceIds: selected,
      workspaceId,
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.message ?? 'Check the correction fields.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    const correction = parsed.data;
    const { error: correctionError } = await supabase.rpc(
      'create_task_correction',
      {
        target_correction_type: correction.correctionType,
        ...(correction.reason ? { target_reason: correction.reason } : {}),
        target_replacement_labels: correction.replacementLabels,
        ...(correction.splitAfterStepOrdinal
          ? {
              target_split_after_step_ordinal: correction.splitAfterStepOrdinal,
            }
          : {}),
        target_task_instance_ids: correction.taskInstanceIds,
        target_workspace_id: correction.workspaceId,
      },
    );
    setBusy(false);
    if (correctionError) setError(correctionError.message);
    else {
      setMessage('Correction saved without changing the original inference.');
      setSelected([]);
      setPrimaryLabel('');
      setSecondaryLabel('');
      setSplitOrdinal('');
      setReason('');
      await reload();
    }
  }

  return (
    <section className="card setup-section" id="task-analysis">
      <div className="section-heading">
        <div>
          <span className="step-number">05</span>
          <h2>Inferred browser tasks</h2>
        </div>
        <p>
          Queue completed observations, inspect evidence, and preserve analyst
          corrections.
        </p>
      </div>
      {error ? <p className="notice notice-error">{error}</p> : null}
      {message ? <p className="notice notice-success">{message}</p> : null}

      <div className="analysis-grid">
        <div>
          <h3>Completed observations</h3>
          <div className="item-list">
            {windows.length === 0 ? (
              <p className="muted-copy">
                No completed observation windows yet.
              </p>
            ) : null}
            {windows.map((window) => {
              const job = jobs.find((item) => item.entity_id === window.id);
              return (
                <div className="list-row" key={window.id}>
                  <div>
                    <strong>{window.department_snapshot}</strong>
                    <span>
                      {window.role_snapshot ?? 'Role not specified'} ·{' '}
                      {new Date(window.started_at).toLocaleString()}
                    </span>
                    {job?.error_detail ? <span>{job.error_detail}</span> : null}
                  </div>
                  <button
                    className="button button-secondary"
                    disabled={
                      busy ||
                      job?.status === 'queued' ||
                      job?.status === 'running'
                    }
                    onClick={() => void enqueue(window.id)}
                    type="button"
                  >
                    {job?.status === 'queued' || job?.status === 'running'
                      ? job.status
                      : job?.status === 'failed'
                        ? 'Retry inference'
                        : runs.some(
                              (run) => run.observation_window_id === window.id,
                            )
                          ? 'Reprocess'
                          : 'Infer tasks'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h3>Latest inference</h3>
          {latestRun ? (
            <p className="muted-copy">
              {latestWindow?.department_snapshot ?? 'Observation'} ·{' '}
              {latestRun.model} · {latestRun.task_count} inferred tasks
            </p>
          ) : (
            <p className="muted-copy">
              Run the local worker after queueing an observation.
            </p>
          )}
          <div className="task-list">
            {effectiveResolution.tasks.map((task) => (
              <label className="task-card" key={task.effectiveId}>
                <input
                  checked={task.sourceTaskInstanceIds.every((id) =>
                    selected.includes(id),
                  )}
                  onChange={(event) =>
                    toggleSources(
                      task.sourceTaskInstanceIds,
                      event.target.checked,
                    )
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{task.neutralLabel}</strong>
                  <span>{task.apparentObjective}</span>
                  <small>
                    Steps {task.startStepOrdinal}–{task.endStepOrdinal} ·{' '}
                    {Math.round(task.confidence * 100)}% confidence ·{' '}
                    {task.participatingSystems.join(', ')}
                    {task.correctionId ? ' · analyst corrected' : ''}
                  </small>
                </span>
              </label>
            ))}
          </div>
          {effectiveResolution.rejectedSourceTaskIds.length > 0 ? (
            <p className="muted-copy">
              {effectiveResolution.rejectedSourceTaskIds.length} inferred task
              {effectiveResolution.rejectedSourceTaskIds.length === 1
                ? ''
                : 's'}{' '}
              excluded by an analyst.
            </p>
          ) : null}
          {tasks.length > 0 ? (
            <details>
              <summary>Original model inference</summary>
              <ol>
                {tasks.map((task) => (
                  <li key={task.id}>
                    {task.neutral_label} (steps {task.start_step_ordinal}–
                    {task.end_step_ordinal})
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
          {exclusions.length > 0 ? (
            <details>
              <summary>
                {exclusions.length} excluded context/noise range(s)
              </summary>
              <ol>
                {exclusions.map((exclusion) => (
                  <li key={exclusion.id}>
                    Steps {exclusion.start_step_ordinal}–
                    {exclusion.end_step_ordinal}: {exclusion.classification}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className="correction-panel">
          <h3>Analyst correction</h3>
          <p className="muted-copy">
            Select one task to rename, split, or reject; select two or more to
            merge.
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
              Split after step
              <input
                min={1}
                type="number"
                value={splitOrdinal}
                onChange={(event) => setSplitOrdinal(event.target.value)}
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
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => void correct('rename')}
              type="button"
            >
              Rename
            </button>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => void correct('merge')}
              type="button"
            >
              Merge
            </button>
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => void correct('split')}
              type="button"
            >
              Split
            </button>
            <button
              className="button button-quiet danger"
              disabled={busy}
              onClick={() => void correct('reject')}
              type="button"
            >
              Reject
            </button>
          </div>
          <p className="muted-copy">
            {
              corrections.filter((correction) =>
                correctionSources.some(
                  (source) =>
                    source.correction_id === correction.id &&
                    tasks.some((task) => task.id === source.task_instance_id),
                ),
              ).length
            }{' '}
            correction overlay(s) recorded for this inference.
          </p>
        </div>
      ) : null}
    </section>
  );
}
