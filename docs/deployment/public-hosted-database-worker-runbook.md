# Public hosted database and worker runbook

## Approved first-release architecture

Empire Streets uses the smallest compatible public architecture for its first closed alpha:

- Netlify serves `client/` and `netlify/functions/`.
- Neon provides two isolated PostgreSQL targets: staging and production.
- Fly.io runs exactly one persistent container per environment from `Dockerfile.hosted-worker`.
- The repository migration runner remains authoritative; no ORM or migration-framework conversion is part of this
  release.
- Frontend, API, and worker run one exact immutable Git SHA.

Netlify Functions are not a tick worker. Do not deploy the worker bundle into the browser build or a Netlify
Background Function.

## Environment isolation

Create separate Neon projects, or separate root branches with separately scoped credentials, for:

| Environment | Release marker | Public origin | Data policy |
| --- | --- | --- | --- |
| Staging | `EMPIRE_RELEASE_ENVIRONMENT=staging` | `https://staging.empirestreets.cz` | Synthetic accounts and disposable release servers only |
| Production | `EMPIRE_RELEASE_ENVIRONMENT=production` | `https://empirestreets.cz` | Clean closed-alpha start; registration initially closed |

Production and staging must not share a database, branch, role, password, Netlify site, Fly app, session secret, or
snapshot secret. Deploy previews receive neither target's credentials.

## PostgreSQL connection roles

Use the same provider project, branch, database name, and schema version within one environment, but use the endpoint
suited to each component:

| Component | `EMPIRE_DATABASE_URL` / `GAMEPLAY_DATABASE_URL` | Mode |
| --- | --- | --- |
| Netlify Functions | Neon pooled URL whose endpoint label ends in `-pooler` | Transaction pooled |
| Hosted worker | Neon direct URL | Direct |
| Migration release job | Neon direct URL | Direct |

Every URL requires `sslmode=require`, `verify-ca`, or `verify-full`. A loopback address, mixed target, pooled migration
URL, production target containing `staging`, or target-hash mismatch fails closed.

The release validator logs only connection mode, SSL mode, and SHA-256 hashes of the provider hostname, database
name, and backup identifier. Never print, upload, or paste a complete connection URL.

## Transaction-pooling compatibility

The Netlify runtime pool is configured with `max=4`, a 10-second idle timeout, a 5-second connection timeout, a
15-second query timeout, and `allowExitOnIdle=true`. The worker pool uses at most four connections, the same idle and
connect timeouts, and a 30-second statement timeout.

The runtime must remain transaction-pool safe. Before each release, scan tracked server and migration source for:

```powershell
rg -n "\bLISTEN\b|\bNOTIFY\b|pg_advisory_lock|pg_try_advisory_lock|WITH HOLD|CREATE TEMP|DECLARE .*CURSOR" apps/server/src scripts
rg -n "\bSET\b" apps/server/src scripts | Select-String -NotMatch "SET LOCAL"
```

Current migration locking uses `pg_advisory_xact_lock`, and migration-specific settings use `SET LOCAL`; both are
transaction scoped. Do not introduce session advisory locks, persistent `SET`, `LISTEN`/`NOTIFY`, holdable cursors,
or session-dependent temporary tables into Netlify Function paths. If a later feature needs session affinity, use a
direct/session-compatible endpoint for that component rather than weakening the validator.

Size provider capacity for at least the single worker pool plus the maximum expected concurrently warm Function
isolates multiplied by four. Alert before 80% of the provider connection limit. Do not add blind retries around
non-idempotent commands; retry only with the same canonical command or idempotency ID.

## Database target pinning

Before configuring a protected GitHub environment, compute the normalized target hash locally without printing the
URL. Store the resulting 64-character lowercase hash as `EMPIRE_STAGING_DATABASE_TARGET_HASH` or
`EMPIRE_PRODUCTION_DATABASE_TARGET_HASH` in protected configuration. Both release validators and both public
workers require the hash for their own environment. The staging release additionally proves that the direct worker
URLs and pooled API URLs normalize to that same protected target before it creates a snapshot or mutates a provider.
Immediately before the snapshot POST, the release job reads the configured Neon branch and its endpoints through the
provider API. It requires the returned project ID and branch ID to match protected staging configuration and requires
exactly one read-write endpoint host to match the direct staging URL. The retained
`neon-target-binding.json` contains only the release SHA, protected database target hash, and SHA-256 hashes of the
project, branch, and endpoint IDs; it never contains a connection URL, hostname, provider response, or credential.

Recompute the hash only during an approved database replacement. Pooled and direct release URLs must resolve to the
same normalized hostname family, port, database name, project, and branch.

The staging deploy, remote acceptance, and rollback workflows accept only the canonical
`empire-streets-staging-worker` Fly app. Their protected `FLY_STAGING_APP` value must equal the independent repository
pin `EMPIRE_PRE_ALPHA_STAGING_FLY_APP`; this comparison runs before any image push, secret import, deploy, scale, or
restart operation. Staging Netlify rollback also resolves the configured site ID through the provider API and rejects
the production site ID or either production hostname before it changes environment values or restores a deploy.

## Backup and migration order

Only the protected release job applies migrations. API and worker startup check schema currency but never apply
migrations.

For each remote release:

1. Freeze the exact clean SHA and intended environment.
2. Validate the direct and pooled URLs without displaying them.
3. Read the Neon branch and endpoint list and bind the returned project, branch, and read-write endpoint to the
   protected staging target hash.
4. Persist only hashed binding evidence, never raw provider identifiers, responses, URLs, or credentials.
5. Create a named Neon pre-migration snapshot, validate its source branch and provider operations against the same
   protected project/branch binding, and retain only hashed identifiers in release artifacts.
6. Set `EMPIRE_DATABASE_BACKUP_CONFIRMED=true` and the safe backup identifier only inside that release job.
7. For a first, proven-empty database only, explicitly authorize migration-history initialization.
8. Run status allowing known pending migrations.
9. Apply migrations once through the direct URL.
10. Run strict status again and require zero pending or unknown migrations and exact checksums.
11. Run API/worker schema smoke before enabling writes.

The Neon response schema permits an empty `operations` array and makes an operation's `branch_id` optional. Snapshot
creation may also return operations for Neon's generated internal archive branch rather than the source branch. The
gate therefore requires the snapshot's `source_branch_id` exactly, requires `operations` to be an array, checks every
returned operation ID and project ID, and validates any present operation branch ID as a provider ID. The artifact
records only an operation count and a hash of the sorted operation-ID set.

Canonical release commands are:

```powershell
npm run db:migrate:status -- --release --status-allow-pending
npm run db:migrate -- --release
npm run db:migrate:status -- --release
```

The one-time initializer is guarded by an explicit dispatch flag, a current `public` schema, a missing migration
history table, and zero public objects:

```powershell
npm run db:migrate:initialize-release-history
```

Never use it on an existing database. The migration runner holds transaction-scoped advisory lock `1843771153`,
rechecks history under the lock, writes each migration and checksum in the same transaction, and fails on an unknown,
modified, older, or newer schema contract. Historical applied SQL files are immutable.

The current source contract ends at `025_open_registration_purge_start.sql`; always record the actual head returned by
the release manifest rather than hard-coding this value in provider settings.

## Migration classification and rollback compatibility

`docs/deployment/migration-compatibility.json` classifies every tracked migration as `backward-compatible`,
`forward-only`, `destructive`, or `requires-maintenance-window`. Validate the file and an intended previous SHA with:

```powershell
$env:EMPIRE_ROLLBACK_PREVIOUS_SHA = "<previous-40-character-sha>"
$env:EMPIRE_ROLLBACK_COMPATIBILITY_EVIDENCE_PATH = "artifacts/release/rollback-compatibility.json"
npm run verify:rollback-compatibility
```

A code-only rollback is allowed only when the previous and candidate commits contain identical normalized migration
filenames and checksums. A provider snapshot is recovery insurance, not an automatic rollback mechanism.

## Immutable worker image

Build from the exact approved checkout:

```powershell
docker build `
  --build-arg "EMPIRE_BUILD_SHA=$env:EMPIRE_BUILD_SHA" `
  --tag "empire-hosted-worker:$env:EMPIRE_BUILD_SHA" `
  --file Dockerfile.hosted-worker .
```

The image uses Node 24, labels the OCI revision, installs production dependencies only, runs as the non-root `node`
user, and exposes `/health` on port 8080. Push and deploy by immutable registry digest or exact SHA tag; never use
`latest` for a release.

`fly.hosted-worker.toml` is the canonical first-release runtime shape:

- primary region `fra` near the database;
- one `shared-cpu-1x`, 512 MiB Machine;
- autostop disabled and minimum one running Machine;
- `SIGTERM` with a 30-second graceful shutdown window;
- `/health` liveness probe and `on-failure` restart policy;
- one stable worker ID equal to `EMPIRE_TICK_WORKER_OWNER_ID`.

Worker secrets include only direct database URLs and the gameplay session/snapshot secrets required by the runtime.
Admin passwords, admin session/fingerprint secrets, auth throttle pepper, Netlify token, Neon token, and Fly deploy
token must not enter the worker environment.

## Worker startup gate

The worker refuses to tick unless:

- Node major is 24;
- release environment is exactly staging or production;
- both persistence drivers are `postgres`;
- both direct TLS URLs target the same database;
- the exact build SHA is valid and, in production, matches the pinned target contract;
- worker ID is stable and non-local;
- worker and runtime regions are explicit EU values and equal;
- strict hosted preflight is enabled;
- gameplay session and snapshot secrets are strong and different;
- the database schema exactly matches the code contract.

The `/health` endpoint returns 200 only when the run loop is healthy, shutdown is not in progress, the database is
available, and the current worker heartbeat has the same worker ID and SHA. It safely exposes environment, region,
schema versions, heartbeat age, Node runtime, snapshot-maintenance status, and the last safe error code.

## One lease authority

Deploy exactly one worker replica. Before the first worker deployment, require zero active Machines in a new
environment. For upgrades, verify exactly one current Machine and its immutable image before replacement. After
deployment, require exactly one running Machine, one fresh worker heartbeat, one matching incarnation, and no second
active lease authority.

Do not scale horizontally until lease behavior, connection capacity, and multiplayer acceptance have a separately
approved design and test plan.

## Deployment and restart verification

After the API and worker deploy:

1. Poll `https://<fly-app>.fly.dev/health` until it reports the exact SHA, environment, `fra`, current schema, and a
   registered heartbeat.
2. Poll `<public-origin>/api/health` until API SHA and schema match.
3. Run `npm run verify:remote-release` to compare source, deployed assets, frontend, API, and worker SHA.
4. Read `/api/admin/control-plane` through an authenticated owner session and require an online worker, current build
   compatibility, current origin/session policy, and current migrations.
5. Create a closed control server, start it, and observe tick, snapshot, income, and lease freshness.
6. Gracefully restart the worker and prove state continuation without duplicate reports or a second authority.

Keep registration closed if any check fails. Preserve all non-secret artifacts, logs, traces, and safe target hashes.

## Backup retention and recovery

- Enable provider backups appropriate to closed alpha and create a fresh pre-migration snapshot for every release.
- Keep backup evidence outside runtime logs and store only a hashed backup ID in public artifacts.
- Rehearse restore against an isolated disposable branch before production cutover.
- Never automatically restore an older snapshot over newer staging or production data.
- Snapshot restore requires incident-command approval, a documented loss boundary, verified schema compatibility,
  registration and provisioning closed, the worker stopped, and a fresh backup of the current state.

Official provider references:

- [Neon API: retrieve branch details](https://api-docs.neon.tech/reference/getprojectbranch)
- [Neon API: list branch endpoints](https://api-docs.neon.tech/reference/listprojectbranchendpoints)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon connection errors](https://neon.com/docs/connect/connection-errors)
- [Neon snapshots and restore operations](https://neon.com/docs/ai/ai-database-versioning)
- [Fly secrets](https://fly.io/docs/apps/secrets/)
- [Fly app configuration and shutdown](https://fly.io/docs/reference/configuration/)
- [Fly health checks](https://fly.io/docs/reference/health-checks/)
- [Fly deploy from an existing image](https://fly.io/docs/launch/deploy/)
