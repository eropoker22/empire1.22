process.env.EMPIRE_PLAYER_ENTRY_LIVE_E2E = "1";
process.env.PLAYWRIGHT_PORT ||= "5173";
process.env.PLAYWRIGHT_SKIP_WEB_SERVER = "1";
process.argv.splice(2, process.argv.length - 2, "tests/e2e/player-entry-postgres-live.spec.js");

await import("./run-playwright-e2e-smoke.mjs");
