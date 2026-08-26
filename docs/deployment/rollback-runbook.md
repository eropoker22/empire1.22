# Public hosted rollback and incident runbook

## Safety policy

Rollback restores application code, not historical data, unless a separately authorized recovery decision proves
that overwriting newer data is necessary and safe. The default rollback retains the current database and every
snapshot.

Never use `git reset --hard`, `git clean -fd`, force-push, delete a database, reverse an applied migration, or restore
an old database snapshot automatically. Never combine frontend, API, and worker from different SHAs.

## Roles

- **Incident commander:** declares rollback, owns the data-loss decision, and records the incident.
- **Release operator:** runs the protected workflow and provider commands.
- **Verifier:** independently checks registration, health, SHA parity, schema, sessions, ticks, and snapshots.
- **Database owner:** approves any restore and verifies backup/branch identity.

One person may fill multiple roles during closed alpha, but every action and timestamp must still be recorded.

## Immediate containment

When a P0 or release failure occurs:

1. Set `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false` and unset any registration expiry.
2. Disable new provisioning with `EMPIRE_SERVER_PROVISIONING_ENABLED=false` when containment permits a config
   deploy; otherwise stop creating servers through admin immediately.
3. Close joins on every affected server through the authenticated admin lifecycle action.
4. Do not open War or payments.
5. Preserve Netlify, Fly, Neon, GitHub, Playwright, admin-audit, and release artifacts.
6. Record the exact candidate SHA, currently serving frontend/API/worker SHA, schema version, backup hash, deployment
   IDs, worker image, and incident start time.
7. Confirm whether one or zero worker replicas are active; never start a second lease authority as a diagnostic step.

If database integrity is uncertain, pause affected servers and stop the worker after graceful drain. Do not keep
accepting commands while deciding on data recovery.

## Rollback eligibility

Before a code rollback, identify the exact previous immutable SHA and run:

```powershell
$env:EMPIRE_BUILD_SHA = "<candidate-sha>"
$env:EMPIRE_ROLLBACK_PREVIOUS_SHA = "<previous-sha>"
$env:EMPIRE_ROLLBACK_COMPATIBILITY_EVIDENCE_PATH = "artifacts/release/rollback-compatibility.json"
npm run verify:rollback-compatibility
```

The verifier requires a clean exact candidate checkout, a true Git ancestry relationship, complete classifications
in `docs/deployment/migration-compatibility.json`, and identical migration filenames and normalized checksums in both
commits. If the schema sets differ, code-only rollback is blocked even when the new migration was intended to be
backward compatible; perform a separately reviewed compatibility release instead.

Migration classifications mean:

- `backward-compatible`: additive or otherwise safe for code that ignores the change;
- `forward-only`: persisted data or constraints may be unknown to older code;
- `destructive`: data or schema is removed or irreversibly rewritten;
- `requires-maintenance-window`: locks, backfill, or invariant changes require controlled downtime.

Every new migration must be classified before it can enter a release candidate.

## Staging rollback rehearsal

Run `Staging Rollback Rehearsal` only after the exact candidate has a successful `Deploy Staging` artifact and a
successful `Staging Remote Acceptance` final artifact with registration closed. Supply:

- candidate `sha`;
- exact earlier `previous_sha`;
- candidate `deploy_run_id`;
- closed `remote_acceptance_run_id`.

The protected workflow:

1. verifies immutable gate artifacts and schema compatibility;
2. captures candidate and previous Netlify deploy IDs and Fly images;
3. verifies the candidate is healthy, closed, and has exactly one worker;
4. restores the previous Netlify deploy and previous immutable worker image;
5. verifies previous API, worker, frontend, assets, schema, and registration;
6. always attempts to restore the exact candidate after pointers were captured;
7. verifies candidate API, worker, assets, registration, and one replica again;
8. records `databaseRestored=false`.

`STAGING GO` requires the final artifact `staging-rollback-final-<SHA>` with candidate restoration and asset parity.
A partial restore, skipped check, or missing artifact is `NO-GO`.

## Production upgrade rollback

Production branches that are Neon root branches use a named pre-migration Neon snapshot. If Neon rejects the
snapshot specifically because the protected production branch is non-root, the release creates an instant Neon
backup branch from that exact protected branch instead. Both modes are created before migrations and retain only a
hashed provider identifier in release evidence.

For an existing production release, the protected production workflow captures and verifies:

- the exact live previous production SHA;
- the matching current Netlify production deploy ID;
- the immutable Fly image for that SHA;
- permanently open registration with no expiry;
- one active worker;
- API, worker, frontend, asset, and schema parity;
- exact migration compatibility with the candidate.

If the candidate deployment fails after rollback pointers exist, the workflow:

1. keeps registration permanently open;
2. restores the previous Netlify deploy by its exact ID;
3. deploys the previous Fly image and scales to exactly one Machine;
4. keeps the database unchanged;
5. verifies previous API/worker/frontend/assets/schema and registration;
6. uploads `automatic-rollback.json` with `databaseRestored=false`.

After automatic rollback, manually verify account login, admin login/logout, an existing gameplay session, tick,
snapshot freshness, income, and return to lobby. Do not reopen registration solely because the workflow restored
HTTP health.

## First production cutover failure

A first cutover has no prior Empire Streets worker release. Before dispatch, record an approved pre-cutover Netlify
deploy ID. If the first cutover fails after pointers are captured, the workflow:

1. restores that exact Netlify deploy;
2. keeps registration permanently open;
3. scales the production worker to zero;
4. retains the initialized/migrated database and provider snapshot;
5. verifies the approved deploy ID and zero active worker Machines;
6. records `rollbackMode=initial-cutover-shutdown` and `databaseRestored=false`.

Do not pretend this is a running production service. The result is a safely contained failed cutover and remains
`PRODUCTION NO-GO`.

## Database restore decision

Restore a provider snapshot only when all of these are documented:

- current data is corrupted or the migration itself caused a proven unrecoverable state;
- code rollback or a forward repair cannot preserve newer valid data;
- incident commander and database owner approve the exact loss boundary;
- registration, provisioning, joins, and worker are stopped;
- a fresh backup of the current broken state exists;
- target environment, project, branch, database, and snapshot are independently verified;
- migration/schema compatibility of the restored state and selected code SHA is known;
- restore completion can be polled and verified on an isolated branch first when the provider permits it.

Never restore over production merely because an older snapshot exists. Neon snapshot restore is an asynchronous data
operation and must be polled to completion. Retain the original branch until post-restore acceptance is complete.

## Post-rollback verification

Require all applicable checks:

- registration closed and no unexpired open window;
- provisioning and new joins closed until approval;
- HTTPS domain and redirects correct;
- frontend/API/worker exact same approved SHA;
- current compatible schema and checksum contract;
- one worker authority for an upgrade, zero for a contained first-cutover failure;
- API/worker health and fresh heartbeat;
- active leases match worker incarnation;
- tick and snapshot advance on running control servers;
- account, gameplay, and admin sessions behave as intended;
- logout revokes sessions;
- no duplicate command result, report, notification, income, or production collection;
- no private chat, Spy, Rob, or other private-state leak;
- provider error rates and DB connections return below thresholds.

Keep registration closed through an observation window of at least two full tick/snapshot freshness windows. A data
restore requires the complete remote smoke again, not just health endpoints.

## Incident record template

Record only safe identifiers:

```text
Incident ID:
Environment:
Started at / contained at / resolved at:
Candidate SHA:
Previous or containment SHA:
Schema version:
Netlify deploy ID hash:
Worker image SHA/digest hash:
Backup/snapshot ID hash:
Registration closed at:
Provisioning/joins closed at:
Database restored: no/yes (approval reference):
Detected symptom and safe error codes:
User impact and known data-loss window:
Rollback workflow run and artifact IDs:
Post-rollback health/tick/snapshot/session result:
Remaining P0/P1:
Owner and follow-up due date:
```

Never paste credentials, cookies, raw account/player IDs, database URLs, or private gameplay/chat content into the
incident record.

## Reopening

Re-enable in order: health monitoring, one worker, existing server resume, admin writes, provisioning, controlled
joins, then a time-limited closed-alpha registration window. Each step requires the previous one to remain green.
Anonymous public registration stays disabled.

Official references:

- [Netlify atomic deploys](https://docs.netlify.com/deploy/deploy-overview/)
- [Netlify API guide](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)
- [Neon snapshots and restore operations](https://neon.com/docs/ai/ai-database-versioning)
- [Fly deploy from an existing image](https://fly.io/docs/launch/deploy/)
