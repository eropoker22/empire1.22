# Public hosted observability and alerts

## Observability boundary

Public observability must answer whether the exact release is serving requests, ticking, persisting snapshots, and
holding one lease authority without exposing credentials or player data. Logs and health responses must never contain
a raw token, cookie, password, database URL, secret, request body, chat text, gang name, email address, or raw personal
identifier.

## Implemented telemetry

### Netlify API request events

The Netlify Function emits one JSON line per request with:

- timestamp, level, event, and component;
- request ID, safe normalized route, method, HTTP status, and duration;
- exact build SHA, release environment, and runtime region;
- first safe response error code when present;
- truncated SHA-256 server-instance and player hashes only when identity came from a valid signed, unexpired gameplay
  session token.

Account/admin requests and unauthenticated gameplay requests use `null` identity hashes. A `playerId` supplied in a
request body is never used as proof of identity or as the diagnostic player hash. The response includes the safe
`x-request-id`; the log never includes the body or session token.

### Worker lifecycle events

The persistent worker writes JSON lifecycle events for startup, run-loop failure, shutdown start, and clean stop.
They include the exact build SHA, stable worker ID, environment, region, schema version, and a normalized safe error
code. Worker logs do not include server state or raw player/server IDs.

### Health endpoints

`GET /api/health` returns `no-store` readiness for Node support, database availability, current schema, API SHA,
environment, and region. It returns HTTP 503 on unsupported Node, database failure, missing release marker, pending
migrations, or missing build SHA.

The worker `GET /health` returns HTTP 200 only when the run loop is healthy, shutdown is false, and the current
database heartbeat belongs to the same worker ID and SHA. It exposes only safe schema, runtime, heartbeat-age,
snapshot-maintenance, and error-code metadata.

### Admin monitoring

The authenticated admin control plane reports database availability, migration currency, API/worker SHA parity,
worker status, session/origin security, registration state, schema version, and safe per-server runtime state. Its
instance health checks distinguish:

- runtime/heartbeat/lease availability;
- tick progression;
- recovery-head snapshot freshness;
- recent command acceptance;
- last safe runtime error code.

For a running server, snapshot freshness is `max(30 seconds, 3 * canonical tick interval)`. Tick observation is
`max(35 seconds, 4 * canonical tick interval)`.

### Remote acceptance metrics

The guarded staging load job records p50/p95/p99 latency, HTTP status counts, tick range, snapshot-update range,
heartbeat age, PostgreSQL connections/query latency, Fly memory/CPU/throttling/concurrency, exact SHA, and safe
instance hash. Its current hard acceptance thresholds are:

| Signal | Release threshold |
| --- | ---: |
| API p95 / p99 | at most 2.5 s / 5 s |
| Gameplay command p95 | at most 5 s |
| Login p95 | at most 90 s, with at least three samples |
| Worker health p95 | at most 2 s |
| Heartbeat age | at most 30 s |
| HTTP 429 | zero |
| HTTP 5xx | zero |
| Tick and snapshot counters | must advance |
| Database connections | must stay below the protected configured maximum |
| Worker memory/CPU/throttle | must stay below protected configured limits |

Missing telemetry is a failure, not a pass.

## Continuous alert policy

Configure these alerts in Netlify, Fly, Neon, and the selected uptime/log platform before external testers:

| Alert | Trigger | Severity | Immediate action |
| --- | --- | --- | --- |
| API readiness | Two consecutive `/api/health` failures one minute apart | P0 | Close registration; inspect Netlify and DB |
| Worker readiness | Two consecutive `/health` failures 30 seconds apart | P0 | Close registration/joins; verify one Machine |
| Tick stalled | Two failed admin tick windows on a running server | P0 | Pause affected server; inspect lease/worker |
| Snapshot stale | Two failed freshness checks on a running server | P0 | Pause writes; preserve DB and worker logs |
| Lease missing/expired/mismatch | Any running server fails lease identity check | P0 | Prevent a second worker; inspect incarnation fencing |
| Migration mismatch | Any API/worker schema mismatch | P0 | Stop release; do not auto-migrate from runtime |
| Registration unexpectedly open | Enabled outside an approved, unexpired window | P0 | Set false and redeploy immediately |
| 5xx spike | Five 5xx in five minutes or at least 1% of requests | P1 | Correlate request IDs and provider events |
| DB saturation | Connection use above 80% for five minutes | P1 | Close registration; inspect Function isolates/pool |
| Worker restarts | More than one unplanned restart in ten minutes | P1 | Inspect memory, CPU, health, and last error code |
| API latency | p95 above 2.5 s for ten minutes | P1 | Inspect cold starts, DB query time, and pool waits |
| Command latency | p95 above 5 s for ten minutes | P1 | Inspect tick duration, lease, and DB writes |
| Netlify credits | 50%, 75%, 90%, and 100% of plan allowance | P1/P0 | Reforecast; close alpha before hard exhaustion |

Use at least two notification recipients for P0. Record acknowledgement and resolution timestamps without pasting
secrets or raw user data.

## Dashboard

The release dashboard should show, per environment:

- canonical origin and environment;
- frontend, API, and worker SHA parity;
- API and worker readiness status and last successful check;
- schema version and migration status;
- worker ID, region, heartbeat age, restarts, memory, and CPU;
- active servers, lease state, tick progression, snapshot freshness, and last safe error;
- API p50/p95/p99, error rate, 429, and 5xx;
- PostgreSQL total/active connections and query latency;
- registration state and expiry;
- Netlify credits used and forecast.

Do not use a dashboard display as the only release artifact. Guarded workflows must retain machine-readable summaries,
Playwright traces/screenshots, provider telemetry summaries, and the exact SHA.

## Log retention and drain

Netlify's current public plan table lists approximately 24 hours of Function logs on Free and seven days on Personal
and Pro. Built-in provider retention is not enough for incident history. Before production external testing, configure
an approved EU-compatible log sink or provider log-drain integration with:

- structured JSON ingestion from Netlify Functions and Fly stdout;
- TLS transport and a secret credential stored only in provider secret management;
- at least 30 days retention for closed-alpha incident evidence;
- access limited to release operators;
- redaction rules for cookie, authorization, token, password, database URL, and secret-like fields;
- alerts on the safe error codes above.

No log-drain credential belongs in Git or application artifacts. Until a sink and notification destination are
configured and tested with real provider credentials, continuous external observability is **BLOCKED BY CREDENTIALS**
and production remains `NO-GO`.

## Incident correlation

Start with the public request ID, exact SHA, timestamp, route, status, and safe error code. Correlate it with Netlify
invocation logs, Neon metrics, Fly lifecycle events, worker heartbeat, and the admin instance view. Do not search by a
raw player ID; use the safe hash emitted from the signed gameplay session.

If correlation requires temporarily increasing logging, deploy a reviewed change that preserves the redaction
contract. Never enable raw request or cookie logging in a provider dashboard.

## Verification checklist

Before `STAGING GO`:

1. Trigger one safe 4xx and one controlled staging-only 5xx; prove the request ID and error code arrive without body
   data.
2. Restart the staging worker; prove start/shutdown events, health transition, heartbeat recovery, and one replica.
3. Trigger each alert route in an isolated staging drill and verify both recipients.
4. Run the 20-player load/soak job and retain browser, database, and Fly metrics artifacts.
5. Search exported logs for known canary secret strings and require zero matches.
6. Verify registration-expiry monitoring closes the approved window.

Repeat the non-destructive health, SHA, registration, and notification smoke after production deployment while
registration remains closed.

Official references:

- [Netlify pricing and log retention](https://www.netlify.com/pricing/)
- [Fly metrics](https://fly.io/docs/monitoring/metrics/)
- [Fly secrets](https://fly.io/docs/apps/secrets/)
- [Neon connection errors](https://neon.com/docs/connect/connection-errors)
