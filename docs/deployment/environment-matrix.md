# Empire Streets environment matrix

Generated: generated from tracked source

The inventory found **157 statically named environment reads** in tracked JavaScript and TypeScript source. Every read is classified below. 25 dynamic lookup site(s) are listed in the generated inventory artifact and must remain covered by explicit validator keys.

Public releases fail closed: no wildcard origin, no loopback URL, no staging hostname in production, no implicit database or secret default, and no provider credential in a runtime scope.

## Public runtime and release variables

| Variable | Component | Staging required | Production required | Secret | Netlify scope | Worker scope | Safe format | Default allowed | Rotation instructions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EMPIRE_ACCOUNT_TERMS_VERSION` | Netlify API | Yes | Yes | No | Builds and Functions | No | Approved immutable terms version | No | Bump only with approved terms change |
| `EMPIRE_ADMIN_BOOTSTRAP_DISPLAY_NAME` | One-time admin bootstrap job | One-time | One-time | No | Release job only | No | Non-secret operator display name | No | Update through audited admin flow |
| `EMPIRE_ADMIN_BOOTSTRAP_PASSWORD` | One-time admin bootstrap job | One-time | One-time | Yes | Release job only | No | Strong generated temporary password | No | Rotate immediately, then delete from release environment |
| `EMPIRE_ADMIN_BOOTSTRAP_ROLE` | One-time admin bootstrap job | One-time | One-time | No | Release job only | No | owner | Yes; owner | Change through audited admin policy only |
| `EMPIRE_ADMIN_BOOTSTRAP_USERNAME` | One-time admin bootstrap job | One-time | One-time | No | Release job only | No | Dedicated owner username | No | Keep as account identity; not a runtime secret |
| `EMPIRE_ADMIN_FINGERPRINT_SECRET` | Netlify API | Yes | Yes | Yes | Functions only | No | 64 hex or 43+ base64url characters; unique | No | Rotate and invalidate admin fingerprints |
| `EMPIRE_ADMIN_NEW_PASSWORD` | Admin password rotation job | One-time | One-time | Yes | Release job only | No | Strong generated final owner password | No | Rotate in the password manager and verify login |
| `EMPIRE_ADMIN_SESSION_SECRET` | Netlify API | Yes | Yes | Yes | Functions only | No | At least 32 bytes; 64 hex or 43+ base64url; unique | No | Rotate and revoke all admin sessions |
| `EMPIRE_ADMIN_WRITES_ENABLED` | Netlify API | Yes | Yes | No | Builds and Functions | No | true for approved hosted control plane | No | Disable during incident containment |
| `EMPIRE_ALLOWED_ORIGINS` | Netlify API | Yes | Yes | No | Builds and Functions | No | One exact HTTPS origin; never wildcard | No | Change only with an approved origin cutover |
| `EMPIRE_AUTH_THROTTLE_PEPPER` | Netlify API | Yes | Yes | Yes | Functions only | No | 64 hex or 43+ base64url characters; unique | No | Rotate during a controlled API deploy |
| `EMPIRE_BUILD_SHA` | Frontend, Netlify API, worker, release job | Yes | Yes | No | Builds and Functions | Yes | Exact 40-character lowercase checkout SHA | No | Automatic on every immutable deploy |
| `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED` | Netlify API | Yes | Yes | No | Builds and Functions | No | true for permanent public registration; false only by explicit owner action | No | Keep true for normal staging and production releases |
| `EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT` | Netlify API | Only while registration is true | Only while registration is true | No | Builds and Functions | No | Empty for permanently open; future ISO no more than 24 hours away for bounded mode | No | Keep unset for permanent public registration |
| `EMPIRE_COMMAND_LATENCY_DIAGNOSTICS` | Gameplay API and worker diagnostics | No; optional diagnostics | No; forbidden | No | Functions only when diagnosing staging | Yes only when diagnosing staging | true only in local development or staging | Yes; disabled | Unset after the diagnostic run |
| `EMPIRE_DATABASE_BACKUP_CONFIRMED` | Migration release guard | Yes | Yes | No | Release job only | No | true only after a fresh provider snapshot | No | Reset after each release |
| `EMPIRE_DATABASE_BACKUP_ID` | Migration release guard | Yes | Yes | No | Release job only | No | Non-secret snapshot identifier hash | No | Use a new hash for every release |
| `EMPIRE_DATABASE_INITIALIZATION_CONFIRMED` | One-time empty-database initializer | Only for first empty database | Only for first empty database | No | Release job only | No | true only with explicit dispatch approval | No | Unset immediately after initialization |
| `EMPIRE_DATABASE_TARGET_ENVIRONMENT` | Migration release guard and staging worker target pin | Yes | Yes | No | Release job only | Yes in staging | Exact staging or production | No | N/A |
| `EMPIRE_DATABASE_URL` | Netlify API, worker, migration | Yes | Yes | Yes | Functions only; pooled URL | Yes; direct URL | Neon PostgreSQL URL with TLS | No | Rotate the database role, then update API and worker atomically |
| `EMPIRE_HOSTED_CONTROL_PLANE_ENABLED` | Netlify API | Yes | Yes | No | Builds and Functions | No | true for approved hosted control plane | No | Disable during incident containment |
| `EMPIRE_HOSTED_PREFLIGHT_STRICT` | Netlify API, worker, release job | Yes | Yes | No | Builds and Functions | Yes | true | No | N/A |
| `EMPIRE_HOSTED_WORKER_ID` | Persistent worker | Yes | Yes | No | No | Yes | Stable non-local worker identifier | No | Change only when deliberately replacing lease authority |
| `EMPIRE_HOSTED_WORKER_ORIGIN` | Remote release verifier | Yes | Yes | No | Release job only | No | Exact HTTPS Fly worker origin | No | Change with worker hostname cutover |
| `EMPIRE_HOSTED_WORKER_REGION` | Persistent worker | Yes | Yes | No | No | Yes | Explicit EU provider region | No | Change only during worker region migration |
| `EMPIRE_INITIAL_CUTOVER` | Protected production release job | No | Every production dispatch | No | Release job only | No | Exact true for first cutover or false for upgrade | No | False after the first successful production release |
| `EMPIRE_INITIAL_ROLLBACK_DEPLOY_ID` | Protected initial production rollback gate | No | Only for first production cutover | No | Release job only | No | Exact approved pre-cutover Netlify deploy ID | No | Unset after the first successful production release |
| `EMPIRE_LEGACY_MATCHMAKING_ENABLED` | Netlify API | Yes | Yes | No | Builds and Functions | No | false | No | N/A |
| `EMPIRE_PERSISTENCE_DRIVER` | Netlify API and worker | Yes | Yes | No | Builds and Functions | Yes | postgres | No | N/A |
| `EMPIRE_PREVIOUS_PRODUCTION_SHA` | Protected production upgrade rollback gate | No | Every non-initial production upgrade | No | Release job only | No | Exact currently deployed 40-character lowercase SHA | No | Set from verified live production health before every upgrade |
| `EMPIRE_PRODUCTION_DATABASE_TARGET_HASH` | Protected production release job | No | Yes | No | Release job only | Yes in production | SHA-256 of the normalized direct production hostname, port and database name | No | Update only after a verified production database replacement |
| `EMPIRE_PRODUCTION_REMOTE_SMOKE` | Guarded production browser smoke | No | Release job | No | Release job only | No | Exact 1 only inside the protected production job | No | Unset outside the smoke process |
| `EMPIRE_PRODUCTION_SMOKE_ACCOUNT_BOOTSTRAP_CONFIRMED` | One-time production smoke account bootstrap | No | One-time | No | Release job only | No | Exact production-smoke-account approval | No | Unset immediately after bootstrap |
| `EMPIRE_PRODUCTION_SMOKE_ACCOUNT_EVIDENCE_PATH` | One-time production smoke account bootstrap | No | One-time | No | Release job only | No | Repository-relative JSON path below artifacts/release/production | Yes | New evidence file per release |
| `EMPIRE_PRODUCTION_SMOKE_ACCOUNT_GANG_NAME` | One-time production smoke account bootstrap | No | One-time | No | Release job only | No | Dedicated synthetic control gang name | No | Update only through an approved account profile change |
| `EMPIRE_PRODUCTION_SMOKE_ACCOUNT_PASSWORD` | One-time production smoke account bootstrap | No | One-time | Yes | Release job only | No | Strong password-manager value of at least 20 characters | No | Rotate after cutover and update the protected production secret |
| `EMPIRE_PRODUCTION_SMOKE_ACCOUNT_USERNAME` | One-time production smoke account bootstrap | No | One-time | No | Release job only | No | Dedicated synthetic control account username | No | Retain as the controlled smoke identity |
| `EMPIRE_PRODUCTION_SMOKE_ARTIFACT_ROOT` | Guarded production browser smoke | No | Release job | No | Release job only | No | Repository-relative path below artifacts/release/production/smoke | Yes | New isolated artifact directory per release |
| `EMPIRE_PUBLIC_ORIGIN` | Frontend and Netlify API | Yes | Yes | No | Builds and Functions | No | Exact HTTPS origin for the environment | No | Change only with DNS and TLS cutover |
| `EMPIRE_RELEASE_DATABASE_URL_DIRECT` | Release validator and migration job | Yes | Yes | Yes | Release job only | No | Direct Neon PostgreSQL URL with TLS | No | Rotate the release database role |
| `EMPIRE_RELEASE_DATABASE_URL_POOLED` | Release validator and pooling smoke | Yes | Yes | Yes | Release job only | No | Transaction-pooled Neon URL with TLS | No | Rotate the Netlify database role |
| `EMPIRE_RELEASE_ENVIRONMENT` | Netlify API, worker, migration, build | Yes | Yes | No | Builds and Functions | Yes | staging or production | No | N/A |
| `EMPIRE_REMOTE_LOAD_POLL_INTERVAL_MS` | Protected remote staging load job | Only for load soak | No | No | Release job only | No | Integer at least 10000 | Yes; 30000 | Tune only with a documented load plan |
| `EMPIRE_REMOTE_LOAD_REPORT_PATH` | Protected remote staging load job | Only for load soak | No | No | Release job only | No | Repository-relative artifact path | Yes | New path per release |
| `EMPIRE_REMOTE_LOAD_SOAK_MINUTES` | Protected remote staging load job | Only for load soak | No | No | Release job only | No | Integer 60-360 | No | Set per approved staging run |
| `EMPIRE_REMOTE_MAX_DB_CONNECTIONS` | Protected remote staging load job | Only for load soak | No | No | Release job only | No | Approved positive connection threshold | No | Update only after reviewed provider or pool capacity change |
| `EMPIRE_REMOTE_MAX_WORKER_CPU_PCT` | Protected remote staging load job | Only for load soak | No | No | Release job only | No | Approved percentage greater than 0 and at most 100 | No | Update only after reviewed worker sizing |
| `EMPIRE_REMOTE_MAX_WORKER_MEMORY_BYTES` | Protected remote staging load job | Only for load soak | No | No | Release job only | No | Approved positive byte threshold below the worker memory limit | No | Update only after reviewed worker sizing |
| `EMPIRE_REMOTE_MAX_WORKER_THROTTLE_INCREASE` | Protected remote staging load job | Only for load soak | No | No | Release job only | No | Maximum Fly throttle counter increase in centiseconds per two-minute sample | No | Update only after reviewed CPU quota |
| `EMPIRE_REMOTE_RELEASE_EVIDENCE_PATH` | Remote release verifier | Yes | Yes | No | Release job only | No | Repository-relative artifact path | Yes | New path per environment or release |
| `EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED` | Protected remote staging acceptance job | Only for controlled scenario setup | Forbidden | No | Release job only | No | Exact staging-only-fixture-write approval | No | Unset after each scenario setup |
| `EMPIRE_REMOTE_STAGING_LOAD_SOAK` | Protected remote staging load job | Only for load soak | Forbidden | No | Release job only | No | 1 in the guarded Playwright child only | No | Unset after each load run |
| `EMPIRE_ROLLBACK_COMPATIBILITY_EVIDENCE_PATH` | Release rollback compatibility verifier | Only for rollback rehearsal | Only for an upgrade rollback gate | No | Release job only | No | Repository-relative JSON artifact path | Yes | New evidence file per release |
| `EMPIRE_ROLLBACK_PREVIOUS_SHA` | Release rollback compatibility verifier | Only for rollback rehearsal | Only for an upgrade rollback gate | No | Release job only | No | Exact earlier 40-character lowercase SHA | No | Set to the immutable release being replaced |
| `EMPIRE_RUNTIME_REGION` | Netlify API and worker | Yes | Yes | No | Builds and Functions | Yes | Explicit EU runtime region | No | Change only with an approved region cutover |
| `EMPIRE_SERVER_PROVISIONING_ENABLED` | Netlify API | Yes | Yes | No | Builds and Functions | No | true only for approved release | No | Disable before rollback or incident response |
| `EMPIRE_STAGING_DATABASE_TARGET_HASH` | Protected staging release, worker and remote acceptance | Yes | No | No | Release job only | Yes in staging | SHA-256 of the normalized direct or pooled staging hostname, port and database name | No | Update only after verified staging database replacement |
| `EMPIRE_TICK_WORKER_OWNER_ID` | Persistent worker | Yes | Yes | No | No | Yes | Exactly equal to EMPIRE_HOSTED_WORKER_ID | No | Rotate with lease-authority replacement |
| `EMPIRE_WAR_HOSTING_ENABLED` | Netlify API | Yes | Yes | No | Builds and Functions | No | false for closed alpha | No | Keep false until a separately approved release |
| `GAMEPLAY_DATABASE_URL` | Netlify API, worker, migration | Yes | Yes | Yes | Functions only; pooled URL | Yes; direct URL | Same Neon target as EMPIRE_DATABASE_URL, with TLS | No | Rotate the database role, then update API and worker atomically |
| `GAMEPLAY_PERSISTENCE_DRIVER` | Netlify API and worker | Yes | Yes | No | Builds and Functions | Yes | postgres | No | N/A |
| `GAMEPLAY_RELEASE_DATABASE_URL_DIRECT` | Release validator and migration job | Yes | Yes | Yes | Release job only | No | Same direct Neon target as EMPIRE release URL | No | Rotate the release database role |
| `GAMEPLAY_RELEASE_DATABASE_URL_POOLED` | Release validator and pooling smoke | Yes | Yes | Yes | Release job only | No | Same pooled Neon target as EMPIRE release URL | No | Rotate the Netlify database role |
| `GAMEPLAY_SLICE_SESSION_SECRET` | Netlify API and worker | Yes | Yes | Yes | Functions only | Yes | 64 hex or 43+ base64url characters; unique | No | Rotate jointly; revoke gameplay sessions |
| `GAMEPLAY_SLICE_SNAPSHOT_SECRET` | Netlify API and worker | Yes | Yes | Yes | Functions only | Yes | 64 hex or 43+ base64url characters; unique | No | Rotate jointly; invalidate outstanding snapshot tokens |
| `NETLIFY` | Netlify build source guard | Provider-owned | Provider-owned | No | Builds only; provider-owned | No | Exact true when Netlify executes the public build | Yes; absent outside Netlify | N/A |
| `NODE_ENV` | Netlify API, worker, build | Yes | Yes | No | Builds and Functions | Yes | production | No | N/A |
| `PORT` | Persistent worker | Yes | Yes | No | Provider-owned; do not override | Yes | 1-65535; Fly default 8080 | Yes; 8080 | Change with worker service configuration |

## Provider and protected GitHub environment variables

Provider credentials exist only in protected GitHub environments and release steps. Deploy previews receive none of these secrets.

| Variable | Component | Staging required | Production required | Secret | Netlify scope | Worker scope | Safe format | Default allowed | Rotation instructions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FLY_API_TOKEN` | GitHub worker deploy job | Yes | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | App-scoped Fly deploy token | No | Rotate in Fly; update protected GitHub environment secret |
| `FLY_METRICS_TOKEN` | Protected GitHub staging load job | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Read-only Fly org metrics token; FlyV1 or Bearer authorization value | No | Rotate in Fly; update protected GitHub environment secret |
| `FLY_ORG_SLUG` | Protected GitHub staging load job | Yes | No | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Exact lowercase Fly organization slug | No | Change only when moving the worker app to another organization |
| `FLY_PRODUCTION_APP` | GitHub production deploy job | No | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Dedicated production Fly app name | No | Change only when replacing production worker app |
| `FLY_STAGING_APP` | GitHub staging deploy, acceptance and rollback jobs | Yes | No | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Exact empire-streets-staging-worker app name | No | Change only with the independent repository pin |
| `NEON_API_KEY` | GitHub backup release step | Yes | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Least-privilege Neon API key | No | Rotate in Neon; update protected GitHub environment secret |
| `NEON_PRODUCTION_PROJECT_ID` | GitHub production deploy job | No | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Production-only Neon project ID | No | Change only when replacing production database project |
| `NEON_PRODUCTION_ROOT_BRANCH_ID` | GitHub production deploy job | No | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Production root branch ID | No | Change only after verified branch migration |
| `NEON_STAGING_PROJECT_ID` | GitHub staging deploy and provider-binding guard | Yes | No | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Staging-only Neon project ID verified against the provider response | No | Change only when replacing staging database project |
| `NEON_STAGING_ROOT_BRANCH_ID` | GitHub staging deploy and provider-binding guard | Yes | No | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Staging root branch ID verified against the provider response | No | Change only after verified branch migration |
| `NETLIFY_AUTH_TOKEN` | GitHub staging/production deploy job | Yes | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Netlify personal or service token | No | Rotate in Netlify; update protected GitHub environment secret |
| `NETLIFY_PRODUCTION_SITE_ID` | GitHub staging negative-target guard and production deploy job | Yes as negative target pin | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Production site ID used as a fail-closed staging exclusion | No | Change only during approved site cutover |
| `NETLIFY_STAGING_SITE_ID` | GitHub staging deploy job | Yes | No | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Isolated staging site ID | No | Change only when replacing staging site |
| `PRODUCTION_ACCOUNT_TERMS_VERSION` | Protected production release configuration | No | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Approved immutable production terms version | No | Bump only with an approved terms change |
| `PRODUCTION_ADMIN_DISPLAY_NAME` | One-time protected production bootstrap | No | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Non-secret production owner display name | No | Update through audited admin flow |
| `PRODUCTION_ADMIN_FINGERPRINT_SECRET` | Protected production API deploy | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | 64 hex or safe base64url unique production secret | No | Rotate and invalidate production admin fingerprints |
| `PRODUCTION_ADMIN_INITIAL_PASSWORD` | One-time protected production bootstrap | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Strong generated temporary password | No | Delete immediately after verified rotation |
| `PRODUCTION_ADMIN_PASSWORD` | Protected production login verification | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Rotated owner password | No | Rotate in password manager and protected GitHub environment |
| `PRODUCTION_ADMIN_SESSION_SECRET` | Protected production API deploy | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | At least 32 bytes and unique from every other production secret | No | Rotate and revoke all production admin sessions |
| `PRODUCTION_ADMIN_USERNAME` | Protected production admin verification | No | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Dedicated production owner username | No | Change only through an audited owner transition |
| `PRODUCTION_AUTH_THROTTLE_PEPPER` | Protected production API deploy | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | 64 hex or safe base64url unique production pepper | No | Rotate during a controlled production API deploy |
| `PRODUCTION_DATABASE_URL_DIRECT` | Protected GitHub production environment | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Direct TLS URL for production | No | Rotate production database role |
| `PRODUCTION_DATABASE_URL_POOLED` | Protected GitHub production environment | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Pooled TLS URL for the same production target | No | Rotate production Netlify database role |
| `PRODUCTION_GAMEPLAY_SESSION_SECRET` | Protected production API and worker deploy | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | 64 hex or safe base64url unique production secret | No | Rotate jointly and revoke production gameplay sessions |
| `PRODUCTION_GAMEPLAY_SNAPSHOT_SECRET` | Protected production API and worker deploy | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | 64 hex or safe base64url unique production secret | No | Rotate jointly and invalidate production snapshot tokens |
| `PRODUCTION_SMOKE_ACCOUNT_GANG_NAME` | Protected production smoke job | No | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Dedicated synthetic control gang name | No | Change only with an approved smoke account replacement |
| `PRODUCTION_SMOKE_ACCOUNT_PASSWORD` | Protected production smoke job | No | Yes | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Strong password-manager value | No | Rotate after cutover and update the protected GitHub environment secret |
| `PRODUCTION_SMOKE_ACCOUNT_USERNAME` | Protected production smoke job | No | Yes | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Dedicated synthetic control account username | No | Retain or replace through the guarded bootstrap job |
| `STAGING_ACCOUNT_TERMS_VERSION` | Protected staging release configuration | Yes | No | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Approved immutable staging terms version | No | Bump only with an approved terms change |
| `STAGING_ADMIN_DISPLAY_NAME` | One-time protected staging bootstrap | Yes | No | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Non-secret staging owner display name | No | Update through audited admin flow |
| `STAGING_ADMIN_FINGERPRINT_SECRET` | Protected staging API deploy | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | 64 hex or safe base64url unique staging secret | No | Rotate and invalidate staging admin fingerprints |
| `STAGING_ADMIN_INITIAL_PASSWORD` | One-time protected staging bootstrap | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Strong generated temporary password | No | Delete immediately after verified rotation |
| `STAGING_ADMIN_PASSWORD` | Protected staging login verification | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Rotated owner password | No | Rotate in password manager and protected GitHub environment |
| `STAGING_ADMIN_SESSION_SECRET` | Protected staging API deploy | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | At least 32 bytes and unique from every other staging secret | No | Rotate and revoke all staging admin sessions |
| `STAGING_ADMIN_USERNAME` | Protected staging admin verification | Yes | No | No | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Dedicated staging owner username | No | Change only through an audited owner transition |
| `STAGING_AUTH_THROTTLE_PEPPER` | Protected staging API deploy | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | 64 hex or safe base64url unique staging pepper | No | Rotate during a controlled staging API deploy |
| `STAGING_DATABASE_URL_DIRECT` | Protected GitHub staging environment | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Direct TLS URL for staging | No | Rotate staging database role |
| `STAGING_DATABASE_URL_POOLED` | Protected GitHub staging environment | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | Pooled TLS URL for the same staging target | No | Rotate staging Netlify database role |
| `STAGING_GAMEPLAY_SESSION_SECRET` | Protected staging API and worker deploy | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | 64 hex or safe base64url unique staging secret | No | Rotate jointly and revoke staging gameplay sessions |
| `STAGING_GAMEPLAY_SNAPSHOT_SECRET` | Protected staging API and worker deploy | Yes | No | Yes | Never injected into site runtime | Never injected unless explicitly mapped to a runtime variable | 64 hex or safe base64url unique staging secret | No | Rotate jointly and invalidate staging snapshot tokens |

## Local, test, simulation and CI-only reads

These values are forbidden as public-runtime dependencies. Secret-like test values are ephemeral and must never reuse staging or production secrets.

| Variable | Component | Staging required | Production required | Secret | Netlify scope | Worker scope | Safe format | Default allowed | Rotation instructions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CI` | CI platform tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `DAY_NIGHT_BALANCE_REPORT` | Simulation tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_ACCOUNT_REGISTRATION_KILL_SWITCH_E2E` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_ACCOUNT_REGISTRATION_LIVE_E2E` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_ADMIN_HOSTED_LIVE_E2E` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_ALLOW_LIVE_POSTGRES_SMOKE` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_BROWSER_PATH` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_CAPTURE_UI_PARITY_BASELINE` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_CLOSED_ALPHA_PREFLIGHT_STRICT` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_GAMEPLAY_SMOKE_STORAGE_STATE` | Browser and hosted acceptance tests | No | No | Test secret | None | None | Local, CI or test-specific value | Yes outside public runtime | Discard after the test run; never reuse a public secret |
| `EMPIRE_HOSTED_API_PORT` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_BOOTSTRAP_GANG_NAME` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_BOOTSTRAP_PASSWORD` | Local development or verification tooling | No | No | Test secret | None | None | Local, CI or test-specific value | Yes outside public runtime | Discard after the test run; never reuse a public secret |
| `EMPIRE_HOSTED_BOOTSTRAP_USERNAME` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_BUILDING_ACTION_PHASE` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_E2E_FIXTURES` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_RUNTIME_AUTHORITY_ENABLED` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_HOSTED_UI_PARITY_E2E` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_KILL_SWITCH_PASSWORD` | Browser and hosted acceptance tests | No | No | Test secret | None | None | Local, CI or test-specific value | Yes outside public runtime | Discard after the test run; never reuse a public secret |
| `EMPIRE_KILL_SWITCH_USERNAME` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_LOCAL_HOSTED_BROWSER_ARTIFACT_ROOT` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_LOCAL_HOSTED_RUNTIME_OUT_DIR` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_MANUAL_HOSTED_DISPLAY_NAME` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_MANUAL_HOSTED_E2E` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_MANUAL_HOSTED_STARTING_STATE_JSON` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_NODE24_BIN` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_PERSISTENCE_DIR` | Local persistence tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_PLAYER_ENTRY_LIVE_E2E` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_PRE_ALPHA_FINAL_REGISTRATION_MODE` | Canonical pre-alpha staging final registration policy selector | Gate invocation only | No | No | Protected staging release job only; never injected into the site | None | closed or open; defaults fail-closed to closed | Yes; closed | Set to open only for an explicitly approved time-limited staging window |
| `EMPIRE_PRE_ALPHA_STAGING_ARTIFACT_ROOT` | Canonical pre-alpha staging gate artifacts | Gate invocation only | No | No | Protected staging release job only; never injected into the site | None | Repository-relative artifact directory under artifacts/ | Yes; artifacts/pre-alpha-staging | Use an isolated directory for each release run |
| `EMPIRE_PRE_ALPHA_STAGING_CLOSED_EVIDENCE_PATH` | Legacy closed-only pre-alpha staging registration evidence fallback | Gate invocation only | No | No | Protected staging release job only; never injected into the site | None | Path to downloaded closed-registration JSON evidence | No | Regenerate for each exact release SHA |
| `EMPIRE_PRE_ALPHA_STAGING_FINAL_REGISTRATION_EVIDENCE_PATH` | Canonical pre-alpha staging final registration evidence | Gate invocation only | No | No | Protected staging release job only; never injected into the site | None | Path to exact-SHA automated final verdict JSON with the selected registration policy | No | Regenerate for each exact release SHA |
| `EMPIRE_PRE_ALPHA_STAGING_FLY_APP` | Protected staging Fly target pin | Staging deploy, remote gate and rollback | No | No | Protected staging release job only; never injected into the site | None | Exact canonical empire-streets-staging-worker name equal to FLY_STAGING_APP | Yes; immutable repository pin | Change only with an audited staging worker replacement |
| `EMPIRE_PRE_ALPHA_STAGING_REMOTE_APPROVED` | Protected staging remote-mutation approval guard | Remote gate only | No | No | Protected staging release job only; never injected into the site | None | Exact staging-only-remote-acceptance guard value | No | Set explicitly for each guarded remote invocation |
| `EMPIRE_PRODUCTION_AUTHORITY_PREFLIGHT_STRICT` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_REGISTRATION_ONLY_PREFLIGHT_STRICT` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_REMOTE_STAGING_ARTIFACT_ROOT` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_AFTER` | Disposable staging fixture identity binding | Remote lifecycle suite only | No | No | None | None | ISO-8601 lower creation-time bound generated for the current run | No | Regenerate for every disposable staging fixture |
| `EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_BEFORE` | Disposable staging fixture identity binding | Remote lifecycle suite only | No | No | None | None | ISO-8601 upper creation-time bound generated for the current run | No | Regenerate for every disposable staging fixture |
| `EMPIRE_REMOTE_STAGING_FIXTURE_DISPLAY_PREFIX` | Disposable staging fixture identity binding | Remote lifecycle suite only | No | No | None | None | Canonical lifecycle display prefix ending in the run nonce hash prefix | No | Regenerate for every disposable staging fixture |
| `EMPIRE_REMOTE_STAGING_RUN_NONCE_HASH` | Disposable staging fixture identity binding | Remote lifecycle suite only | No | No | None | None | 64 lowercase hexadecimal SHA-256 nonce hash | No | Regenerate for every disposable staging fixture |
| `EMPIRE_RUNTIME_DEBUG` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_STAGING_NEON_BACKUP_EVIDENCE_PATH` | Staging Neon snapshot binding evidence | Protected staging release job only | No | No | Release job only; never injected into the site | None | Repository-relative database-backup JSON artifact path | No | Regenerate for every exact staging release SHA |
| `EMPIRE_STAGING_NEON_BINDING_EVIDENCE_PATH` | Staging Neon provider target binding evidence | Protected staging release job only | No | No | Release job only; never injected into the site | None | Repository-relative hashed provider-binding JSON artifact path | No | Regenerate before every staging snapshot mutation |
| `EMPIRE_STAGING_NEON_BRANCH_RESPONSE_PATH` | Staging Neon provider target binding | Protected staging release job only | No | No | Release job only; never injected into the site | None | Ephemeral runner path to the provider branch response | No | Delete immediately after target verification |
| `EMPIRE_STAGING_NEON_ENDPOINTS_RESPONSE_PATH` | Staging Neon provider target binding | Protected staging release job only | No | No | Release job only; never injected into the site | None | Ephemeral runner path to the provider endpoint response | No | Delete immediately after target verification |
| `EMPIRE_STAGING_NEON_SNAPSHOT_NAME` | Staging Neon snapshot binding | Protected staging release job only | No | No | Release job only; never injected into the site | None | Generated staging snapshot name bound to the exact release SHA | No | Regenerate for every staging snapshot |
| `EMPIRE_STAGING_NEON_SNAPSHOT_RESPONSE_PATH` | Staging Neon snapshot binding | Protected staging release job only | No | No | Release job only; never injected into the site | None | Ephemeral runner path to the provider snapshot response | No | Delete immediately after snapshot verification |
| `EMPIRE_TEST_DATABASE_URL` | Local persistence tests | No | No | Test secret | None | None | Local, CI or test-specific value | Yes outside public runtime | Discard after the test run; never reuse a public secret |
| `EMPIRE_UI_PARITY_ARTIFACT_ROOT` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_UI_PARITY_NON_SPAWN_KEYS` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_UI_PARITY_SERVER_ID` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_UI_PARITY_SOCIAL_BATCH_KEYS` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EMPIRE_VITE_HOSTED_API_ORIGIN` | Local development or verification tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `EVIDENCE_OUTPUT` | CI staging release evidence assembly | CI release job only | No | No | Release job only; never injected into the site | None | Workflow-local artifact output directory | No | Use an isolated directory for each release run |
| `GAMEPLAY_PERSISTENCE_DIR` | Local persistence tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `GITHUB_ACTIONS` | CI platform tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `GITHUB_ENV` | CI platform tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `NEON_BRANCH_ID` | Staging Neon workflow branch alias | Protected staging release job only | No | No | Release job only; never injected into the site | None | Exact protected staging branch ID | No | Change only after verified staging branch migration |
| `NEON_PROJECT_ID` | Staging Neon workflow project alias | Protected staging release job only | No | No | Release job only; never injected into the site | None | Exact protected staging project ID | No | Change only when replacing the staging database project |
| `PLAYWRIGHT_E2E_BASE_URL` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `PLAYWRIGHT_E2E_HEALTH_URL` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `PLAYWRIGHT_E2E_HOST` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `PLAYWRIGHT_E2E_PORT` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `PLAYWRIGHT_E2E_RESERVE_TIMEOUT_MS` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `PLAYWRIGHT_E2E_WEB_SERVER_COMMAND` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `PLAYWRIGHT_PORT` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `PLAYWRIGHT_SKIP_WEB_SERVER` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `PLAYWRIGHT_WORKERS` | Browser and hosted acceptance tests | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `RELEASE_SHA` | CI staging release workflow | CI release job only | No | No | Release job only; never injected into the site | None | Exact 40-character lowercase Git commit SHA | No | Set to the immutable commit selected for each release run |
| `SIM_REPORT_DIR` | Simulation tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `SIM_SCENARIO` | Simulation tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `SIM_SEED` | Simulation tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `SIM_SEED_LIST` | Simulation tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `SITE_ID` | CI platform tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |
| `URL` | CI platform tooling | No | No | No | None | None | Local, CI or test-specific value | Yes outside public runtime | N/A |

## Secret separation and generation

Generate each of the five runtime secrets independently with a cryptographically secure generator, for example `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Never use `Math.random`.

`GAMEPLAY_SLICE_SESSION_SECRET`, `GAMEPLAY_SLICE_SNAPSHOT_SECRET`, `EMPIRE_ADMIN_FINGERPRINT_SECRET`, `EMPIRE_ADMIN_SESSION_SECRET`, and `EMPIRE_AUTH_THROTTLE_PEPPER` must all differ. `EMPIRE_ADMIN_SESSION_SECRET` is required in staging and production, contains at least 32 bytes, and is encoded as 64 hex or safe base64url.

## Scope rules

- Netlify Functions use pooled database URLs; the persistent worker and migration job use direct URLs.
- Direct and pooled URLs must resolve to the same provider project, branch, database and schema version.
- Netlify deploy previews use an isolated test branch/database or have no state-changing backend. Production credentials are never exposed to previews or untrusted pull requests.
- Bootstrap passwords are one-time release inputs. Remove the temporary bootstrap password immediately after successful login verification and rotation.
- Runtime secrets are configured through provider UI, CLI or API, never in `netlify.toml`, `.env.example`, artifacts or logs.
