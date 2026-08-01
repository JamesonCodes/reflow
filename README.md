# Reflow

Reflow is a local-first process discovery and redesign prototype. It combines
privacy-safe browser observation with process mining and AI-assisted future-state
workflow design.

Reflow application code runs on your computer. Hosted Supabase provides durable
data services, while Vercel AI Gateway provides a provider-neutral model API.
Reflow is not deployed and does not execute browser agents.

## Architecture

- `apps/web` — local Next.js context, analysis, and approval interface
- `apps/extension` — unpacked Chrome extension (implemented in Phase 3)
- `apps/worker` — local durable processing worker
- `packages/contracts` — shared runtime schemas and TypeScript contracts
- `packages/ai` — exclusive AI Gateway boundary (implemented in Phase 2)
- `supabase` — hosted Supabase migrations and verification assets

See [docs/architecture.md](docs/architecture.md) for the runtime boundaries and
phased delivery model.

## Requirements

- Node.js 22 or newer
- pnpm 9.12.3
- A hosted Supabase project (required beginning in Phase 1)
- A Vercel AI Gateway key (required beginning in Phase 2)

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

Copy `.env.example` to `.env.local` only when a phase needs external services.
Never commit the resulting environment file.

## Delivery

Each implementation phase is tested and committed independently. Work stops at
the end of a successful phase so that its checkpoint can be reviewed before the
next phase begins.

## License

MIT
