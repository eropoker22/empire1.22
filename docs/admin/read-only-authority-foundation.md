# Read-only admin authority foundation

## Authority model

Netlify functions are serverless workers. Their process-local `ServerApp`, instance manager, caches, and registries exist only for one warm worker and may disappear at any cold start. They therefore cannot be the authority for an admin overview.

The admin API reads known instances from PostgreSQL `empire_server_instances`. Snapshot metadata and state come from `empire_snapshot_latest`; command, event, and diagnostic summaries come from their persistent logs; worker ownership and heartbeat come from `empire_tick_locks`. An instance remains in the overview when its worker is absent.

Production fails closed unless the admin repository factory resolves a PostgreSQL adapter and every monitoring, session, audit, and rate-limit repository declares durable storage. Development and tests may explicitly use the in-memory adapter. Admin cold starts never call `ensureDefaultLobbyServers`.

## Per-instance projections

`GET /api/admin/instances/:serverInstanceId` loads exactly one durable instance and one matching snapshot. It never flattens multiple runtime registries and never selects the first summary. Every player, district, economy, production, police, liveness, alliance, snapshot, command, event, and diagnostic row carries `serverInstanceId`. A runtime scope guard rejects a snapshot or row that does not match the requested instance.

The browser shows overview without a selected instance. Selecting a server writes `?instance=<encoded-id>`, issues a scoped detail request, aborts the previous request, and uses a request sequence to ignore late responses.

## Freshness

Every instance summary includes `generatedAt`, `source`, `dataAsOf`, `lastSnapshotAt`, `lastHeartbeatAt`, `stale`, and `staleReason`. A successful HTTP response does not imply LIVE.

- `LIVE`: durable worker heartbeat is at most 30 seconds old.
- `STALE`: heartbeat is between 30 and 120 seconds old.
- `OFFLINE`: heartbeat is older than 120 seconds.
- `NO WORKER`: no durable heartbeat exists.
- `DATABASE UNAVAILABLE`: the durable repository could not answer; the UI displays `ADMIN SERVER NEDOSTUPNÝ`.

A missing or stale snapshot is reported independently. Offline instances keep their durable metadata and live-only sections are marked unavailable or stale.

## Session and roles

The closed-alpha login sends the bootstrap secret once to `POST /api/admin/session`. Verification is timing-safe. The input is immediately cleared and the browser never stores the secret in web storage, a URL, analytics, or subsequent headers.

The server creates a short-lived session containing session ID, actor ID, display name, role, creation/expiry/revocation timestamps, and authentication method. Only a hash of the random session token is persisted. The token is returned in an `HttpOnly`, `SameSite=Strict`, `/api/admin` cookie, with `Secure` enabled in production. Logout revokes the durable session and expires the cookie.

Roles are `viewer`, `operator`, and `owner`. All exposed HTTP operations are read-only. Viewer, operator, and owner can read overview, scoped instance detail, health, and safe logs. Owner can additionally read the access audit. Operator and owner have no write permission in this sprint.

Production bootstrap requires explicit `EMPIRE_ADMIN_BOOTSTRAP_ENABLED=true` plus configured actor identity. Without that opt-in or a future production identity adapter, admin authentication fails closed.

## Abuse, CSRF, and audit

Login failures are rate-limited using durable hashes of the request fingerprint and configured actor ID. Five failures in five minutes cause a temporary lockout. No raw IP, user-agent, secret, or cookie is stored.

Login and logout require JSON and pass the same-origin/Origin guard. Read endpoints validate the durable session and role on every request. Durable audit records cover login success/failure, logout, session expiry/revocation, overview access, instance detail access, audit access, and forbidden access. Records contain only safe correlation IDs and optional target instance IDs.

## Whitelisted monitoring data

The API returns typed allowlist models. Command summaries contain command ID/type, actor, status, receive time, and receive tick. Event summaries contain event ID/type, causing command, occurrence time, and tick. Diagnostic summaries contain ID, level, category, safe message code, time, and optional command ID.

Raw command/event payloads, arbitrary JSON previews, diagnostic context, raw errors, stack traces, environment values, authorization headers, cookies, tokens, and secrets are never serialized to the browser.

## Write-control gate

Admin writes remain prohibited. There are no lifecycle, join-policy, resource grant, player, district, gameplay, reset, or delete endpoints or buttons. The unsafe prototype admin command service and browser dispatcher were removed.

A separate write-control-plane sprint may start only after all of these gates are met:

- the instance registry is durable;
- per-instance projections and two-instance isolation are verified;
- worker heartbeat is durable;
- tick leases work across workers;
- snapshot restore is verified;
- admin identity and roles work with the intended production provider;
- access audit and login rate limiting are durable;
- live PostgreSQL repository and production-like smoke tests pass.

Passing this read-only foundation does not make a hosted server control plane ready for writes.
