# Hosted Supabase assets

This directory contains the Supabase CLI configuration, imperative migrations,
generated database types, and remote verification scripts.

Reflow uses a linked hosted development project. Do not run `supabase start` or
introduce Docker-based local services.

## Hosted workflow

```sh
pnpm supabase login
pnpm supabase link --project-ref <project-ref>
pnpm supabase db push --dry-run
pnpm supabase db push
pnpm supabase db lint --linked --schema public --fail-on error
pnpm supabase gen types --linked --schema public > packages/contracts/src/database.types.ts
psql "$REFLOW_TEST_DATABASE_URL" --file supabase/tests/phase1.sql
bash supabase/tests/concurrent-job-claims.sh
```

Anonymous sign-ins must also be enabled in the hosted project's Auth settings.
The committed `config.toml` records the intended configuration but does not
change hosted Auth settings by itself.

`REFLOW_TEST_DATABASE_URL` is a temporary shell variable containing the hosted
development project's direct database connection string. The verification SQL
runs inside a transaction and rolls its fixtures back.
