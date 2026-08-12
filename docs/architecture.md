# Local architecture

Reflow separates browser observation, durable state, local processing, and model
access so each boundary can be tested independently.

```text
Chrome extension -- sanitized event inserts --> Hosted Supabase
                                                   ^       ^
                                                   |       |
Local Next.js UI -- queue jobs + corrections ------+       |
                                                           |
Local worker -- claim jobs -------------------------------+
      |                                                    |
      +--> Vercel AI Gateway -- validated inference -------+
```

The local workflow lab serves synthetic AP, ERP, and payment experiences on
separate `*.localhost` hostnames. It provides deterministic browser traces for
extension verification now and process-mining demonstrations in later phases.

## Runtime boundaries

The Chrome extension is the observation boundary. Its content script sanitizes
DOM data before extension IPC, and the service worker accepts only the shared
`SanitizedCapturedEvent` contract. The extension uses only a Supabase
publishable key and never receives trusted server credentials.

Observation state lives in extension session storage, while the offline queue
contains sanitized events only. Approved host permissions are requested during
the observer's explicit start gesture. Runtime content scripts are registered
without persistence, so Chrome restart cannot silently resume observation.

Hosted Supabase provides Auth, Postgres, and the Data API. Observation windows
and raw events are Realtime-enabled for future live UI updates, but the current
pipeline uses direct event inserts and durable job polling. Schema changes are
committed as migrations and pushed to a linked hosted development project.
Reflow does not run a local Supabase stack.

The Next.js application runs on localhost and provides study setup, task review,
process analysis, and human approval. Normal browser operations use a Supabase
publishable key and are constrained by RLS and role-validating RPCs. The
Supabase secret key is used only by trusted local processes, including the admin
authorization route and worker; it is never included in browser bundles.

The Node worker runs locally and atomically claims durable jobs from Supabase.
Abandoned locks become reclaimable after ten minutes so a worker restart does
not strand an observation. Phase 4 deterministically orders and collapses raw
events, records source-event evidence for every normalized step, and splits hard
activity segments after five minutes of inactivity. Shorter pauses, navigation,
tab changes, and cross-domain transitions remain model-visible boundary hints.

Task inference calls use structured output through the shared Vercel AI Gateway
package. Model output is validated before a single transactional database call
persists the inference run, bounded tasks, evidence links, and deterministic
task clusters. Stable digests and identifiers make retries idempotent. Analyst
corrections are separate immutable overlays rather than edits to original model
evidence.

## Phase 4 data flow

```text
raw_event_tokens
  -> normalized_steps + normalized_step_events
  -> activity_segments
  -> task_inference_runs + task_instances + task_instance_steps
  -> task_clusters + task_cluster_members
  -> task_corrections + task_correction_sources
```

Raw events remain immutable. Every derived task retains ordered links to its
normalized steps, and every normalized step retains links to its sanitized
source events. Department and role snapshots provide grouping context without
prescribing which tasks the model should find.

Reflow begins without document ingestion or vector search. Task inference is
grounded in sanitized browser traces; embeddings will be introduced only if
later clustering benchmarks demonstrate a need. Any future embedding setting
must use the exact name `REFLOW_EMBEDDING_MODEL`.

## Product boundary

Reflow ends at process discovery, analysis, redesign, approval, and export. It
does not expose an MCP server, execute browser agents, install skills, or contain
deployment infrastructure.

## Phased delivery

Each phase is independently implemented, checked, and committed. A phase does
not begin until the previous checkpoint has passed and been reviewed.

See the [incremental implementation roadmap](roadmap.md) for every phase's
scope, checkpoint, status, and delivery history.
