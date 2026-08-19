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
Compound click, submit, and navigation telemetry shares a stable interaction
group without losing individual evidence. Observation-start page context is
recorded separately from user work.

Task inference calls use structured output through the shared Vercel AI Gateway
package. After the observer stops an observation, hard activity segments are
processed sequentially in batches of at most 150 assignable steps with bounded
context around soft seams. Seam candidates are reconciled without crossing a
five-minute boundary. Model output must classify every step as task evidence or
explicit context/noise before a single transactional database call persists the
result. Stable digests and evidence-based cluster identifiers make retries and
label changes deterministic. Analyst corrections remain immutable overlays;
the UI resolves their latest effective projection without editing original
model evidence.

Phase 5 selects the latest successful inference for every completed observation
in a department, applies analyst task corrections, and freezes those effective
tasks into a versioned mining run. Deterministic structured-evidence similarity
forms task clusters. Gateway structured output separates back-to-back process
instances inside each five-minute-bounded activity segment, while exact coverage
validation prevents invented or dropped tasks. Ordered sequence similarity then
promotes only groups with at least two observed instances to recurring process
candidates. Metrics, graph edges, variants, and findings are calculated
deterministically and retain observation provenance.

## Phase 4 data flow

```text
raw_event_tokens
  -> normalized_steps + normalized_step_events
  -> activity_segments
  -> task_inference_runs + task_instances + task_instance_steps
  -> task_inference_exclusions + task_inference_exclusion_steps
  -> task_clusters + task_cluster_members
  -> task_corrections + task_correction_sources
```

## Phase 5 data flow

```text
latest task_inference_runs + task_corrections
  -> process_mining_runs + process_task_snapshots
  -> process_instances + process_unmatched_work
  -> process_candidates + process_candidate_instances
  -> process_variants + process_graph_edges + process_findings
  -> process_candidate_corrections + correction sources
```

Original task inference and process mining results remain immutable. Analyst
decisions resolve into an effective candidate projection; confirmed candidates
are the only Phase 6 redesign inputs.

Raw events remain immutable. Every derived task retains ordered links to its
normalized steps, and every normalized step retains links to its sanitized
source events. Every normalized step is covered by either a task or a persisted
exclusion. Department and role snapshots provide grouping context without
prescribing which tasks the model should find.

Reflow begins without document ingestion or vector search. Task inference is
grounded in sanitized browser traces; embeddings will be introduced only if
later clustering benchmarks demonstrate a need. Any future embedding setting
must use the exact name `REFLOW_EMBEDDING_MODEL`. The evaluation criteria and
provider-neutral integration constraints are documented in
[Future embedding support](future-embeddings.md).

## Product boundary

Reflow ends at process discovery, analysis, redesign, approval, and export. It
does not expose an MCP server, execute browser agents, install skills, or contain
deployment infrastructure.

## Phased delivery

Each phase is independently implemented, checked, and committed. A phase does
not begin until the previous checkpoint has passed and been reviewed.

See the [incremental implementation roadmap](roadmap.md) for every phase's
scope, checkpoint, status, and delivery history.
