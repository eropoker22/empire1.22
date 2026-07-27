process.loadEnvFile?.(".env.local");

process.env.EMPIRE_ACCOUNT_REGISTRATION_LIVE_E2E = "1";
process.env.PLAYWRIGHT_PORT ||= "5175";
const publicOrigin = `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT}`;
process.env.NODE_ENV = "production";
process.env.EMPIRE_PUBLIC_ORIGIN = publicOrigin;
process.env.EMPIRE_ALLOWED_ORIGINS = publicOrigin;
process.env.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED = "true";
delete process.env.PLAYWRIGHT_SKIP_WEB_SERVER;
process.argv.splice(2, process.argv.length - 2, "tests/e2e/account-registration-postgres-live.spec.js");

await import("./run-playwright-e2e-smoke.mjs");
