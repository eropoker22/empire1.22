import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SOURCE_EXTENSION_PATTERN = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/u;
const STATIC_READ_PATTERNS = [
  /\bprocess\.env(?:\?|)\.([A-Z][A-Z0-9_]*)/gu,
  /\bprocess\.env\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/gu,
  /\b(?:environment|env)(?:\?|)\.([A-Z][A-Z0-9_]*)/gu,
  /\b(?:environment|env)\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\]/gu
];
const DYNAMIC_READ_PATTERN = /\b(?:process\.env|environment|env)\[\s*(?!["'`])/gu;

export const normalizeEnvironmentMatrixText = (value) => String(value).replace(/\r\n/gu, "\n");

const runtime = (variable, component, options = {}) => ({
  variable,
  component,
  stagingRequired: options.stagingRequired ?? "Yes",
  productionRequired: options.productionRequired ?? "Yes",
  secret: options.secret ?? "No",
  netlifyScope: options.netlifyScope ?? "Builds and Functions",
  workerScope: options.workerScope ?? "Yes",
  safeFormat: options.safeFormat ?? "Explicit value; no implicit public default",
  defaultAllowed: options.defaultAllowed ?? "No",
  rotation: options.rotation ?? "Redeploy the affected component"
});

const PUBLIC_RELEASE_ROWS = [
  runtime("NODE_ENV", "Netlify API, worker, build", { safeFormat: "production", rotation: "N/A" }),
  runtime("NETLIFY", "Netlify build source guard", {
    stagingRequired: "Provider-owned",
    productionRequired: "Provider-owned",
    netlifyScope: "Builds only; provider-owned",
    workerScope: "No",
    safeFormat: "Exact true when Netlify executes the public build",
    defaultAllowed: "Yes; absent outside Netlify",
    rotation: "N/A"
  }),
  runtime("EMPIRE_RELEASE_ENVIRONMENT", "Netlify API, worker, migration, build", { safeFormat: "staging or production", rotation: "N/A" }),
  runtime("EMPIRE_DATABASE_URL", "Netlify API, worker, migration", {
    secret: "Yes", netlifyScope: "Functions only; pooled URL", workerScope: "Yes; direct URL",
    safeFormat: "Neon PostgreSQL URL with TLS", rotation: "Rotate the database role, then update API and worker atomically"
  }),
  runtime("GAMEPLAY_DATABASE_URL", "Netlify API, worker, migration", {
    secret: "Yes", netlifyScope: "Functions only; pooled URL", workerScope: "Yes; direct URL",
    safeFormat: "Same Neon target as EMPIRE_DATABASE_URL, with TLS", rotation: "Rotate the database role, then update API and worker atomically"
  }),
  runtime("EMPIRE_RELEASE_DATABASE_URL_DIRECT", "Release validator and migration job", {
    secret: "Yes", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Direct Neon PostgreSQL URL with TLS", rotation: "Rotate the release database role"
  }),
  runtime("GAMEPLAY_RELEASE_DATABASE_URL_DIRECT", "Release validator and migration job", {
    secret: "Yes", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Same direct Neon target as EMPIRE release URL", rotation: "Rotate the release database role"
  }),
  runtime("EMPIRE_RELEASE_DATABASE_URL_POOLED", "Release validator and pooling smoke", {
    secret: "Yes", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Transaction-pooled Neon URL with TLS", rotation: "Rotate the Netlify database role"
  }),
  runtime("GAMEPLAY_RELEASE_DATABASE_URL_POOLED", "Release validator and pooling smoke", {
    secret: "Yes", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Same pooled Neon target as EMPIRE release URL", rotation: "Rotate the Netlify database role"
  }),
  runtime("EMPIRE_DATABASE_TARGET_ENVIRONMENT", "Migration release guard and staging worker target pin", {
    netlifyScope: "Release job only", workerScope: "Yes in staging", safeFormat: "Exact staging or production", rotation: "N/A"
  }),
  runtime("EMPIRE_DATABASE_BACKUP_CONFIRMED", "Migration release guard", {
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "true only after a fresh provider snapshot", rotation: "Reset after each release"
  }),
  runtime("EMPIRE_DATABASE_BACKUP_ID", "Migration release guard", {
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Non-secret snapshot identifier hash", rotation: "Use a new hash for every release"
  }),
  runtime("EMPIRE_DATABASE_INITIALIZATION_CONFIRMED", "One-time empty-database initializer", {
    stagingRequired: "Only for first empty database", productionRequired: "Only for first empty database",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "true only with explicit dispatch approval", rotation: "Unset immediately after initialization"
  }),
  runtime("EMPIRE_PERSISTENCE_DRIVER", "Netlify API and worker", { safeFormat: "postgres", rotation: "N/A" }),
  runtime("GAMEPLAY_PERSISTENCE_DRIVER", "Netlify API and worker", { safeFormat: "postgres", rotation: "N/A" }),
  runtime("GAMEPLAY_SLICE_SESSION_SECRET", "Netlify API and worker", {
    secret: "Yes", netlifyScope: "Functions only", workerScope: "Yes",
    safeFormat: "64 hex or 43+ base64url characters; unique", rotation: "Rotate jointly; revoke gameplay sessions"
  }),
  runtime("GAMEPLAY_SLICE_SNAPSHOT_SECRET", "Netlify API and worker", {
    secret: "Yes", netlifyScope: "Functions only", workerScope: "Yes",
    safeFormat: "64 hex or 43+ base64url characters; unique", rotation: "Rotate jointly; invalidate outstanding snapshot tokens"
  }),
  runtime("EMPIRE_ADMIN_FINGERPRINT_SECRET", "Netlify API", {
    secret: "Yes", netlifyScope: "Functions only", workerScope: "No",
    safeFormat: "64 hex or 43+ base64url characters; unique", rotation: "Rotate and invalidate admin fingerprints"
  }),
  runtime("EMPIRE_ADMIN_SESSION_SECRET", "Netlify API", {
    secret: "Yes", netlifyScope: "Functions only", workerScope: "No",
    safeFormat: "At least 32 bytes; 64 hex or 43+ base64url; unique", rotation: "Rotate and revoke all admin sessions"
  }),
  runtime("EMPIRE_AUTH_THROTTLE_PEPPER", "Netlify API", {
    secret: "Yes", netlifyScope: "Functions only", workerScope: "No",
    safeFormat: "64 hex or 43+ base64url characters; unique", rotation: "Rotate during a controlled API deploy"
  }),
  runtime("EMPIRE_ADMIN_BOOTSTRAP_USERNAME", "One-time admin bootstrap job", {
    stagingRequired: "One-time", productionRequired: "One-time", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Dedicated owner username", rotation: "Keep as account identity; not a runtime secret"
  }),
  runtime("EMPIRE_ADMIN_BOOTSTRAP_PASSWORD", "One-time admin bootstrap job", {
    stagingRequired: "One-time", productionRequired: "One-time", secret: "Yes", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Strong generated temporary password", rotation: "Rotate immediately, then delete from release environment"
  }),
  runtime("EMPIRE_ADMIN_NEW_PASSWORD", "Admin password rotation job", {
    stagingRequired: "One-time", productionRequired: "One-time", secret: "Yes", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Strong generated final owner password", rotation: "Rotate in the password manager and verify login"
  }),
  runtime("EMPIRE_ADMIN_BOOTSTRAP_ROLE", "One-time admin bootstrap job", {
    stagingRequired: "One-time", productionRequired: "One-time", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "owner", defaultAllowed: "Yes; owner", rotation: "Change through audited admin policy only"
  }),
  runtime("EMPIRE_ADMIN_BOOTSTRAP_DISPLAY_NAME", "One-time admin bootstrap job", {
    stagingRequired: "One-time", productionRequired: "One-time", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Non-secret operator display name", rotation: "Update through audited admin flow"
  }),
  runtime("EMPIRE_PRODUCTION_SMOKE_ACCOUNT_BOOTSTRAP_CONFIRMED", "One-time production smoke account bootstrap", {
    stagingRequired: "No", productionRequired: "One-time", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Exact production-smoke-account approval", rotation: "Unset immediately after bootstrap"
  }),
  runtime("EMPIRE_PRODUCTION_SMOKE_ACCOUNT_USERNAME", "One-time production smoke account bootstrap", {
    stagingRequired: "No", productionRequired: "One-time", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Dedicated synthetic control account username", rotation: "Retain as the controlled smoke identity"
  }),
  runtime("EMPIRE_PRODUCTION_SMOKE_ACCOUNT_GANG_NAME", "One-time production smoke account bootstrap", {
    stagingRequired: "No", productionRequired: "One-time", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Dedicated synthetic control gang name", rotation: "Update only through an approved account profile change"
  }),
  runtime("EMPIRE_PRODUCTION_SMOKE_ACCOUNT_PASSWORD", "One-time production smoke account bootstrap", {
    stagingRequired: "No", productionRequired: "One-time", secret: "Yes", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Strong password-manager value of at least 20 characters", rotation: "Rotate after cutover and update the protected production secret"
  }),
  runtime("EMPIRE_PRODUCTION_SMOKE_ACCOUNT_EVIDENCE_PATH", "One-time production smoke account bootstrap", {
    stagingRequired: "No", productionRequired: "One-time", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Repository-relative JSON path below artifacts/release/production", defaultAllowed: "Yes", rotation: "New evidence file per release"
  }),
  runtime("EMPIRE_PRODUCTION_REMOTE_SMOKE", "Guarded production browser smoke", {
    stagingRequired: "No", productionRequired: "Release job", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Exact 1 only inside the protected production job", rotation: "Unset outside the smoke process"
  }),
  runtime("EMPIRE_PRODUCTION_SMOKE_ARTIFACT_ROOT", "Guarded production browser smoke", {
    stagingRequired: "No", productionRequired: "Release job", netlifyScope: "Release job only", workerScope: "No",
    safeFormat: "Repository-relative path below artifacts/release/production/smoke", defaultAllowed: "Yes",
    rotation: "New isolated artifact directory per release"
  }),
  runtime("EMPIRE_ADMIN_WRITES_ENABLED", "Netlify API", { workerScope: "No", safeFormat: "true for approved hosted control plane", rotation: "Disable during incident containment" }),
  runtime("EMPIRE_HOSTED_CONTROL_PLANE_ENABLED", "Netlify API", { workerScope: "No", safeFormat: "true for approved hosted control plane", rotation: "Disable during incident containment" }),
  runtime("EMPIRE_SERVER_PROVISIONING_ENABLED", "Netlify API", { workerScope: "No", safeFormat: "true only for approved release", rotation: "Disable before rollback or incident response" }),
  runtime("EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED", "Netlify API", { workerScope: "No", safeFormat: "false by default; true only for an explicit bounded staging deployment or acceptance window", rotation: "Set false before production deploy or incident response" }),
  runtime("EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT", "Netlify API", {
    stagingRequired: "Only while registration is true", productionRequired: "Only while registration is true",
    workerScope: "No", safeFormat: "Future ISO timestamp no more than 24 hours away", rotation: "Unset whenever registration is closed"
  }),
  runtime("EMPIRE_ACCOUNT_TERMS_VERSION", "Netlify API", { workerScope: "No", safeFormat: "Approved immutable terms version", rotation: "Bump only with approved terms change" }),
  runtime("EMPIRE_LEGACY_MATCHMAKING_ENABLED", "Netlify API", { workerScope: "No", safeFormat: "false", rotation: "N/A" }),
  runtime("EMPIRE_WAR_HOSTING_ENABLED", "Netlify API", { workerScope: "No", safeFormat: "false for closed alpha", rotation: "Keep false until a separately approved release" }),
  runtime("EMPIRE_PUBLIC_ORIGIN", "Frontend and Netlify API", { workerScope: "No", safeFormat: "Exact HTTPS origin for the environment", rotation: "Change only with DNS and TLS cutover" }),
  runtime("EMPIRE_ALLOWED_ORIGINS", "Netlify API", { workerScope: "No", safeFormat: "One exact HTTPS origin; never wildcard", rotation: "Change only with an approved origin cutover" }),
  runtime("EMPIRE_BUILD_SHA", "Frontend, Netlify API, worker, release job", { safeFormat: "Exact 40-character lowercase checkout SHA", rotation: "Automatic on every immutable deploy" }),
  runtime("EMPIRE_HOSTED_WORKER_ID", "Persistent worker", { netlifyScope: "No", safeFormat: "Stable non-local worker identifier", rotation: "Change only when deliberately replacing lease authority" }),
  runtime("EMPIRE_HOSTED_WORKER_REGION", "Persistent worker", { netlifyScope: "No", safeFormat: "Explicit EU provider region", rotation: "Change only during worker region migration" }),
  runtime("EMPIRE_RUNTIME_REGION", "Netlify API and worker", { safeFormat: "Explicit EU runtime region", rotation: "Change only with an approved region cutover" }),
  runtime("EMPIRE_TICK_WORKER_OWNER_ID", "Persistent worker", { netlifyScope: "No", safeFormat: "Exactly equal to EMPIRE_HOSTED_WORKER_ID", rotation: "Rotate with lease-authority replacement" }),
  runtime("EMPIRE_HOSTED_PREFLIGHT_STRICT", "Netlify API, worker, release job", { safeFormat: "true", rotation: "N/A" }),
  runtime("EMPIRE_HOSTED_WORKER_ORIGIN", "Remote release verifier", { netlifyScope: "Release job only", workerScope: "No", safeFormat: "Exact HTTPS Fly worker origin", rotation: "Change with worker hostname cutover" }),
  runtime("EMPIRE_REMOTE_RELEASE_EVIDENCE_PATH", "Remote release verifier", {
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Repository-relative artifact path", defaultAllowed: "Yes", rotation: "New path per environment or release"
  }),
  runtime("EMPIRE_ROLLBACK_PREVIOUS_SHA", "Release rollback compatibility verifier", {
    stagingRequired: "Only for rollback rehearsal", productionRequired: "Only for an upgrade rollback gate",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Exact earlier 40-character lowercase SHA",
    rotation: "Set to the immutable release being replaced"
  }),
  runtime("EMPIRE_ROLLBACK_COMPATIBILITY_EVIDENCE_PATH", "Release rollback compatibility verifier", {
    stagingRequired: "Only for rollback rehearsal", productionRequired: "Only for an upgrade rollback gate",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Repository-relative JSON artifact path",
    defaultAllowed: "Yes", rotation: "New evidence file per release"
  }),
  runtime("EMPIRE_INITIAL_CUTOVER", "Protected production release job", {
    stagingRequired: "No", productionRequired: "Every production dispatch",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Exact true for first cutover or false for upgrade",
    rotation: "False after the first successful production release"
  }),
  runtime("EMPIRE_PREVIOUS_PRODUCTION_SHA", "Protected production upgrade rollback gate", {
    stagingRequired: "No", productionRequired: "Every non-initial production upgrade",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Exact currently deployed 40-character lowercase SHA",
    rotation: "Set from verified live production health before every upgrade"
  }),
  runtime("EMPIRE_INITIAL_ROLLBACK_DEPLOY_ID", "Protected initial production rollback gate", {
    stagingRequired: "No", productionRequired: "Only for first production cutover",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Exact approved pre-cutover Netlify deploy ID",
    rotation: "Unset after the first successful production release"
  }),
  runtime("EMPIRE_REMOTE_STAGING_FIXTURE_APPROVED", "Protected remote staging acceptance job", {
    stagingRequired: "Only for controlled scenario setup", productionRequired: "Forbidden",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Exact staging-only-fixture-write approval", rotation: "Unset after each scenario setup"
  }),
  runtime("EMPIRE_REMOTE_STAGING_LOAD_SOAK", "Protected remote staging load job", {
    stagingRequired: "Only for load soak", productionRequired: "Forbidden",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "1 in the guarded Playwright child only", rotation: "Unset after each load run"
  }),
  runtime("EMPIRE_REMOTE_LOAD_SOAK_MINUTES", "Protected remote staging load job", {
    stagingRequired: "Only for load soak", productionRequired: "No",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Integer 60-360", rotation: "Set per approved staging run"
  }),
  runtime("EMPIRE_REMOTE_LOAD_POLL_INTERVAL_MS", "Protected remote staging load job", {
    stagingRequired: "Only for load soak", productionRequired: "No",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Integer at least 10000", defaultAllowed: "Yes; 30000", rotation: "Tune only with a documented load plan"
  }),
  runtime("EMPIRE_REMOTE_LOAD_REPORT_PATH", "Protected remote staging load job", {
    stagingRequired: "Only for load soak", productionRequired: "No",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Repository-relative artifact path", defaultAllowed: "Yes", rotation: "New path per release"
  }),
  runtime("EMPIRE_REMOTE_MAX_DB_CONNECTIONS", "Protected remote staging load job", {
    stagingRequired: "Only for load soak", productionRequired: "No",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Approved positive connection threshold", rotation: "Update only after reviewed provider or pool capacity change"
  }),
  runtime("EMPIRE_REMOTE_MAX_WORKER_MEMORY_BYTES", "Protected remote staging load job", {
    stagingRequired: "Only for load soak", productionRequired: "No",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Approved positive byte threshold below the worker memory limit", rotation: "Update only after reviewed worker sizing"
  }),
  runtime("EMPIRE_REMOTE_MAX_WORKER_CPU_PCT", "Protected remote staging load job", {
    stagingRequired: "Only for load soak", productionRequired: "No",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Approved percentage greater than 0 and at most 100", rotation: "Update only after reviewed worker sizing"
  }),
  runtime("EMPIRE_REMOTE_MAX_WORKER_THROTTLE_INCREASE", "Protected remote staging load job", {
    stagingRequired: "Only for load soak", productionRequired: "No",
    netlifyScope: "Release job only", workerScope: "No", safeFormat: "Maximum Fly throttle counter increase in centiseconds per two-minute sample", rotation: "Update only after reviewed CPU quota"
  }),
  runtime("EMPIRE_STAGING_DATABASE_TARGET_HASH", "Protected staging release, worker and remote acceptance", {
    stagingRequired: "Yes", productionRequired: "No",
    netlifyScope: "Release job only", workerScope: "Yes in staging",
    safeFormat: "SHA-256 of the normalized direct or pooled staging hostname, port and database name",
    rotation: "Update only after verified staging database replacement"
  }),
  runtime("EMPIRE_PRODUCTION_DATABASE_TARGET_HASH", "Protected production release job", {
    stagingRequired: "No", productionRequired: "Yes", netlifyScope: "Release job only", workerScope: "Yes in production",
    safeFormat: "SHA-256 of the normalized direct production hostname, port and database name",
    rotation: "Update only after a verified production database replacement"
  }),
  runtime("PORT", "Persistent worker", {
    netlifyScope: "Provider-owned; do not override", workerScope: "Yes", safeFormat: "1-65535; Fly default 8080", defaultAllowed: "Yes; 8080", rotation: "Change with worker service configuration"
  })
];

const NON_RELEASE_TOOLING_ROWS = new Map([
  ["EMPIRE_PRE_ALPHA_STAGING_ARTIFACT_ROOT", {
    component: "Canonical pre-alpha staging gate artifacts",
    stagingRequired: "Gate invocation only",
    netlifyScope: "Protected staging release job only; never injected into the site",
    safeFormat: "Repository-relative artifact directory under artifacts/",
    defaultAllowed: "Yes; artifacts/pre-alpha-staging",
    rotation: "Use an isolated directory for each release run"
  }],
  ["EMPIRE_PRE_ALPHA_STAGING_CLOSED_EVIDENCE_PATH", {
    component: "Legacy closed-only pre-alpha staging registration evidence fallback",
    stagingRequired: "Gate invocation only",
    netlifyScope: "Protected staging release job only; never injected into the site",
    safeFormat: "Path to downloaded closed-registration JSON evidence",
    defaultAllowed: "No",
    rotation: "Regenerate for each exact release SHA"
  }],
  ["EMPIRE_PRE_ALPHA_FINAL_REGISTRATION_MODE", {
    component: "Canonical pre-alpha staging final registration policy selector",
    stagingRequired: "Gate invocation only",
    netlifyScope: "Protected staging release job only; never injected into the site",
    safeFormat: "closed or open; defaults fail-closed to closed",
    defaultAllowed: "Yes; closed",
    rotation: "Set to open only for an explicitly approved time-limited staging window"
  }],
  ["EMPIRE_PRE_ALPHA_STAGING_FINAL_REGISTRATION_EVIDENCE_PATH", {
    component: "Canonical pre-alpha staging final registration evidence",
    stagingRequired: "Gate invocation only",
    netlifyScope: "Protected staging release job only; never injected into the site",
    safeFormat: "Path to exact-SHA automated final verdict JSON with the selected registration policy",
    defaultAllowed: "No",
    rotation: "Regenerate for each exact release SHA"
  }],
  ["EMPIRE_PRE_ALPHA_STAGING_FLY_APP", {
    component: "Protected staging Fly target pin",
    stagingRequired: "Staging deploy, remote gate and rollback",
    netlifyScope: "Protected staging release job only; never injected into the site",
    safeFormat: "Exact canonical empire-streets-staging-worker name equal to FLY_STAGING_APP",
    defaultAllowed: "Yes; immutable repository pin",
    rotation: "Change only with an audited staging worker replacement"
  }],
  ["EMPIRE_PRE_ALPHA_STAGING_REMOTE_APPROVED", {
    component: "Protected staging remote-mutation approval guard",
    stagingRequired: "Remote gate only",
    netlifyScope: "Protected staging release job only; never injected into the site",
    safeFormat: "Exact staging-only-remote-acceptance guard value",
    defaultAllowed: "No",
    rotation: "Set explicitly for each guarded remote invocation"
  }],
  ["EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_AFTER", {
    component: "Disposable staging fixture identity binding",
    stagingRequired: "Remote lifecycle suite only",
    safeFormat: "ISO-8601 lower creation-time bound generated for the current run",
    defaultAllowed: "No",
    rotation: "Regenerate for every disposable staging fixture"
  }],
  ["EMPIRE_REMOTE_STAGING_FIXTURE_CREATED_BEFORE", {
    component: "Disposable staging fixture identity binding",
    stagingRequired: "Remote lifecycle suite only",
    safeFormat: "ISO-8601 upper creation-time bound generated for the current run",
    defaultAllowed: "No",
    rotation: "Regenerate for every disposable staging fixture"
  }],
  ["EMPIRE_REMOTE_STAGING_FIXTURE_DISPLAY_PREFIX", {
    component: "Disposable staging fixture identity binding",
    stagingRequired: "Remote lifecycle suite only",
    safeFormat: "Canonical lifecycle display prefix ending in the run nonce hash prefix",
    defaultAllowed: "No",
    rotation: "Regenerate for every disposable staging fixture"
  }],
  ["EMPIRE_REMOTE_STAGING_RUN_NONCE_HASH", {
    component: "Disposable staging fixture identity binding",
    stagingRequired: "Remote lifecycle suite only",
    safeFormat: "64 lowercase hexadecimal SHA-256 nonce hash",
    defaultAllowed: "No",
    rotation: "Regenerate for every disposable staging fixture"
  }],
  ["EMPIRE_STAGING_NEON_BACKUP_EVIDENCE_PATH", {
    component: "Staging Neon snapshot binding evidence",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Repository-relative database-backup JSON artifact path",
    defaultAllowed: "No",
    rotation: "Regenerate for every exact staging release SHA"
  }],
  ["EMPIRE_STAGING_NEON_BINDING_EVIDENCE_PATH", {
    component: "Staging Neon provider target binding evidence",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Repository-relative hashed provider-binding JSON artifact path",
    defaultAllowed: "No",
    rotation: "Regenerate before every staging snapshot mutation"
  }],
  ["EMPIRE_STAGING_NEON_BRANCH_RESPONSE_PATH", {
    component: "Staging Neon provider target binding",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Ephemeral runner path to the provider branch response",
    defaultAllowed: "No",
    rotation: "Delete immediately after target verification"
  }],
  ["EMPIRE_STAGING_NEON_ENDPOINTS_RESPONSE_PATH", {
    component: "Staging Neon provider target binding",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Ephemeral runner path to the provider endpoint response",
    defaultAllowed: "No",
    rotation: "Delete immediately after target verification"
  }],
  ["EMPIRE_STAGING_NEON_SNAPSHOT_NAME", {
    component: "Staging Neon snapshot binding",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Generated staging snapshot name bound to the exact release SHA",
    defaultAllowed: "No",
    rotation: "Regenerate for every staging snapshot"
  }],
  ["EMPIRE_STAGING_NEON_SNAPSHOT_RESPONSE_PATH", {
    component: "Staging Neon snapshot binding",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Ephemeral runner path to the provider snapshot response",
    defaultAllowed: "No",
    rotation: "Delete immediately after snapshot verification"
  }],
  ["EVIDENCE_OUTPUT", {
    component: "CI staging release evidence assembly",
    stagingRequired: "CI release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Workflow-local artifact output directory",
    defaultAllowed: "No",
    rotation: "Use an isolated directory for each release run"
  }],
  ["LEAVE_REGISTRATION_OPEN", {
    component: "CI staging final registration policy",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Exact true only for an explicitly approved time-limited staging window",
    defaultAllowed: "No; the workflow defaults fail-closed",
    rotation: "Set independently for every staging acceptance dispatch"
  }],
  ["NEON_BRANCH_ID", {
    component: "Staging Neon workflow branch alias",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Exact protected staging branch ID",
    defaultAllowed: "No",
    rotation: "Change only after verified staging branch migration"
  }],
  ["NEON_PROJECT_ID", {
    component: "Staging Neon workflow project alias",
    stagingRequired: "Protected staging release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Exact protected staging project ID",
    defaultAllowed: "No",
    rotation: "Change only when replacing the staging database project"
  }],
  ["RELEASE_SHA", {
    component: "CI staging release workflow",
    stagingRequired: "CI release job only",
    netlifyScope: "Release job only; never injected into the site",
    safeFormat: "Exact 40-character lowercase Git commit SHA",
    defaultAllowed: "No",
    rotation: "Set to the immutable commit selected for each release run"
  }]
]);

const NON_RELEASE_VARIABLES = new Set([
  ...`
CI
DAY_NIGHT_BALANCE_REPORT
EMPIRE_ACCOUNT_REGISTRATION_KILL_SWITCH_E2E
EMPIRE_ACCOUNT_REGISTRATION_LIVE_E2E
EMPIRE_ADMIN_HOSTED_LIVE_E2E
EMPIRE_ALLOW_LIVE_POSTGRES_SMOKE
EMPIRE_BROWSER_PATH
EMPIRE_CAPTURE_UI_PARITY_BASELINE
EMPIRE_CLOSED_ALPHA_PREFLIGHT_STRICT
EMPIRE_ENABLE_BOUNTY_DEMO_TARGETS
EMPIRE_GAMEPLAY_SMOKE_STORAGE_STATE
EMPIRE_HOSTED_API_PORT
EMPIRE_HOSTED_BOOTSTRAP_GANG_NAME
EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON
EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER
EMPIRE_HOSTED_BOOTSTRAP_PASSWORD
EMPIRE_HOSTED_BOOTSTRAP_USERNAME
EMPIRE_HOSTED_BUILDING_ACTION_PHASE
EMPIRE_HOSTED_E2E_FIXTURES
EMPIRE_HOSTED_RUNTIME_AUTHORITY_ENABLED
EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON
EMPIRE_HOSTED_UI_PARITY_E2E
EMPIRE_KILL_SWITCH_PASSWORD
EMPIRE_KILL_SWITCH_USERNAME
EMPIRE_LOCAL_HOSTED_BROWSER_ARTIFACT_ROOT
EMPIRE_LOCAL_HOSTED_RUNTIME_OUT_DIR
EMPIRE_MANUAL_HOSTED_DISPLAY_NAME
EMPIRE_MANUAL_HOSTED_E2E
EMPIRE_MANUAL_HOSTED_STARTING_STATE_JSON
EMPIRE_NODE24_BIN
EMPIRE_PERSISTENCE_DIR
EMPIRE_PLAYER_ENTRY_LIVE_E2E
EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY
EMPIRE_PRODUCTION_AUTHORITY_PREFLIGHT_STRICT
EMPIRE_REGISTRATION_ONLY_PREFLIGHT_STRICT
EMPIRE_REMOTE_STAGING_ARTIFACT_ROOT
EMPIRE_RUNTIME_DEBUG
EMPIRE_TEST_DATABASE_URL
EMPIRE_UI_PARITY_ARTIFACT_ROOT
EMPIRE_UI_PARITY_NON_SPAWN_KEYS
EMPIRE_UI_PARITY_SERVER_ID
EMPIRE_UI_PARITY_SOCIAL_BATCH_KEYS
EMPIRE_VITE_HOSTED_API_ORIGIN
GAMEPLAY_PERSISTENCE_DIR
GITHUB_ACTIONS
GITHUB_ENV
PLAYWRIGHT_E2E_BASE_URL
PLAYWRIGHT_E2E_HEALTH_URL
PLAYWRIGHT_E2E_HOST
PLAYWRIGHT_E2E_PORT
PLAYWRIGHT_E2E_RESERVE_TIMEOUT_MS
PLAYWRIGHT_E2E_WEB_SERVER_COMMAND
PLAYWRIGHT_PORT
PLAYWRIGHT_SKIP_WEB_SERVER
PLAYWRIGHT_WORKERS
SIM_REPORT_DIR
SIM_SCENARIO
SIM_SEED
SIM_SEED_LIST
SITE_ID
URL
`.trim().split(/\s+/u),
  ...NON_RELEASE_TOOLING_ROWS.keys()
]);

const providerStagingRequirement = (variable) => {
  if (variable === "NETLIFY_PRODUCTION_SITE_ID") return "Yes as negative target pin";
  return variable.includes("PRODUCTION") ? "No" : "Yes";
};

const PROVIDER_ROWS = [
  ["NETLIFY_AUTH_TOKEN", "GitHub staging/production deploy job", "Yes", "Netlify personal or service token", "Rotate in Netlify; update protected GitHub environment secret"],
  ["NETLIFY_STAGING_SITE_ID", "GitHub staging deploy job", "No", "Isolated staging site ID", "Change only when replacing staging site"],
  ["NETLIFY_PRODUCTION_SITE_ID", "GitHub staging negative-target guard and production deploy job", "No", "Production site ID used as a fail-closed staging exclusion", "Change only during approved site cutover"],
  ["NEON_API_KEY", "GitHub backup release step", "Yes", "Least-privilege Neon API key", "Rotate in Neon; update protected GitHub environment secret"],
  ["NEON_STAGING_PROJECT_ID", "GitHub staging deploy and provider-binding guard", "No", "Staging-only Neon project ID verified against the provider response", "Change only when replacing staging database project"],
  ["NEON_PRODUCTION_PROJECT_ID", "GitHub production deploy job", "No", "Production-only Neon project ID", "Change only when replacing production database project"],
  ["NEON_STAGING_ROOT_BRANCH_ID", "GitHub staging deploy and provider-binding guard", "No", "Staging root branch ID verified against the provider response", "Change only after verified branch migration"],
  ["NEON_PRODUCTION_ROOT_BRANCH_ID", "GitHub production deploy job", "No", "Production root branch ID", "Change only after verified branch migration"],
  ["STAGING_DATABASE_URL_DIRECT", "Protected GitHub staging environment", "Yes", "Direct TLS URL for staging", "Rotate staging database role"],
  ["STAGING_DATABASE_URL_POOLED", "Protected GitHub staging environment", "Yes", "Pooled TLS URL for the same staging target", "Rotate staging Netlify database role"],
  ["PRODUCTION_DATABASE_URL_DIRECT", "Protected GitHub production environment", "Yes", "Direct TLS URL for production", "Rotate production database role"],
  ["PRODUCTION_DATABASE_URL_POOLED", "Protected GitHub production environment", "Yes", "Pooled TLS URL for the same production target", "Rotate production Netlify database role"],
  ["FLY_API_TOKEN", "GitHub worker deploy job", "Yes", "App-scoped Fly deploy token", "Rotate in Fly; update protected GitHub environment secret"],
  ["FLY_METRICS_TOKEN", "Protected GitHub staging load job", "Yes", "Read-only Fly org metrics token; FlyV1 or Bearer authorization value", "Rotate in Fly; update protected GitHub environment secret"],
  ["FLY_ORG_SLUG", "Protected GitHub staging load job", "No", "Exact lowercase Fly organization slug", "Change only when moving the worker app to another organization"],
  ["FLY_STAGING_APP", "GitHub staging deploy, acceptance and rollback jobs", "No", "Exact empire-streets-staging-worker app name", "Change only with the independent repository pin"],
  ["FLY_PRODUCTION_APP", "GitHub production deploy job", "No", "Dedicated production Fly app name", "Change only when replacing production worker app"],
  ["STAGING_ADMIN_INITIAL_PASSWORD", "One-time protected staging bootstrap", "Yes", "Strong generated temporary password", "Delete immediately after verified rotation"],
  ["PRODUCTION_ADMIN_INITIAL_PASSWORD", "One-time protected production bootstrap", "Yes", "Strong generated temporary password", "Delete immediately after verified rotation"],
  ["STAGING_ADMIN_PASSWORD", "Protected staging login verification", "Yes", "Rotated owner password", "Rotate in password manager and protected GitHub environment"],
  ["PRODUCTION_ADMIN_PASSWORD", "Protected production login verification", "Yes", "Rotated owner password", "Rotate in password manager and protected GitHub environment"],
  ["STAGING_GAMEPLAY_SESSION_SECRET", "Protected staging API and worker deploy", "Yes", "64 hex or safe base64url unique staging secret", "Rotate jointly and revoke staging gameplay sessions"],
  ["PRODUCTION_GAMEPLAY_SESSION_SECRET", "Protected production API and worker deploy", "Yes", "64 hex or safe base64url unique production secret", "Rotate jointly and revoke production gameplay sessions"],
  ["STAGING_GAMEPLAY_SNAPSHOT_SECRET", "Protected staging API and worker deploy", "Yes", "64 hex or safe base64url unique staging secret", "Rotate jointly and invalidate staging snapshot tokens"],
  ["PRODUCTION_GAMEPLAY_SNAPSHOT_SECRET", "Protected production API and worker deploy", "Yes", "64 hex or safe base64url unique production secret", "Rotate jointly and invalidate production snapshot tokens"],
  ["STAGING_ADMIN_FINGERPRINT_SECRET", "Protected staging API deploy", "Yes", "64 hex or safe base64url unique staging secret", "Rotate and invalidate staging admin fingerprints"],
  ["PRODUCTION_ADMIN_FINGERPRINT_SECRET", "Protected production API deploy", "Yes", "64 hex or safe base64url unique production secret", "Rotate and invalidate production admin fingerprints"],
  ["STAGING_ADMIN_SESSION_SECRET", "Protected staging API deploy", "Yes", "At least 32 bytes and unique from every other staging secret", "Rotate and revoke all staging admin sessions"],
  ["PRODUCTION_ADMIN_SESSION_SECRET", "Protected production API deploy", "Yes", "At least 32 bytes and unique from every other production secret", "Rotate and revoke all production admin sessions"],
  ["STAGING_AUTH_THROTTLE_PEPPER", "Protected staging API deploy", "Yes", "64 hex or safe base64url unique staging pepper", "Rotate during a controlled staging API deploy"],
  ["PRODUCTION_AUTH_THROTTLE_PEPPER", "Protected production API deploy", "Yes", "64 hex or safe base64url unique production pepper", "Rotate during a controlled production API deploy"],
  ["STAGING_ACCOUNT_TERMS_VERSION", "Protected staging release configuration", "No", "Approved immutable staging terms version", "Bump only with an approved terms change"],
  ["PRODUCTION_ACCOUNT_TERMS_VERSION", "Protected production release configuration", "No", "Approved immutable production terms version", "Bump only with an approved terms change"],
  ["STAGING_ADMIN_USERNAME", "Protected staging admin verification", "No", "Dedicated staging owner username", "Change only through an audited owner transition"],
  ["PRODUCTION_ADMIN_USERNAME", "Protected production admin verification", "No", "Dedicated production owner username", "Change only through an audited owner transition"],
  ["STAGING_ADMIN_DISPLAY_NAME", "One-time protected staging bootstrap", "No", "Non-secret staging owner display name", "Update through audited admin flow"],
  ["PRODUCTION_ADMIN_DISPLAY_NAME", "One-time protected production bootstrap", "No", "Non-secret production owner display name", "Update through audited admin flow"],
  ["PRODUCTION_SMOKE_ACCOUNT_USERNAME", "Protected production smoke job", "No", "Dedicated synthetic control account username", "Retain or replace through the guarded bootstrap job"],
  ["PRODUCTION_SMOKE_ACCOUNT_GANG_NAME", "Protected production smoke job", "No", "Dedicated synthetic control gang name", "Change only with an approved smoke account replacement"],
  ["PRODUCTION_SMOKE_ACCOUNT_PASSWORD", "Protected production smoke job", "Yes", "Strong password-manager value", "Rotate after cutover and update the protected GitHub environment secret"]
].map(([variable, component, secret, safeFormat, rotation]) => ({
  variable,
  component,
  stagingRequired: providerStagingRequirement(variable),
  productionRequired: variable.includes("STAGING") || variable === "FLY_METRICS_TOKEN" || variable === "FLY_ORG_SLUG" ? "No" : "Yes",
  secret,
  netlifyScope: "Never injected into site runtime",
  workerScope: "Never injected unless explicitly mapped to a runtime variable",
  safeFormat,
  defaultAllowed: "No",
  rotation
}));

export const inventoryEnvironmentReads = ({ root = process.cwd(), trackedFiles } = {}) => {
  const files = trackedFiles ?? listTrackedFiles(root);
  const byVariable = new Map();
  const dynamicLocations = [];
  for (const relativePath of files.filter((file) => SOURCE_EXTENSION_PATTERN.test(file))) {
    const content = readFileSync(path.join(root, relativePath), "utf8");
    for (const pattern of STATIC_READ_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of content.matchAll(pattern)) {
        const variable = match[1];
        const location = `${relativePath}:${lineNumberAt(content, match.index)}`;
        const locations = byVariable.get(variable) ?? new Set();
        locations.add(location);
        byVariable.set(variable, locations);
      }
    }
    DYNAMIC_READ_PATTERN.lastIndex = 0;
    for (const match of content.matchAll(DYNAMIC_READ_PATTERN)) {
      dynamicLocations.push(`${relativePath}:${lineNumberAt(content, match.index)}`);
    }
  }
  return {
    reads: [...byVariable].sort(([left], [right]) => left.localeCompare(right)).map(([variable, locations]) => ({
      variable,
      locations: [...locations].sort()
    })),
    dynamicLocations: [...new Set(dynamicLocations)].sort()
  };
};

export const createEnvironmentMatrix = (inventory) => {
  const publicByName = new Map(PUBLIC_RELEASE_ROWS.map((row) => [row.variable, row]));
  const providerByName = new Map(PROVIDER_ROWS.map((row) => [row.variable, row]));
  const unknown = inventory.reads
    .map(({ variable }) => variable)
    .filter((variable) => !publicByName.has(variable)
      && !providerByName.has(variable)
      && !NON_RELEASE_VARIABLES.has(variable));
  if (unknown.length > 0) {
    throw new Error(`Unclassified environment reads: ${unknown.join(", ")}`);
  }
  const nonReleaseRows = inventory.reads
    .filter(({ variable }) => NON_RELEASE_VARIABLES.has(variable))
    .map(({ variable }) => nonReleaseRow(variable));
  return {
    publicRows: [...PUBLIC_RELEASE_ROWS].sort(sortRows),
    providerRows: [...PROVIDER_ROWS].sort(sortRows),
    nonReleaseRows: nonReleaseRows.sort(sortRows),
    inventory
  };
};

export const renderEnvironmentMatrix = (matrix, { generatedAt = "generated from tracked source" } = {}) => {
  const lines = [
    "# Empire Streets environment matrix",
    "",
    `Generated: ${generatedAt}`,
    "",
    `The inventory found **${matrix.inventory.reads.length} statically named environment reads** in tracked JavaScript and TypeScript source. Every read is classified below. ${matrix.inventory.dynamicLocations.length} dynamic lookup site(s) are listed in the generated inventory artifact and must remain covered by explicit validator keys.`,
    "",
    "Public releases fail closed: no wildcard origin, no loopback URL, no staging hostname in production, no implicit database or secret default, and no provider credential in a runtime scope.",
    "",
    "## Public runtime and release variables",
    "",
    table(matrix.publicRows),
    "",
    "## Provider and protected GitHub environment variables",
    "",
    "Provider credentials exist only in protected GitHub environments and release steps. Deploy previews receive none of these secrets.",
    "",
    table(matrix.providerRows),
    "",
    "## Local, test, simulation and CI-only reads",
    "",
    "These values are forbidden as public-runtime dependencies. Secret-like test values are ephemeral and must never reuse staging or production secrets.",
    "",
    table(matrix.nonReleaseRows),
    "",
    "## Secret separation and generation",
    "",
    "Generate each of the five runtime secrets independently with a cryptographically secure generator, for example `node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\"`. Never use `Math.random`.",
    "",
    "`GAMEPLAY_SLICE_SESSION_SECRET`, `GAMEPLAY_SLICE_SNAPSHOT_SECRET`, `EMPIRE_ADMIN_FINGERPRINT_SECRET`, `EMPIRE_ADMIN_SESSION_SECRET`, and `EMPIRE_AUTH_THROTTLE_PEPPER` must all differ. `EMPIRE_ADMIN_SESSION_SECRET` is required in staging and production, contains at least 32 bytes, and is encoded as 64 hex or safe base64url.",
    "",
    "## Scope rules",
    "",
    "- Netlify Functions use pooled database URLs; the persistent worker and migration job use direct URLs.",
    "- Direct and pooled URLs must resolve to the same provider project, branch, database and schema version.",
    "- Netlify deploy previews use an isolated test branch/database or have no state-changing backend. Production credentials are never exposed to previews or untrusted pull requests.",
    "- Bootstrap passwords are one-time release inputs. Remove the temporary bootstrap password immediately after successful login verification and rotation.",
    "- Runtime secrets are configured through provider UI, CLI or API, never in `netlify.toml`, `.env.example`, artifacts or logs.",
    ""
  ];
  return lines.join("\n");
};

export const createEnvironmentInventoryArtifact = (matrix, options = {}) => ({
  generatedAt: options.generatedAt ?? new Date().toISOString(),
  source: "tracked JavaScript and TypeScript files",
  staticReadCount: matrix.inventory.reads.length,
  dynamicLookupCount: matrix.inventory.dynamicLocations.length,
  reads: matrix.inventory.reads,
  dynamicLocations: matrix.inventory.dynamicLocations,
  publicVariables: matrix.publicRows.map(({ variable }) => variable),
  providerVariables: matrix.providerRows.map(({ variable }) => variable),
  nonReleaseVariables: matrix.nonReleaseRows.map(({ variable }) => variable)
});

const listTrackedFiles = (root) => {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`git ls-files failed: ${String(result.stderr).trim()}`);
  return result.stdout.split("\0").filter(Boolean).map((file) => file.replace(/\\/gu, "/"));
};

const lineNumberAt = (content, index) => content.slice(0, index).split(/\r?\n/u).length;
const sortRows = (left, right) => left.variable.localeCompare(right.variable);
const isSecretLike = (variable) => /(?:PASSWORD|SECRET|PEPPER|DATABASE_URL|STORAGE_STATE)/u.test(variable);
const nonReleaseRow = (variable) => ({
  variable,
  component: inferNonReleaseComponent(variable),
  stagingRequired: "No",
  productionRequired: "No",
  secret: isSecretLike(variable) ? "Test secret" : "No",
  netlifyScope: "None",
  workerScope: "None",
  safeFormat: "Local, CI or test-specific value",
  defaultAllowed: "Yes outside public runtime",
  rotation: isSecretLike(variable) ? "Discard after the test run; never reuse a public secret" : "N/A",
  ...NON_RELEASE_TOOLING_ROWS.get(variable)
});
const inferNonReleaseComponent = (variable) => {
  if (/PLAYWRIGHT|E2E|UI_PARITY|SMOKE|KILL_SWITCH/u.test(variable)) return "Browser and hosted acceptance tests";
  if (/SIM_|BALANCE_REPORT/u.test(variable)) return "Simulation tooling";
  if (/PERSISTENCE_DIR|TEST_DATABASE|ALLOW_LIVE_POSTGRES/u.test(variable)) return "Local persistence tests";
  if (/GITHUB|^CI$|^SITE_ID$|^URL$/u.test(variable)) return "CI platform tooling";
  return "Local development or verification tooling";
};
const escapeCell = (value) => String(value).replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ");
const table = (rows) => [
  "| Variable | Component | Staging required | Production required | Secret | Netlify scope | Worker scope | Safe format | Default allowed | Rotation instructions |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${[
    `\`${row.variable}\``, row.component, row.stagingRequired, row.productionRequired, row.secret,
    row.netlifyScope, row.workerScope, row.safeFormat, row.defaultAllowed, row.rotation
  ].map(escapeCell).join(" | ")} |`)
].join("\n");
