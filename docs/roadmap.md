# Reflow incremental implementation roadmap

## Product direction

Reflow is a browser-only process discovery and redesign system. During explicit
observation windows, it captures sanitized interactions across approved browser
systems, infers recurring tasks without relying on existing documentation,
reconstructs As-Is processes, and proposes analyst-reviewed To-Be improvements.

Department and role selections provide grouping context; they do not define
expected tasks. Local applications, document contents, agent execution, MCP, and
skill generation are outside the repository's scope.

## Delivery rules

Every phase follows the same delivery contract:

1. Implement only the current phase.
2. Run all checkpoint tests.
3. Fix failures before continuing.
4. Review the working-tree diff for unrelated changes.
5. Commit only after the checkpoint passes.
6. Report the commit and verification results.
7. Stop until the next phase is explicitly requested.

A failed checkpoint is never committed as complete. Later-phase scaffolding is
not added early unless the current phase requires a shared interface.

## Status overview

| Phase | Name                                  | Status   | Primary commit |
| ----- | ------------------------------------- | -------- | -------------- |
| 0     | Repository foundation                 | Complete | `60dfb02`      |
| 1     | Browser observation schema            | Complete | `0b715e2`      |
| 2     | Study setup and user guidance         | Complete | `26864f1`      |
| 3     | Privacy-safe browser observer         | Complete | `5cf61d1`      |
| 4     | Step normalization and task inference | Complete | —              |
| 5     | As-Is process mining                  | Planned  | —              |
| 6     | Analysis and To-Be redesign           | Planned  | —              |
| 7     | Export and portfolio hardening        | Planned  | —              |

## Phase 0 — Repository foundation

**Status:** Complete

### Scope

- Establish the Reflow product name and `@reflow/*` package namespace.
- Initialize the pnpm TypeScript workspace.
- Add application shells for the web interface, extension, and local worker.
- Add shared contracts and the provider-neutral AI boundary.
- Configure strict TypeScript, ESLint, Prettier, Vitest, environment validation,
  and root workspace commands.
- Document the local-only architecture: local UI, local worker, unpacked
  extension, hosted Supabase, and Vercel AI Gateway.
- Exclude MCP, agent execution, Docker, local Supabase, and deployment
  configuration.

### Checkpoint

- Fresh dependency installation succeeds.
- Type checking, linting, tests, and production builds pass.
- No secrets or machine-specific files are tracked.
- Root development commands are documented.

### Delivery

- `60dfb02 chore: initialize reflow workspace`

## Phase 1 — Browser observation schema

**Status:** Complete

### Scope

Create the hosted Supabase foundation for browser observation:

- `workspaces`
- `workspace_members`
- `departments`
- `job_roles`
- `allowed_domains`
- `workspace_invites`
- `observer_installations`
- `observation_windows`
- `raw_event_tokens`
- `processing_jobs`

Observation windows retain department and role snapshots. Immutable raw events
contain only sanitized browser metadata: sequence number, action, approved
hostname, normalized path, element role and label, page landmark, semantic input
token, local tab identifier, and timestamps.

Add workspace-isolated RLS, owner enforcement, approved-domain enforcement,
active-window checks, hashed invites, durable job claiming, indexes, constraints,
foreign keys, generated TypeScript types, and descriptions for database objects.

Document ingestion and embeddings are intentionally absent. If embeddings are
introduced later, the exact configuration name is `REFLOW_EMBEDDING_MODEL`.

### Checkpoint

- Hosted migrations and schema lint pass.
- Cross-workspace access is denied.
- Invalid and revoked invites cannot be redeemed.
- Raw events cannot be updated or deleted.
- Unapproved domains cannot insert events.
- Concurrent workers cannot claim the same job.
- Full workspace checks pass.

### Delivery

- `0b715e2 feat: add browser observation schema`
- `a1bd97b docs: describe browser observation schema`

## Phase 2 — Study setup and user guidance

**Status:** Complete

### Scope

Build the local administrator and observer setup interface.

Administrators configure:

- Workspace name
- Departments
- Common job roles
- Approved browser domains
- Privacy exclusions
- Extension invite codes and revocation

Observers redeem an invite, select a required department, and choose a common or
custom role. Those defaults may be overridden when an observation begins.
Historical windows retain their original snapshots when a profile changes.

Reflow never asks observers to name workflows or describe expected tasks.

### Checkpoint

- Administrators can manage departments, roles, domains, exclusions, and invites.
- Observers can join and save defaults.
- Observation cannot start without a department.
- Profile changes do not rewrite historical windows.
- Only approved domains are observable.
- Full workspace checks pass.

### Delivery

- `26864f1 feat: add observation study setup`
- `c741d2e fix: complete phase 2 observer flow`

## Phase 3 — Privacy-safe browser observer

**Status:** Complete

### Scope

Implement the WXT Manifest V3 extension with:

- Explicit start, pause, resume, and stop controls
- A visible active state
- Observation across approved domains and tabs
- Optional host permission requested during the start gesture
- No automatic restart after Chrome relaunch
- No Incognito observation
- Anonymous `out_of_scope_gap` records without unapproved host details

Capture browser-only actions:

- Interactive clicks
- Sanitized input changes
- Form submissions
- Full navigation
- SPA and hash navigation
- Tab activation
- Approved-domain transitions
- Generalized upload and download actions

Files retain only generalized type and size categories. Filenames, paths,
contents, and bytes are prohibited.

Enforce content-script-first sanitization:

```text
DOM interaction
  -> content-script classification and redaction
  -> raw value discarded
  -> SanitizedCapturedEvent
  -> extension IPC
  -> service-worker validation
  -> sanitized queue
  -> Supabase
```

Password values are rejected before access. IPC excludes raw values, HTML,
unrestricted metadata, and unbounded text. The service worker provides batching,
retry backoff, sequence numbers, client UUIDs, duplicate protection, and
restart-safe delivery recovery.

The Phase 3 hardening pass additionally:

- Uses field intent to distinguish currency, dates, government IDs, payment
  cards, phone numbers, selections, and general text.
- Generalizes dynamic record identifiers in paths and element labels.
- Prevents select options and helper text from becoming control labels.
- Suppresses duplicate gap records and same-domain tab-activation noise.

### Checkpoint

- Observation controls work across approved browser systems.
- Unapproved systems expose no hostname or DOM data.
- Sentinel PII never crosses IPC or reaches extension storage or Supabase.
- Password values are never read.
- Chrome restart does not resume observation.
- Filenames, paths, contents, and bytes are never retained.
- Traditional and SPA navigation fixtures pass.
- Queue retries are ordered, idempotent, and recoverable.
- Full workspace checks pass.

### Delivery

- `5cf61d1 feat: add explicit browser observation`
- `174aee9 test: add synthetic browser workflow lab`
- `c860978 fix: recover stalled extension deliveries`
- `9438f5b fix: harden sanitized browser events`

## Phase 4 — Step normalization and task inference

**Status:** Complete

### Scope

Transform sanitized events into evidence-backed task instances and recurring task
clusters:

```text
Sanitized events
  -> normalized steps
  -> activity segments
  -> inferred task instances
  -> recurring task clusters
```

Deterministic preprocessing:

- Order events by observation window and sequence.
- Collapse identical consecutive actions within one second.
- Normalize paths and labels.
- Preserve approved cross-domain transitions.
- Split activity after five minutes of inactivity.
- Treat shorter inactivity, major navigation, and tab changes as candidate
  boundaries.
- Retain source-event links for every derived step.

Use Vercel AI Gateway structured output to infer task boundaries, neutral labels,
apparent objectives, participating browser systems, supporting steps, and
confidence. Analysts can rename, merge, split, or reject inferred tasks;
corrections remain separate from the original inference.

### Checkpoint

- Fixture traces produce expected boundaries.
- Cross-system tasks remain connected.
- Idle periods split activity predictably.
- Every task links to source evidence.
- Invalid model output cannot corrupt results.
- Analyst corrections preserve the original inference.
- Reprocessing is idempotent.
- Full workspace checks pass.

### Delivery

`feat: add browser task inference`

## Phase 5 — As-Is process mining

**Status:** Planned

### Scope

Group recurring tasks into department- and role-level process candidates:

```text
Task instances
  -> task clusters
  -> task-transition graph
  -> process candidates
  -> process variants
```

Calculate:

- Task frequency
- Median and high-percentile duration
- Participating browser systems
- Common sequences and variants
- Loops and backtracking
- Repeated data entry
- Navigation churn
- Long waits
- Abandoned tasks
- Role and department differences

Every process candidate includes an inferred name, representative traces,
metrics, observed roles and departments, confidence, evidence coverage, gaps,
and source observations.

Start with deterministic signatures, sequence similarity, and structured model
inference. Add embeddings only if benchmark fixtures demonstrate a clustering
problem. Any embeddings must use Vercel AI Gateway, record model and version,
and use `REFLOW_EMBEDDING_MODEL`.

Analysts can merge, split, rename, confirm, or reject candidates without losing
evidence.

### Checkpoint

- Repeated fixtures form stable clusters.
- Variants remain distinguishable.
- Noise does not become a process.
- Metrics reproduce deterministically.
- Every finding links to observations.
- Analyst corrections preserve evidence.
- Full workspace checks pass.

### Planned commit

`feat: add as-is process mining`

## Phase 6 — Analysis and To-Be redesign

**Status:** Planned

### Scope

Analyze only analyst-confirmed process candidates and generate:

- Canonical As-Is process
- Friction and waste findings
- Redundant steps
- Manual re-entry patterns
- Cross-system inefficiencies
- Navigation and waiting bottlenecks
- Proposed To-Be process
- Consolidated or removed steps
- Automation candidates
- Controls and approval points
- Exception and escalation rules
- Expected step and time reduction
- Confidence and unresolved questions

Every recommendation must cite observed task clusters, representative traces,
metrics, systems, and analyst corrections. Unsupported recommendations are
rejected or explicitly labeled as hypotheses.

Analysts can edit, comment, regenerate, reject, and approve. Approved versions
are immutable, and regeneration never deletes prior versions.

### Checkpoint

- Findings cite valid evidence.
- Unsupported claims are rejected or marked uncertain.
- Analyst edits create new versions.
- Approval freezes the selected version.
- Regeneration preserves prior versions.
- Invalid model output creates a visible failed job.
- Full workspace checks pass.

### Planned commit

`feat: add process redesign analysis`

## Phase 7 — Export and portfolio hardening

**Status:** Planned

### Scope

Export approved processes as:

- Versioned machine-readable JSON
- Human-readable Markdown analysis reports

JSON includes observation coverage, departments and roles, inferred tasks, the
As-Is graph, variants, metrics, findings, the approved To-Be process, controls,
exceptions, confidence, corrections, limitations, and provenance.

Markdown includes an executive summary, study scope, inferred daily tasks,
observed systems, As-Is processes, variants, performance analysis, To-Be
recommendations, automation candidates, controls, exceptions, confidence, and
methodology.

Add synthetic multi-system fixtures, setup and privacy documentation, and a
reproducible local demonstration. Review licenses, secret handling, errors, and
sample-data safety. Remove dead scaffolding and confirm that no MCP or execution
engine code exists.

### Checkpoint

- JSON validates against its versioned schema.
- Markdown matches the approved version.
- Exports are deterministic.
- Draft and rejected processes cannot be exported as approved.
- The synthetic observation runs end to end.
- A fresh clone can be configured from documented steps.
- No secrets, PII, local-machine capture, MCP, or execution code exists.
- Full workspace checks pass and the working tree is clean.

### Planned commit

`feat: add process analysis exports`

## Shared public interfaces

- `SanitizedCapturedEvent` — the only event permitted across extension IPC.
- `ObservationWindow` — explicit browser-observation period with department and
  role snapshots.
- `NormalizedStep` — deterministic representation of one observed browser
  action.
- `TaskInstance` — inferred bounded activity with source evidence and confidence.
- `TaskCluster` — recurring group of corrected or inferred task instances.
- `ProcessCandidate` — recurring task-transition graph with variants and metrics.
- `RedesignedBlueprint` — versioned As-Is analysis and proposed To-Be process.
- `ProcessPackage` — approved versioned export with provenance.

All interfaces use shared runtime schemas.

## Standing assumptions

- Reflow observes browser interactions only.
- Every observation window requires explicit initiation.
- Chrome restart never silently resumes observation.
- Department and role guide grouping but do not define expected tasks.
- Reflow infers tasks without process manuals or uploaded documentation.
- Raw input values and document contents are never retained.
- Hosted Supabase and Vercel AI Gateway are the only required web services.
- All Reflow application processes run locally.
- Agent execution and skill creation remain downstream concerns.
