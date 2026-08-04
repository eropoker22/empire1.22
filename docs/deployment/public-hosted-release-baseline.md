# Empire Streets Public Hosted Release Baseline

Recorded at: 2026-08-05 (Europe/Bratislava)

## Source

- Initial Git SHA: `2b263c0292efa036ea780f33b2ea80cc0c60184a`
- Initial branch: `fix/manual-hosted-parity-and-gameplay`
- Commit: `feat: complete hosted gameplay and interface polish`
- Remote `main` and `master`: `2b263c0292efa036ea780f33b2ea80cc0c60184a`
- Initial tracked worktree: clean
- Preserved local-only files: untracked `img/dizajn/`

## Runtime Baseline

- System Node.js: `v26.3.1` (unsupported by the repository contract)
- System npm: `11.16.0`
- Required release runtime: Node.js 24 LTS (`>=24 <25`)
- Local Node.js 24 runtime used for release checks: `.tmp/node24/node-v24.18.0-win-x64/node.exe`

## Existing Release Surface

- A staging environment validator exists in `scripts/validate-staging-environment.mjs`.
- A staging release manifest exists in `scripts/create-staging-release-manifest.mjs`.
- The current production schema head is discovered from the repository migrations at manifest time.
- Existing workflows are limited to `quality.yml` and `deep-checks.yml`.
- No production environment validator exists at this baseline.
- No guarded staging or production deployment workflow exists at this baseline.
- No deployment, rollback, DNS, admin-rotation, environment-matrix, or cost runbook existed under `docs/deployment/`.

## Initial Audit Findings

- `GameplaySliceView.mapEffects` was made required without updating four typed client fixtures.
- Latest hosted identity synchronization had no direct version/idempotence test.
- Starter production-building restore had no direct idempotence or orphan-relink test.
- Pending Spy/Rob map-effect privacy and expiry had incomplete direct coverage.
- Production-collection notification deduplication had incomplete direct coverage.
- Existing result-modal hydration marks initial server reports as seen before announcements, preventing a refresh from reopening historical results; this still requires an explicit release regression guard.
- Added CSS selectors inspected from the latest commit remain scoped beneath `html body.game-body`; no newly added unscoped universal or element-wide override was found.
- Source and generated `client/` asset hashes differed before a fresh release build; this is expected to remain a release gate until regeneration completes.

## Architecture Decision

- Netlify serves frontend, static assets, admin, and Netlify Function API.
- Managed PostgreSQL provides separate staging and production databases or branches with TLS and backups.
- A single persistent OCI worker runs `Dockerfile.hosted-worker`; Netlify Background Functions are not used as a tick worker.
- Migrations run once from a guarded release job over a direct database connection.
- Registration remains closed until remote staging acceptance is green.

## Baseline Verdict

- Local release gate: `NOT RUN` for this SHA as a complete clean matrix.
- Staging deployment: `NOT RUN`.
- Remote staging acceptance: `NOT RUN`.
- Production deployment: `NOT RUN`.
- STAGING: `NO-GO`.
- PRODUCTION: `NO-GO`.

No public service deployment or credential-backed provider action is claimed by this baseline.
