# Netlify, DNS, TLS, and asset cutover runbook

## Scope and release order

Use two isolated Netlify sites:

| Site | Canonical origin | Database access | Registration during deploy |
| --- | --- | --- | --- |
| Staging | `https://staging.empirestreets.cz` | Staging pooled PostgreSQL only | `false` |
| Production | `https://empirestreets.cz` | Production pooled PostgreSQL only | `false` |

Connect and accept staging first. Do not attach `empirestreets.cz` or `www.empirestreets.cz`, change production DNS,
or expose production credentials before the complete remote staging and rollback gates are green.

## Netlify site contract

Both sites use the tracked `netlify.toml` contract:

```text
Build command: npm run build:admin:page
Publish directory: client
Functions directory: netlify/functions
Node major: 24
```

The protected deployment workflows build the exact checkout themselves and deploy `client/` plus
`netlify/functions/`. They set `EMPIRE_BUILD_SHA` from the approved workflow SHA; operators must not type a stale
value into the Netlify UI.

Create these GitHub environment variables rather than committing provider identifiers:

- `NETLIFY_STAGING_SITE_ID` in protected environment `staging`;
- `NETLIFY_PRODUCTION_SITE_ID` in protected environment `production`.

Store `NETLIFY_AUTH_TOKEN` only as a protected GitHub environment secret. Use the least privilege available, rotate
it after operator changes or suspected exposure, and never inject it into Functions, builds, the worker, or release
artifacts.

## Runtime variables and secrets

The workflow writes non-secret release values and Function secrets with `netlify env:set`, scoped only to the site's
`production` deploy context. Because staging and production are separate Netlify sites, each site's production
context maps to that environment's canonical origin and database.

Required staging values include:

```text
NODE_ENV=production
EMPIRE_RELEASE_ENVIRONMENT=staging
EMPIRE_PUBLIC_ORIGIN=https://staging.empirestreets.cz
EMPIRE_ALLOWED_ORIGINS=https://staging.empirestreets.cz
EMPIRE_BUILD_SHA=<exact checkout SHA>
EMPIRE_PERSISTENCE_DRIVER=postgres
GAMEPLAY_PERSISTENCE_DRIVER=postgres
EMPIRE_ADMIN_WRITES_ENABLED=true
EMPIRE_HOSTED_CONTROL_PLANE_ENABLED=true
EMPIRE_SERVER_PROVISIONING_ENABLED=true
EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false
EMPIRE_LEGACY_MATCHMAKING_ENABLED=false
EMPIRE_WAR_HOSTING_ENABLED=false
EMPIRE_HOSTED_PREFLIGHT_STRICT=true
```

Production uses the corresponding production marker and exact origin. Its allowed origin is only
`https://empirestreets.cz`. Do not add `http://localhost`, a wildcard, `www`, a Netlify preview wildcard, or staging.
`www` redirects to the apex before application use.

The complete component and rotation matrix is `docs/deployment/environment-matrix.md`. Secrets are configured via
the Netlify UI/CLI/API or protected GitHub environment, never in `netlify.toml`.

## Deploy-preview isolation

Untrusted pull requests must not receive provider or runtime secrets. Configure deploy previews in one of these
approved states:

1. no state-changing Function backend at all; or
2. a dedicated disposable test database/branch and preview-only secrets, with no path to staging or production.

Do not copy production-context variables into `deploy-preview` or `branch-deploy`. Do not use wildcard allowed
origins. Before enabling a preview backend, inspect its effective environment and prove that neither production nor
staging target hashes are present.

The repository's guarded release workflows do not use previews for staging or production release evidence.

## Staging domain setup

1. Create or select the isolated staging Netlify site.
2. Add `staging.empirestreets.cz` as its custom domain in Netlify before changing DNS.
3. Record Netlify's current target hostname for that site.
4. At the authoritative DNS provider, create only the requested `staging` CNAME to the exact Netlify target.
5. Wait for authoritative DNS propagation and Netlify certificate issuance.
6. Verify the staging origin does not redirect to production.

Do not use the production apex as a temporary staging alias.

## DNS inventory before production

Before modifying the apex or nameservers, export an inventory with record name, type, value/target, TTL, priority,
provider, and purpose for at least:

- `NS`, `SOA`, `A`, `AAAA`, `CNAME`, `ALIAS`, and `ANAME`;
- `MX`;
- all `TXT`, including SPF, DKIM, DMARC, ownership, and verification records;
- `CAA`;
- existing `www`, wildcard, and service subdomains.

Store the inventory in the approved operator vault or incident system, not in a public artifact when it contains
sensitive verification values. Do not change nameservers merely to attach Netlify, and never remove or overwrite
mail or verification records blindly.

## Production domain setup

Only after `STAGING GO` and a successful staging rollback rehearsal:

1. Add `empirestreets.cz` and `www.empirestreets.cz` to the isolated production Netlify site.
2. Re-read the site-specific Netlify DNS instructions immediately before the change.
3. Prefer the DNS provider's `ALIAS`, `ANAME`, or flattened CNAME for the apex when supported, targeting
   `apex-loadbalancer.netlify.com` as currently documented by Netlify.
4. If flattening is unavailable, use Netlify's currently documented fallback apex `A` record (`75.2.60.5` at the
   time this runbook was written) only after confirming it in Netlify's live instructions.
5. Point `www` to the production Netlify hostname using the site-specific CNAME instruction.
6. Preserve all unrelated DNS records and their TTLs.
7. Keep registration closed throughout DNS and TLS convergence.

The tracked redirect contract forces `www` HTTP/HTTPS traffic to `https://empirestreets.cz`. Staging must remain on
its own hostname and must not be redirected to production.

## DNS and TLS acceptance

From at least two independent recursive resolvers, verify:

```powershell
Resolve-DnsName staging.empirestreets.cz -Type CNAME
Resolve-DnsName empirestreets.cz -Type A
Resolve-DnsName www.empirestreets.cz -Type CNAME
curl.exe --fail --silent --show-error --head https://staging.empirestreets.cz/
curl.exe --fail --silent --show-error --head https://empirestreets.cz/
curl.exe --fail --silent --show-error --head https://www.empirestreets.cz/
```

Require:

- a valid publicly trusted certificate covering the exact hostname;
- no certificate-name mismatch or incomplete chain;
- HTTP redirects to HTTPS;
- `www` redirects once to the production apex without a loop;
- staging remains staging;
- no mixed-content request in desktop or mobile browser traces;
- no old provider origin exposed in application links or cookies.

Do not call DNS/TLS complete from a dashboard screenshot alone. Capture resolver output, response headers, browser
network evidence, timestamp, and exact deployed SHA.

## Cookie and origin acceptance

Inspect actual HTTPS response headers for account, gameplay, and admin sessions:

- `HttpOnly` and `Secure`;
- `SameSite=Lax`, `Strict`, or stronger according to the tracked cookie contract;
- intended `Path`;
- host-only unless a separately reviewed cross-host requirement exists;
- explicit expiry and symmetrical deletion attributes.

Test login, reload, browser restart, logout, and durable session revocation. Confirm that staging cookies are not sent
to production, apex cookies are not accidentally scoped to `www`, and the `www` redirect cannot create a duplicate
session. State-changing requests with a missing or non-exact origin must fail. CORS must never return `*`.

## Cache and asset integrity

`netlify.toml` applies:

- HTML and unversioned paths: `Cache-Control: public, max-age=0, must-revalidate`;
- generated hashed `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`;
- API and worker health: `Cache-Control: no-store`.

After every release, generate and publish the asset manifest:

```powershell
npm run release:asset-manifest
npm run verify:remote-release
```

`verify:remote-release` fetches the public manifest and each critical deployed asset with cache bypass, then records
source hash, build hash, deployed hash, cache policy, frontend SHA, API SHA, worker SHA, schema version, environment,
and region. Any mismatch is a release failure. This prevents new HTML from silently loading stale JS or CSS.

## SHA parity

The approved SHA must be the same in:

- checkout `HEAD`;
- generated frontend metadata;
- Netlify Function `/api/health`;
- Fly worker `/health`;
- release manifest;
- remote asset manifest;
- admin control-plane availability.

The build fails if the SHA is not exactly 40 lowercase hex characters or does not equal checkout `HEAD`. A release
with mixed frontend/API/worker SHA is `NO-GO`, even when every component individually returns HTTP 200.

## Rollback boundary

Netlify deploys are atomic and can restore a prior successful deploy. Restore only a previously captured deploy ID
whose commit matches the approved compatible rollback SHA. Pair it with the worker image for that same SHA and keep
the database unchanged unless the incident commander explicitly authorizes a separate data recovery operation.

Official references:

- [Netlify environment variables and scopes](https://docs.netlify.com/build/environment-variables/overview/)
- [Netlify sensitive variables](https://docs.netlify.com/build/environment-variables/get-started/)
- [Netlify deploy previews](https://docs.netlify.com/deploy/deploy-types/deploy-previews/)
- [Netlify atomic deploys](https://docs.netlify.com/deploy/deploy-overview/)
- [Configure external DNS for Netlify](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/)
- [Manage apex and domain aliases](https://docs.netlify.com/domains/manage-domains/manage-multiple-domains/)
- [Netlify HTTPS certificates](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/)
- [Netlify HTTPS troubleshooting](https://docs.netlify.com/manage/domains/troubleshooting/troubleshoot-ssl-and-https/)
