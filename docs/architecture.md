# Local architecture

Reflow separates browser observation, durable state, local processing, and model
access so each boundary can be tested independently.

```text
Chrome extension
      |
      v
Hosted Supabase <--- local Next.js UI
      ^                    |
      |                    v
Local worker ------> Vercel AI Gateway
```

## Runtime boundaries

The Chrome extension is the observation boundary. Beginning in Phase 3, its
content script will sanitize DOM data before extension IPC. The extension uses
only a Supabase publishable key and never receives trusted server credentials.

Hosted Supabase provides Auth, Postgres, and Realtime. Schema changes are
committed as migrations and pushed to a linked hosted development project.
Reflow does not run a local Supabase stack.

The Next.js application runs on localhost and provides context setup, process
analysis, and human approval. Its trusted operations remain server-side.

The Node worker runs locally, claims durable jobs from Supabase, and performs
trace normalization, task inference, process mining, and redesign. Model calls
pass through the shared AI Gateway package.

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
