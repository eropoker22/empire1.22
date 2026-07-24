# Production registration-only runbook

This runbook covers only the account platform on `https://empirestreets.cz`.
It does not deploy a hosted worker, create a game server, enable provisioning,
change DNS, or claim that multiplayer gameplay is hosted.

## Required architecture

- Webhouse remains the DNS, domain and e-mail provider without changes.
- The existing Netlify production site serves the frontend and Functions.
- One isolated Neon Free PostgreSQL project stores accounts, sessions, throttling and admin data.
- Netlify Functions use the Neon pooled TLS URL.
- Migrations, backup and admin bootstrap use the Neon direct TLS URL from a secure operator environment.
- Hosted worker, hosted control-plane writes and server provisioning stay disabled.

## Identity gate

Do not change Netlify until all of these values are recorded from the authenticated provider account:

- exact site ID and site name;
- primary domain `empirestreets.cz`;
- production branch and connected repository;
- current production deploy ID, Git SHA, deploy URL and publish time;
- publish and Functions directories;
- confirmed rollback target.

If the site cannot be identified uniquely, stop with `NETLIFY SITE IDENTITY REQUIRED`.

## Production environment inventory

Set these names only in the Production context of the confirmed Netlify site:

| Variable | Component | Registration-only value |
| --- | --- | --- |
| `NODE_ENV` | Functions | `production` |
| `EMPIRE_PUBLIC_ORIGIN` | frontend and Functions | `https://empirestreets.cz` |
| `EMPIRE_ALLOWED_ORIGINS` | Functions | `https://empirestreets.cz` |
| `EMPIRE_DATABASE_URL` | Functions | pooled Neon TLS URL |
| `EMPIRE_PERSISTENCE_DRIVER` | Functions | `postgres` |
| `GAMEPLAY_PERSISTENCE_DRIVER` | Functions | `postgres` |
| `EMPIRE_BUILD_SHA` | frontend and Functions | exact deployed 40-character SHA |
| `GAMEPLAY_SLICE_SESSION_SECRET` | Functions | unique random secret, at least 32 bytes |
| `GAMEPLAY_SLICE_SNAPSHOT_SECRET` | Functions | different unique random secret, at least 32 bytes |
| `EMPIRE_ADMIN_FINGERPRINT_SECRET` | Functions | different unique random secret, at least 32 bytes |
| `EMPIRE_AUTH_THROTTLE_PEPPER` | Functions | different unique random secret, at least 32 bytes |
| `EMPIRE_ADMIN_WRITES_ENABLED` | admin API | `false` |
| `EMPIRE_HOSTED_CONTROL_PLANE_ENABLED` | admin API | `false` |
| `EMPIRE_SERVER_PROVISIONING_ENABLED` | admin API | `false` |
| `EMPIRE_LEGACY_MATCHMAKING_ENABLED` | Functions | `false` |
| `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED` | account API | initially `false` |

Never put secret values in Git, `netlify.toml`, client output, logs, screenshots or this document.
The `www` hostname currently redirects to the primary origin and is not part of the state-changing origin allowlist.

## Neon creation and connection use

1. Create one Empire-only Neon project on the Free plan in a European region.
2. Stop if the provider requires payment or a paid upgrade.
3. Record project ID, region, PostgreSQL version, database name and role name without credentials.
4. Keep the direct and pooled connection strings outside Git.
5. Require `sslmode=require` or a stronger supported mode on both strings.
6. Use the direct URL only for migrations, backups, admin bootstrap and operator checks.
7. Store the pooled URL only as the Functions-scoped `EMPIRE_DATABASE_URL`.

The Netlify runtime pool is bounded to four connections per function instance, closes idle connections,
uses connect and statement timeouts, and allows the process to exit while idle. Confirm the aggregate
serverless connection budget against the Neon Free limit before opening registration.

## Migration and baseline backup

Keep registration and all hosted writes disabled. In a secure operator shell, expose the direct Neon URL
as `EMPIRE_DATABASE_URL`, then run:

```text
npm run db:migrate:status
npm run db:migrate
npm run db:migrate:status
```

Do not edit an applied migration. A checksum mismatch or unknown migration is a blocker.
After migrations, create a custom-format backup outside the repository:

```text
pg_dump --format=custom --no-owner --no-acl
```

Record only backup size, SHA-256, time, schema version and Git SHA in the operator log.

## Admin bootstrap

Use `npm run admin:bootstrap-user` with the direct Neon URL and temporary bootstrap variables.
Create one active owner account and store its password in an approved password manager.
Remove temporary bootstrap password variables immediately, then run `npm run verify:admin-user-live`.

## Preflight and deployment

From the clean deployment SHA:

```text
npm run generate:browser-config
npm run check:browser-config
npm run check:production-fixture-boundary
npm run typecheck
npm run lint
npm test
npm run build:admin:page
npm run smoke:ui
npm run test:e2e:smoke
npm run verify:production-authority-cutover
npm run verify:registration-only-production
git diff --check
```

The last command runs code-level checks unless `NODE_ENV=production` or
`EMPIRE_REGISTRATION_ONLY_PREFLIGHT_STRICT=1` is present. Strict mode validates the pooled Neon URL,
all security flags and secrets, and the live migration history. To verify the temporarily open flag,
append `-- --expect-registration-enabled`.

Deploy the exact SHA only after the environment is configured. Confirm `/api/health`, admin login,
registration policy, cookie flags, lobby empty state and public demo rejection. Do not treat worker
offline as an account-platform failure.

## Legal gate

The current privacy and closed-alpha terms pages are staging drafts. Public registration must not remain
open until truthful operator identity, contact, processing purposes, retention, deletion procedure and
closed-alpha terms are supplied and approved. Do not invent those details.

A short operator-owned acceptance registration may be performed only under the approved test procedure.
After that test, close registration again and confirm that existing login still works.

## Emergency registration kill switch

1. Open the confirmed Netlify site's Production environment variables.
2. Set `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false`.
3. Trigger a production deploy from the same known SHA.
4. Verify `/api/account/registration-policy` reports registration closed.
5. Verify an existing account can still log in.

## Rollback

1. Disable registration and deploy that configuration.
2. Keep Neon PostgreSQL and all backups intact.
3. Do not run a destructive migration rollback.
4. Restore the previously recorded Netlify production deploy.
5. Keep admin writes, hosted control plane, provisioning and legacy matchmaking disabled.
6. Verify `/api/health`, admin login and registration policy.
7. Re-enable account registration only after the incident is resolved.

Rollback must never enable local demo on the public hostname.
