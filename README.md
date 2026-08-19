# Reflow

> **Let agents learn your work. Then automate it.**

Reflow is a local-first, browser-only process discovery and redesign prototype.
During explicit observation windows, it records privacy-safe interaction metadata
across approved browser systems, reconstructs how work actually happens, and
prepares evidence-backed process improvements for analyst review.

The prototype is designed as an open-source portfolio project. All Reflow
application processes run locally; hosted Supabase provides authentication and
durable data, while Vercel AI Gateway will provide a provider-neutral model
boundary beginning with task inference.

Reflow currently covers study setup, privacy-safe browser observation, and
evidence-backed browser task inference, including bounded post-observation
analysis for all-day recording windows. Process mining, redesign, and export are delivered incrementally through the
[project roadmap](docs/roadmap.md).

## Why Reflow

Traditional process discovery often starts with interviews and process manuals.
Those sources are useful, but they can be incomplete or outdated. Reflow starts
with observed browser activity instead:

- What tasks does a team repeatedly perform?
- Which browser systems participate in each task?
- Where do people backtrack, re-enter data, wait, or abandon work?
- Which process variants are common, and which are exceptional?
- What could be simplified or automated without losing controls?

Department and role selections provide grouping context. They never prescribe
which tasks Reflow expects to find.

## How it works

```text
Explicit observation window
          |
          v
Chrome content script --- local classification and redaction
          |
          v
Sanitized extension queue --- retries, ordering, duplicate protection
          |
          v
Hosted Supabase --- observations, events, jobs, and process evidence
          |
          v
Local worker + Vercel AI Gateway --- task inference and process analysis
          |
          v
Local Next.js UI --- analyst correction, redesign, approval, and export
```

The content script is the privacy boundary. Raw input values are discarded before
extension messaging, background memory, storage, logs, or Supabase requests.

## Current status

| Phase | Capability                            | Status   |
| ----- | ------------------------------------- | -------- |
| 0     | Repository foundation                 | Complete |
| 1     | Browser observation schema            | Complete |
| 2     | Study setup and user guidance         | Complete |
| 3     | Privacy-safe browser observer         | Complete |
| 4     | Step normalization and task inference | Complete |
| 5     | As-Is process mining                  | Complete |
| 6     | Analysis and To-Be redesign           | Planned  |
| 7     | Export and portfolio hardening        | Planned  |

See [docs/roadmap.md](docs/roadmap.md) for the scope, checkpoint, and commit
history of every phase.

## Privacy model

Reflow is intentionally constrained:

- Observation starts only after an explicit user gesture.
- Only administrator-approved domains can be observed.
- Sensitive URL paths can be excluded from observation.
- Password values are rejected before their value is read.
- Input values become semantic tokens such as `[EMAIL]`, `[DATE]`, or
  `[NUMBER:CURRENCY]`.
- Dynamic record identifiers are generalized in paths and labels.
- Uploads and downloads retain only generalized type and size categories.
- Unapproved systems produce anonymous `out_of_scope_gap` events without host,
  path, or DOM details.
- Chrome restart never silently resumes an observation.
- Raw events are immutable and isolated by workspace in Supabase.

Reflow does not observe local applications, read document contents, record the
screen, capture keystrokes globally, or run in Incognito.

## Repository structure

| Path                 | Responsibility                                               |
| -------------------- | ------------------------------------------------------------ |
| `apps/web`           | Local Next.js study setup, analysis, and approval interface  |
| `apps/extension`     | Unpacked WXT Manifest V3 Chrome observer                     |
| `apps/demo`          | Synthetic multi-system browser workflow lab                  |
| `apps/worker`        | Local durable processing worker                              |
| `packages/contracts` | Shared Zod schemas, database types, and TypeScript contracts |
| `packages/ai`        | Exclusive Vercel AI Gateway boundary for model calls         |
| `supabase`           | Hosted Supabase migrations and verification assets           |
| `docs`               | Architecture and phased implementation documentation         |

## Requirements

- Node.js 22 or newer
- pnpm 9.12.3
- Google Chrome or another Chromium browser that supports unpacked extensions
- A hosted Supabase project
- A Vercel AI Gateway key beginning with Phase 4

Docker, a local Supabase stack, application deployment, and local-machine capture
are intentionally not required.

## Local setup

### 1. Install dependencies

From the repository root:

```sh
pnpm install
```

### 2. Configure the environment

Copy `.env.example` to `.env.local` and provide values for:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
WXT_SUPABASE_URL=https://your-project.supabase.co
WXT_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key
REFLOW_ADMIN_EMAILS=you@example.com
AI_GATEWAY_API_KEY=your-ai-gateway-key
REFLOW_TASK_INFERENCE_MODEL=openai/gpt-5-mini
REFLOW_PROCESS_MINING_MODEL=openai/gpt-5-mini
```

The secret key and administrator allowlist are read only by trusted local
processes. Never commit `.env.local`.

In the hosted Supabase dashboard:

1. Enable anonymous sign-ins.
2. Keep email magic-link sign-in enabled.
3. Set `http://localhost:3000` as the Site URL.
4. Add `http://localhost:3000` as an allowed redirect URL.

The repository is linked to a hosted Supabase project through the Supabase CLI;
no local database is started.

### 3. Start Reflow and the workflow lab

Run this from the repository root:

```sh
pnpm dev
```

This starts the local dashboard, worker, extension watcher, and synthetic browser
systems:

| Experience         | URL                                                      |
| ------------------ | -------------------------------------------------------- |
| Reflow dashboard   | [http://localhost:3000](http://localhost:3000)           |
| Invoice Hub        | [http://ap.localhost:3100](http://ap.localhost:3100)     |
| Atlas ERP          | [http://erp.localhost:3100](http://erp.localhost:3100)   |
| Clearline Payments | [http://bank.localhost:3100](http://bank.localhost:3100) |

Modern browsers resolve `*.localhost` to the local machine. Press `Ctrl+C` to
stop every process. To run only the synthetic systems, use `pnpm demo`.

### 4. Load the Chrome extension

Build the extension at least once:

```sh
pnpm --filter @reflow/extension build
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select `apps/extension/.output/chrome-mv3`.
5. After rebuilding, use the extension card's **Reload** button rather than
   removing the extension.

### 5. Configure and run an observation

1. Open the Reflow dashboard and sign in as an allowlisted administrator.
2. Create a workspace, department, role, and extension invite.
3. Approve `localhost` and enable **Include subdomains**.
4. Add `/private` as a privacy exclusion.
5. Do not approve `127.0.0.1`; the demo uses it to verify anonymous gaps.
6. Redeem the invite in the extension and save observer defaults.
7. Open Invoice Hub and explicitly start an observation.
8. Follow the guided workflow through Invoice Hub, Atlas ERP, and Clearline
   Payments.
9. Stop the observation from the extension.

All records in the workflow lab are synthetic.

## Verify captured events

Run this in the hosted Supabase SQL Editor:

```sql
with latest_window as (
  select id
  from public.observation_windows
  order by started_at desc
  limit 1
)
select
  sequence_no,
  action_type,
  hostname,
  normalized_path,
  element_role,
  element_label,
  page_landmark,
  semantic_input_token,
  tab_id,
  occurred_at
from public.raw_event_tokens
where observation_window_id = (select id from latest_window)
order by sequence_no;
```

Sequence numbers should be continuous. The results should contain semantic
tokens and normalized paths, never raw form values, passwords, filenames, query
strings, or out-of-scope host details.

## Infer browser tasks

With `AI_GATEWAY_API_KEY`, `REFLOW_TASK_INFERENCE_MODEL`, and the trusted
Supabase secret configured, keep `pnpm dev` running and return to the
administrator dashboard. Open **Inferred tasks**, queue a completed observation,
and refresh after the local worker finishes. Reflow shows neutral task labels,
apparent objectives, participating browser systems, supporting step ranges, and
confidence.

Analysts can rename, merge, split, or reject inferred tasks. Corrections are
stored as immutable overlays; the original model inference and its source-event
evidence remain unchanged.

## Mine As-Is processes

After at least two comparable process instances have been inferred, open
**As-Is process mining**, select a department, and queue a mining run. Reflow
uses the latest effective analyst-corrected tasks, deterministic evidence
signatures, ordered sequence similarity, and structured Vercel AI Gateway
boundaries to produce recurring candidates, exact variants, timing metrics,
transition graphs, and evidence-backed findings.

Single observations and unmatched task sequences remain visible as evidence but
are not promoted to recurring processes. Analysts can rename, merge, split,
confirm, or reject candidates through immutable correction overlays. Phase 6
will consume confirmed effective candidates only.

## Development commands

| Command             | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Start all local Reflow processes and the workflow lab |
| `pnpm demo`         | Start only the synthetic browser systems              |
| `pnpm format:check` | Check repository formatting                           |
| `pnpm lint`         | Run ESLint                                            |
| `pnpm typecheck`    | Type-check every workspace package                    |
| `pnpm test`         | Run all unit and fixture tests                        |
| `pnpm build`        | Build all applications and packages                   |
| `pnpm check`        | Run formatting, linting, types, tests, and builds     |

## Project boundaries

This repository ends at browser process discovery, analysis, redesign, human
approval, and export. Agent execution, MCP servers, skill generation, task replay,
and deployment infrastructure are downstream concerns and are not implemented
here.

Embeddings are also deferred. They will be introduced only if Phase 5 benchmark
fixtures demonstrate that deterministic and sequence-based clustering is
insufficient. Any future embedding configuration must use the exact variable
name `REFLOW_EMBEDDING_MODEL`.

## Documentation

- [Architecture](docs/architecture.md)
- [Incremental implementation roadmap](docs/roadmap.md)
- [Future embedding support](docs/future-embeddings.md)

## License

Reflow is available under the [MIT License](LICENSE).
