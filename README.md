# Reflow

Reflow is a local-first process discovery and redesign prototype. It combines
privacy-safe browser observation with process mining and AI-assisted future-state
workflow design.

Reflow application code runs on your computer. Hosted Supabase provides durable
data services, while Vercel AI Gateway provides a provider-neutral model API.
Reflow is not deployed and does not execute browser agents.

## Architecture

- `apps/web` — local Next.js study setup, analysis, and approval interface
- `apps/extension` — unpacked Chrome extension for explicit observation windows
- `apps/worker` — local durable processing worker
- `packages/contracts` — shared runtime schemas and TypeScript contracts
- `packages/ai` — exclusive AI Gateway boundary (used beginning with task inference)
- `supabase` — hosted Supabase migrations and verification assets

See [docs/architecture.md](docs/architecture.md) for the runtime boundaries and
phased delivery model.

## Requirements

- Node.js 22 or newer
- pnpm 9.12.3
- A hosted Supabase project (required beginning in Phase 1)
- A Vercel AI Gateway key (required beginning with AI task inference)

Docker and a local Supabase stack are intentionally not used.

## Local commands

```sh
pnpm install
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

`pnpm dev` starts the currently implemented local application shells. As later
phases land, it will also start the extension watcher and processing worker.

## Phase 2 study setup

Copy `.env.example` to `.env.local`, then configure the hosted Supabase URL,
publishable key, and secret key. Add one or more comma-separated email addresses
to `REFLOW_ADMIN_EMAILS`. The secret key and administrator allowlist are read
only by the local Next.js server and are never included in browser code. Never
commit `.env.local`.

In the hosted Supabase dashboard:

1. Enable anonymous sign-ins under Authentication settings.
2. Add `http://localhost:3000` as the Site URL and an allowed redirect URL.
3. Keep email magic-link sign-in enabled.

Start the local interface with `pnpm dev`, choose **Administrator**, and use an
allowlisted email address. Administrators can create a study workspace, define
departments and common roles, approve browser domains, exclude sensitive URL
paths, and generate revocable observer invites.

Observers choose **Observer**, redeem an invite, and save a required department
plus either a common or custom role. These are grouping defaults only: Reflow
does not ask observers to identify workflows or expected tasks. Browser
observation starts only when the observer explicitly chooses **Start** in the
unpacked extension.

## Phase 3 browser observer

The extension uses the same hosted Supabase project as the local interface. Add
`WXT_SUPABASE_URL` and `WXT_SUPABASE_PUBLISHABLE_KEY` to `.env.local`, then run:

```sh
pnpm --filter @reflow/extension build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load
unpacked**, and select `apps/extension/.output/chrome-mv3`. The extension remains
local and unpacked.

Redeem an observer invite in the extension, choose a department and role, and
open an approved browser system. **Start observation** requests access only to
the study's approved domains. Pause, resume, and stop are always explicit. An
active observation never resumes after Chrome restarts and does not run in
Incognito.

Only sanitized browser metadata crosses extension messaging. Password values
are never read. File interactions retain only generalized type and size
categories—not filenames, paths, contents, or bytes. Unapproved pages produce at
most an anonymous gap marker without their hostname or page details.

## Delivery

Each implementation phase is tested and committed independently. Work stops at
the end of a successful phase so that its checkpoint can be reviewed before the
next phase begins.

## License

MIT
