# Prod-like Postgres Smoke

This smoke is the opt-in live Postgres verification for Empire Streets closed alpha.

## Purpose

It verifies the production-like persistence path against a real test Postgres database:

- migrations
- persistent join tickets
- persistent player registrations
- persistent gameplay sessions
- transactional command execution
- durable command result replay
- latest snapshot persistence
- durable outbox / event records
- restore after restart
- logout / revoke
- War closed guard

## Required env

Use only an isolated test database:

```powershell
$env:EMPIRE_TEST_DATABASE_URL = "postgres://..."
```

The value must be exported explicitly in the command environment. Live persistence tests
do not load `.env.local` and do not fall back to `EMPIRE_DATABASE_URL` or
`GAMEPLAY_DATABASE_URL`. In protected staging automation, map the guarded direct staging
secret into `EMPIRE_TEST_DATABASE_URL` only after the staging approval and target-hash
checks succeed.

Optional explicit override for non-obviously-test targets:

```powershell
$env:EMPIRE_ALLOW_LIVE_POSTGRES_SMOKE = "true"
```

Do not point this smoke at production. The test never logs the database URL, secrets, join tickets, session cookies, or session tokens.

## Commands

Run only the live Postgres smoke:

```powershell
npm run test:persistence:postgres:smoke
```

Run the full prod-like gate:

```powershell
npm run verify:prod-like
```

`verify:prod-like` runs:

1. `npm run verify:closed-alpha`
2. `npm run test:persistence:postgres:smoke`

If `EMPIRE_TEST_DATABASE_URL` is not set or is not a PostgreSQL URL, the live command
fails before Vitest starts. The failure reports only a generic configuration error and
never echoes the connection URL or credentials.

## Migrations

The smoke applies SQL files from:

- `apps/server/src/runtime/persistence/postgres/migrations`

It uses the existing idempotent migration SQL and does not modify production migrations.

## Out of scope

This smoke does not cover:

- full E2E suite
- balance simulations
- admin dashboard behavior
- public production deployment wiring
