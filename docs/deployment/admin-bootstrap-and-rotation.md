# Admin bootstrap and rotation

## Purpose

This runbook creates exactly one durable owner account for an isolated staging or production database, proves that
the account can authenticate over the intended HTTPS origin, rotates the one-time password, and removes the
bootstrap credential from the release environment. It does not enable registration, provisioning, War, or public
access.

Use the protected `Deploy Staging` or `Deploy Production` workflow whenever possible. The workflow applies current
migrations first, uses a direct PostgreSQL connection, and keeps credential-bearing temporary files outside release
artifacts.

## Preconditions

- The approved checkout is clean and `EMPIRE_BUILD_SHA` is its exact 40-character lowercase SHA.
- `npm run db:migrate:status -- --release` reports the current production migration contract.
- The direct database URL has TLS enabled and targets only the intended release environment.
- `EMPIRE_ADMIN_SESSION_SECRET` is a unique 64-hex or safe base64url secret with at least 32 bytes of entropy.
- The initial and permanent owner passwords are different and exist only in the protected provider secret store.
- Registration remains `false` during this procedure.

Never pass passwords on a command line, print them, store them in an artifact, or place them in `.env` committed to
Git. Generate secrets independently with Node's cryptographic random generator:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

## Protected workflow inputs

For staging, define these values only in the protected GitHub `staging` environment:

- variable `STAGING_ADMIN_USERNAME`;
- variable `STAGING_ADMIN_DISPLAY_NAME`;
- secret `STAGING_ADMIN_INITIAL_PASSWORD`;
- secret `STAGING_ADMIN_PASSWORD`.

For production, use the corresponding `PRODUCTION_*` values in the protected GitHub `production` environment.
Neither password is a Netlify Function or worker runtime variable.

On the first database release, dispatch the deployment workflow with `bootstrap_admin=true`. On every later release,
leave it `false`; normal application startup never bootstraps an owner.

## Bootstrap and immediate verification

The release job performs the following sequence with a direct connection:

```powershell
npm run admin:bootstrap-user
npm run verify:admin-user-live
```

`verify:admin-user-live` fails unless all of these statements are true:

- the named user exists, is active, and has role `owner`;
- exactly one active owner exists in the database;
- the password verifies against a salted hash and no plaintext password column exists;
- the password does not occur in admin audit metadata;
- a successful bootstrap or rotation audit entry exists.

Before rotation, sign in through the exact environment origin using the initial password, read the admin control
plane, and log out. Inspect the cookie response rather than browser JavaScript. The admin cookie must be host-only,
`HttpOnly`, `Secure`, `SameSite=Strict`, and scoped to the admin API path.

## Rotate the password

Set `EMPIRE_ADMIN_NEW_PASSWORD` from the protected permanent password secret, then run:

```powershell
npm run admin:rotate-password
$env:EMPIRE_ADMIN_BOOTSTRAP_PASSWORD = $env:EMPIRE_ADMIN_NEW_PASSWORD
npm run verify:admin-user-live
```

Rotation revokes existing admin sessions. Verify that the initial password no longer authenticates, then sign in
with the new password, read `/api/admin/control-plane`, and log out. The control-plane response must report current
API/worker SHA parity, current migrations, an online worker, current session security, and the exact origin policy.

## Idempotence and restart proof

Application and worker startup do not call the bootstrap script. To prove operator idempotence explicitly, rerun the
bootstrap using the permanent password and then verify again:

```powershell
$env:EMPIRE_ADMIN_BOOTSTRAP_PASSWORD = $env:EMPIRE_ADMIN_NEW_PASSWORD
npm run admin:bootstrap-user
npm run verify:admin-user-live
```

This updates the existing normalized username; it must not create another owner. Restart or redeploy the API and
worker without bootstrap variables, then repeat the remote login and owner-count verification.

## Remove bootstrap material

Immediately after the evidence is green:

1. Delete `STAGING_ADMIN_INITIAL_PASSWORD` or `PRODUCTION_ADMIN_INITIAL_PASSWORD` from the protected GitHub
   environment.
2. Confirm that no bootstrap password exists in Netlify, Fly, deploy previews, repository `.env` files, artifacts,
   logs, shell history, or issue text.
3. Keep only the permanent password in the approved password manager and protected release environment.
4. Record the safe audit timestamp, environment, exact SHA, normalized owner name, and the fact that owner count is
   one. Do not record a password hash, salt, cookie, token, or raw database identifier.

## Later rotation

Schedule or incident rotation uses `npm run admin:rotate-password` with a newly generated permanent password. Verify
the new password before deleting the old secret, confirm prior sessions are revoked, update the protected provider
secret, and record the audit timestamp. Changing `EMPIRE_ADMIN_SESSION_SECRET` is a separate emergency operation
that invalidates every admin session and requires an API redeploy.

## Failure handling

- More than one active owner: stop the release; do not disable an account until the audit trail and intended owner
  are reviewed.
- Missing bootstrap audit: stop the release and retain logs without credentials.
- Initial password still works after rotation: stop the release and revoke all owner sessions.
- Remote login or cookie policy failure: keep registration and provisioning closed.
- Database or migration mismatch: do not retry bootstrap against another URL until the safe target hashes are
  revalidated.

No successful local command is proof that the public admin route works. Staging and production evidence require an
actual HTTPS login, control-plane read, logout, and the protected release artifact for the exact deployed SHA.
