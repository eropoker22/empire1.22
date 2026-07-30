import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSupportedNodeVersion } from "./supported-node-policy.mjs";
import { assertSafeLocalHostedTestDatabase } from "./local-hosted/database-safety.mjs";
import {
  createRunDirectory,
  delay,
  runManagedCommand,
  startManagedProcess,
  stopProcessTree,
  stopManagedProcesses,
  waitForHttp
} from "./local-hosted/process-supervisor.mjs";
import {
  createLocalHostedAdminClient,
  provisionDisposableHostedServer,
  startDisposableHostedServer,
  stopDisposableHostedServer,
  stopStaleDisposableHostedServers
} from "./local-hosted/admin-fixture-client.mjs";
import { HOSTED_E2E_STARTING_PLAYER_STATE } from "./local-hosted/hosted-e2e-starting-player-state.mjs";

process.loadEnvFile?.(".env.local");
assertSupportedNodeVersion(process.versions.node);

const frontendPort = 4174;
const apiPort = 8788;
const workerPort = 8081;
const browserOrigin = `http://127.0.0.1:${frontendPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const workerOrigin = `http://127.0.0.1:${workerPort}`;
const hostedSuites = Object.freeze([
  Object.freeze({
    name: "city-events",
    specs: Object.freeze(["tests/e2e/live-city-events.spec.js"])
  }),
  Object.freeze({
    name: "ui-parity",
    specs: Object.freeze(["tests/e2e/live-demo-ui-parity.spec.js"])
  }),
  Object.freeze({
    name: "district-selection-race",
    specs: Object.freeze(["tests/e2e/live-district-selection-race.spec.js"])
  }),
  Object.freeze({
    name: "production-pharmacy",
    specs: Object.freeze(["tests/e2e/live-production-pharmacy.spec.js"])
  }),
  Object.freeze({
    name: "production-drug-lab",
    specs: Object.freeze(["tests/e2e/live-production-drug-lab.spec.js"])
  }),
  Object.freeze({
    name: "production-factory",
    specs: Object.freeze(["tests/e2e/live-production-factory.spec.js"])
  }),
  Object.freeze({
    name: "production-armory",
    specs: Object.freeze(["tests/e2e/live-production-armory.spec.js"])
  }),
  Object.freeze({
    name: "income",
    restartWorkerBeforeSpec: true,
    specs: Object.freeze(["tests/e2e/live-hosted-income.spec.js"])
  }),
  Object.freeze({
    name: "building-actions-day",
    scenario: "building-actions-day",
    buildingActionPhase: "day",
    specs: Object.freeze(["tests/e2e/live-hosted-building-actions.spec.js"])
  }),
  Object.freeze({
    name: "building-actions-night",
    scenario: "building-actions-night",
    buildingActionPhase: "night",
    specs: Object.freeze(["tests/e2e/live-hosted-building-actions.spec.js"])
  }),
  Object.freeze({
    name: "multiplayer-core",
    scenario: "multiplayer-core",
    playerCount: 3,
    identityPrefix: "HostedCore",
    specs: Object.freeze(["tests/e2e/live-hosted-multiplayer-core.spec.js"])
  }),
  Object.freeze({
    name: "lifecycle-stop",
    playerCount: 1,
    identityPrefix: "HostedLifecycle",
    lifecycleStop: true,
    specs: Object.freeze(["tests/e2e/live-hosted-lifecycle-stop.spec.js"])
  })
]);
const requestedSuiteNames = new Set(
  process.argv
    .filter((argument) => argument.startsWith("--suite="))
    .flatMap((argument) => argument.slice("--suite=".length).split(","))
    .map((name) => name.trim())
    .filter(Boolean)
);
const selectedSuites = requestedSuiteNames.size
  ? hostedSuites.filter((suite) => requestedSuiteNames.has(suite.name))
  : hostedSuites;
if (selectedSuites.length === 0 || selectedSuites.length !== requestedSuiteNames.size) {
  const available = hostedSuites.map((suite) => suite.name).join(", ");
  throw new Error(`Unknown local hosted suite. Available suites: ${available}.`);
}
const runtimeDatabaseUrl = String(process.env.EMPIRE_DATABASE_URL || "");
const testDatabaseUrl = String(process.env.EMPIRE_TEST_DATABASE_URL || "");
const databaseSummary = assertSafeLocalHostedTestDatabase({
  runtimeDatabaseUrl,
  testDatabaseUrl,
  nodeEnv: process.env.NODE_ENV
});
const buildSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!/^[0-9a-f]{40}$/u.test(buildSha)) throw new Error("Local hosted gate requires an exact Git SHA.");

const runDirectory = await createRunDirectory();
const processes = [];
let admin = null;
const suiteResults = [];
let succeeded = false;
let failure = null;
let staleServerCleanup = null;
const environment = {
  ...process.env,
  NODE_ENV: "development",
  EMPIRE_DATABASE_URL: testDatabaseUrl,
  EMPIRE_TEST_DATABASE_URL: testDatabaseUrl,
  GAMEPLAY_DATABASE_URL: testDatabaseUrl,
  EMPIRE_PERSISTENCE_DRIVER: "postgres",
  GAMEPLAY_PERSISTENCE_DRIVER: "postgres",
  EMPIRE_BUILD_SHA: buildSha,
  EMPIRE_PUBLIC_ORIGIN: browserOrigin,
  EMPIRE_ALLOWED_ORIGINS: browserOrigin,
  EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: "true",
  EMPIRE_ADMIN_WRITES_ENABLED: "true",
  EMPIRE_HOSTED_CONTROL_PLANE_ENABLED: "true",
  EMPIRE_SERVER_PROVISIONING_ENABLED: "true",
  EMPIRE_LEGACY_MATCHMAKING_ENABLED: "false",
  EMPIRE_HOSTED_PREFLIGHT_STRICT: "true",
  EMPIRE_HOSTED_API_PORT: String(apiPort),
  EMPIRE_HOSTED_WORKER_ID: `local-e2e-worker-${process.pid}`,
  EMPIRE_HOSTED_WORKER_REGION: "eu-central",
  EMPIRE_RELEASE_ENVIRONMENT: "local-e2e",
  EMPIRE_VITE_HOSTED_API_ORIGIN: apiOrigin,
  PORT: String(workerPort),
  PLAYWRIGHT_PORT: String(frontendPort),
  PLAYWRIGHT_SKIP_WEB_SERVER: "1",
  EMPIRE_HOSTED_UI_PARITY_E2E: "1",
  EMPIRE_CAPTURE_UI_PARITY_BASELINE: "1",
  EMPIRE_UI_PARITY_ARTIFACT_ROOT: path.join(runDirectory, "ui-parity"),
  EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON: JSON.stringify(HOSTED_E2E_STARTING_PLAYER_STATE)
};

const runNode = (name, args, timeoutMs) => runManagedCommand({
  name,
  args,
  environment,
  logDirectory: runDirectory,
  timeoutMs
});
const runFixtureNode = (name, args, timeoutMs) => runManagedCommand({
  name,
  args,
  environment: {
    ...environment,
    NODE_ENV: "test",
    EMPIRE_HOSTED_E2E_FIXTURES: "1"
  },
  logDirectory: runDirectory,
  timeoutMs
});

try {
  console.log("[local-hosted] Safe isolated test database: yes.");
  console.log(`[local-hosted] Database host: loopback; database marker: ${databaseSummary.databaseName.includes("e2e") ? "e2e" : "test"}.`);
  await runNode("migrations", [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    "scripts/database-migrations.ts",
    "--controlled-snapshot-recovery"
  ], 600_000);
  await runNode("admin-bootstrap", [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    "scripts/bootstrap-admin-user.ts"
  ], 300_000);
  await runNode("browser-config", [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    "scripts/generate-browser-gameplay-config.ts"
  ], 300_000);
  await runNode("client-bundle", [
    "scripts/run-local-bin.mjs",
    "vite/bin/vite.js",
    "build",
    "--config",
    "vite.client-page.config.ts"
  ], 300_000);

  const api = startManagedProcess({
    name: "hosted-api",
    args: [
      "scripts/run-local-bin.mjs",
      "vite-node/vite-node.mjs",
      "apps/server/src/bootstrap/hosted-dev-http-cli.ts"
    ],
    environment,
    logDirectory: runDirectory
  });
  processes.push(api);
  let worker = startManagedProcess({
    name: "hosted-worker",
    args: [
      "scripts/run-local-bin.mjs",
      "vite-node/vite-node.mjs",
      "apps/server/src/bootstrap/hosted-runtime-worker-cli.ts"
    ],
    environment,
    logDirectory: runDirectory
  });
  processes.push(worker);
  const frontend = startManagedProcess({
    name: "frontend",
    args: [
      "scripts/run-local-bin.mjs",
      "vite/bin/vite.js",
      "--config",
      "vite.game.config.ts",
      "--host",
      "127.0.0.1",
      "--port",
      String(frontendPort)
    ],
    environment,
    logDirectory: runDirectory
  });
  processes.push(frontend);

  await Promise.all([
    waitForHttp(`${apiOrigin}/api/health`, { processRef: api, timeoutMs: 180_000 }),
    waitForHttp(`${workerOrigin}/health`, { processRef: worker, timeoutMs: 180_000 }),
    waitForHttp(`${browserOrigin}/api/servers`, { processRef: frontend, timeoutMs: 180_000 })
  ]);

  admin = await createLocalHostedAdminClient({
    apiOrigin,
    browserOrigin,
    username: environment.EMPIRE_ADMIN_BOOTSTRAP_USERNAME,
    password: environment.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD
  });
  staleServerCleanup = await stopStaleDisposableHostedServers(admin);
  console.log(`[local-hosted] Stale disposable servers stopped: ${staleServerCleanup.stopped}.`);
  for (const suite of selectedSuites) {
    const result = {
      name: suite.name,
      specs: suite.specs,
      serverInstanceId: null,
      status: "provisioning",
      cleanup: "not-started",
      workerRestart: suite.restartWorkerBeforeSpec ? "pending" : "not-requested",
      failure: null
    };
    suiteResults.push(result);
    try {
      delete environment.EMPIRE_HOSTED_BOOTSTRAP_USERNAME;
      delete environment.EMPIRE_HOSTED_BOOTSTRAP_GANG_NAME;
      delete environment.EMPIRE_HOSTED_BOOTSTRAP_PASSWORD;
      delete environment.EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER;
      delete environment.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON;
      delete environment.EMPIRE_HOSTED_BUILDING_ACTION_PHASE;
      delete environment.EMPIRE_ADMIN_HOSTED_LIVE_E2E;
      if (suite.buildingActionPhase) {
        const identitySuffix = randomBytes(6).toString("hex");
        environment.EMPIRE_HOSTED_BOOTSTRAP_USERNAME = `HostedAction${identitySuffix}`;
        environment.EMPIRE_HOSTED_BOOTSTRAP_GANG_NAME = `Hosted Action Crew ${identitySuffix}`;
        environment.EMPIRE_HOSTED_BOOTSTRAP_PASSWORD = randomBytes(24).toString("base64url");
        environment.EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER = `2001:db8::${randomBytes(8).toString("hex")}`;
        environment.EMPIRE_HOSTED_BUILDING_ACTION_PHASE = suite.buildingActionPhase;
      }
      if (suite.playerCount) {
        environment.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON = JSON.stringify(
          Array.from({ length: suite.playerCount }, (_, index) => {
            const identitySuffix = randomBytes(6).toString("hex");
            const role = String.fromCharCode(65 + index);
            return {
              username: `${suite.identityPrefix}${role}${identitySuffix}`,
              gangName: `${suite.identityPrefix} ${role} Crew ${identitySuffix}`,
              password: randomBytes(24).toString("base64url"),
              networkIdentifier: `2001:db8::${randomBytes(8).toString("hex")}`
            };
          })
        );
      }
      if (suite.lifecycleStop) {
        environment.EMPIRE_ADMIN_HOSTED_LIVE_E2E = "1";
      }
      const server = await provisionDisposableHostedServer(admin, {
        displayNamePrefix: `Local Hosted ${suite.name}`,
        startingPlayerState: HOSTED_E2E_STARTING_PLAYER_STATE,
        onCreated: (created) => {
          result.serverInstanceId = created.serverInstanceId;
        }
      });
      result.serverInstanceId = server.serverInstanceId;
      result.status = "testing";
      environment.EMPIRE_UI_PARITY_SERVER_ID = server.serverInstanceId;
      await writeFile(
        path.join(runDirectory, `${suite.name}-server-id.txt`),
        `${server.serverInstanceId}\n`,
        "utf8"
      );
      result.status = "bootstrapping-player";
      await runNode(`playwright-${suite.name}-bootstrap`, [
        "scripts/run-local-bin.mjs",
        "playwright/cli.js",
        "test",
        "tests/e2e/local-hosted-bootstrap-player.spec.js"
      ], 600_000);
      const scenario = suite.scenario || (suite.name === "city-events" ? "city-events" : "");
      if (scenario) {
        result.status = "seeding-scenario";
        await runFixtureNode(`seed-${suite.name}`, [
          "scripts/run-local-bin.mjs",
          "vite-node/vite-node.mjs",
          "tools/seed/hosted-e2e-scenario.mjs",
          `--server=${server.serverInstanceId}`,
          `--scenario=${scenario}`
        ], 120_000);
      }
      result.status = "starting-server";
      await startDisposableHostedServer(admin, server.serverInstanceId);
      if (suite.restartWorkerBeforeSpec) {
        result.status = "restarting-worker";
        stopProcessTree(worker.child);
        await Promise.race([worker.exited, delay(10_000)]);
        await worker.saveLog();
        worker = startManagedProcess({
          name: `hosted-worker-${suite.name}-restart`,
          args: [
            "scripts/run-local-bin.mjs",
            "vite-node/vite-node.mjs",
            "apps/server/src/bootstrap/hosted-runtime-worker-cli.ts"
          ],
          environment,
          logDirectory: runDirectory
        });
        processes.push(worker);
        const workerHealthResponse = await waitForHttp(`${workerOrigin}/health`, {
          processRef: worker,
          timeoutMs: 180_000
        });
        const workerHealth = await workerHealthResponse.json();
        if (workerHealth?.status !== "ok" || workerHealth?.heartbeat?.registered !== true) {
          throw new Error("Restarted hosted worker did not register a healthy heartbeat.");
        }
        result.workerRestart = "passed";
      }
      await runNode(`playwright-${suite.name}`, [
        "scripts/run-local-bin.mjs",
        "playwright/cli.js",
        "test",
        ...suite.specs
      ], 1_800_000);
      result.status = "passed";
      result.cleanup = "stopping";
      await stopDisposableHostedServer(admin, server.serverInstanceId);
      result.cleanup = "stopped";
    } catch (error) {
      result.status = "failed";
      result.cleanup = result.serverInstanceId ? "preserved-for-diagnostics" : "not-created";
      result.failure = error instanceof Error ? error.message : String(error);
    }
  }
  const failedSuites = suiteResults.filter((result) => result.status === "failed");
  if (failedSuites.length) {
    throw new Error(
      `Local hosted suites failed: ${failedSuites.map((result) => result.name).join(", ")}.`
    );
  }
  succeeded = true;
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  console.error(`[local-hosted] ${failure}`);
} finally {
  await writeFile(path.join(runDirectory, "summary.json"), JSON.stringify({
    buildSha,
    database: {
      host: "loopback",
      marker: databaseSummary.databaseName.includes("e2e") ? "e2e" : "test"
    },
    staleServerCleanup,
    serverInstanceId: suiteResults.find((result) => result.status === "failed")?.serverInstanceId
      || suiteResults.at(-1)?.serverInstanceId
      || null,
    suites: suiteResults,
    succeeded,
    failure
  }, null, 2), "utf8");
  await stopManagedProcesses(processes);
}

console.log(`[local-hosted] Artifacts: ${runDirectory}`);
process.exitCode = succeeded ? 0 : 1;
