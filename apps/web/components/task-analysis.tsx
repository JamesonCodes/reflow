'use client';

import { taskCorrectionInputSchema, type Tables } from '@reflow/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { getSupabaseBrowserClient } from '../lib/supabase-browser';

type Supabase = NonNullable<ReturnType<typeof getSupabaseBrowserClient>>;
type ObservationWindow = Tables<'observation_windows'>;
type ProcessingJob = Tables<'processing_jobs'>;
type InferenceRun = Tables<'task_inference_runs'>;
type TaskInstance = Tables<'task_instances'>;
type TaskCorrection = Tables<'task_corrections'>;

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
    const latestRun = nextRuns[0];
    if (!latestRun) return setTasks([]);
    const taskResult = await supabase
      .from('task_instances')
      .select('*')
      .eq('inference_run_id', latestRun.id)
      .order('task_ordinal');
    if (taskResult.error) setError(taskResult.error.message);
    else setTasks(taskResult.data ?? []);
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
            {tasks.map((task) => (
              <label className="task-card" key={task.id}>
                <input
                  checked={selected.includes(task.id)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, task.id]
                        : current.filter((id) => id !== task.id),
                    )
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{task.neutral_label}</strong>
                  <span>{task.apparent_objective}</span>
                  <small>
                    Steps {task.start_step_ordinal}–{task.end_step_ordinal} ·{' '}
                    {Math.round(Number(task.confidence) * 100)}% confidence ·{' '}
                    {task.participating_systems.join(', ')}
                  </small>
                </span>
              </label>
            ))}
          </div>
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
            {corrections.length} correction{corrections.length === 1 ? '' : 's'}{' '}
            recorded.
          </p>
        </div>
      ) : null}
    </section>
  );
}
