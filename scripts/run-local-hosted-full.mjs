import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
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
import {
  parseUiParityDebugBuildingTypes,
  UI_PARITY_DEBUG_BUILDING_TYPES_ENV
} from "../tests/e2e/helpers/uiParityDebugBuildingFilter.js";

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
    name: "manual-admin-player",
    gameplayInteraction: "visible-browser-ui",
    manualProvisioning: true,
    specs: Object.freeze(["tests/e2e/manual-hosted-admin-player-flow.spec.js"])
  }),
  Object.freeze({
    name: "city-events",
    gameplayInteraction: "visible-browser-ui",
    specs: Object.freeze(["tests/e2e/live-city-events.spec.js"])
  }),
  Object.freeze({
    name: "ui-parity",
    gameplayInteraction: "visible-browser-opening-and-observation",
    playwrightGroups: Object.freeze([
      Object.freeze({
        name: "shared-surfaces",
        grep: "canonical building parity coverage contract|live/demo shared presentation parity"
      }),
      Object.freeze({
        name: "spawn-building-matrix",
        grep: "live/demo spawn-reachable canonical building matrix"
      }),
      Object.freeze({
        name: "utility-modals",
        grep: "live/demo utility modal parity"
      })
    ]),
    specs: Object.freeze([
      "tests/e2e/live-demo-ui-parity.spec.js",
      "tests/e2e/live-demo-utility-modal-parity.spec.js"
    ])
  }),
  Object.freeze({
    name: "ui-parity-social",
    gameplayInteraction: "visible-browser-opening-and-observation",
    specs: Object.freeze(["tests/e2e/live-demo-social-modal-parity.spec.js"])
  }),
  Object.freeze({
    name: "district-selection-race",
    gameplayInteraction: "browser-runtime-api-and-visible-opening-observation",
    specs: Object.freeze(["tests/e2e/live-district-selection-race.spec.js"])
  }),
  Object.freeze({
    name: "production-pharmacy",
    gameplayInteraction: "visible-browser-ui",
    startingPlayerState: createProductionStartingPlayerState("chemicals"),
    specs: Object.freeze(["tests/e2e/live-production-pharmacy.spec.js"])
  }),
  Object.freeze({
    name: "production-drug-lab",
    gameplayInteraction: "visible-browser-ui",
    startingPlayerState: createProductionStartingPlayerState("neon-dust"),
    specs: Object.freeze(["tests/e2e/live-production-drug-lab.spec.js"])
  }),
  Object.freeze({
    name: "production-factory",
    gameplayInteraction: "visible-browser-ui",
    startingPlayerState: createProductionStartingPlayerState("metal-parts"),
    specs: Object.freeze(["tests/e2e/live-production-factory.spec.js"])
  }),
  Object.freeze({
    name: "production-armory",
    gameplayInteraction: "visible-browser-ui",
    startingPlayerState: createProductionStartingPlayerState("baseball-bat"),
    specs: Object.freeze(["tests/e2e/live-production-armory.spec.js"])
  }),
  Object.freeze({
    name: "income",
    gameplayInteraction: "browser-authoritative-state-observation",
    restartWorkerBeforeSpec: true,
    specs: Object.freeze(["tests/e2e/live-hosted-income.spec.js"])
  }),
  Object.freeze({
    name: "building-actions-day",
    gameplayInteraction: "direct-authoritative-api",
    scenario: "building-actions-day",
    buildingActionPhase: "day",
    specs: Object.freeze(["tests/e2e/live-hosted-building-actions.spec.js"])
  }),
  Object.freeze({
    name: "building-actions-night",
    gameplayInteraction: "direct-authoritative-api",
    scenario: "building-actions-night",
    buildingActionPhase: "night",
    specs: Object.freeze(["tests/e2e/live-hosted-building-actions.spec.js"])
  }),
  Object.freeze({
    name: "building-actions-visible-ui-day",
    gameplayInteraction: "visible-browser-ui",
    scenario: "building-actions-day",
    buildingActionPhase: "day",
    specs: Object.freeze(["tests/e2e/live-hosted-building-actions-visible-ui.spec.js"])
  }),
  Object.freeze({
    name: "building-actions-visible-ui-night",
    gameplayInteraction: "visible-browser-ui",
    scenario: "building-actions-night",
    buildingActionPhase: "night",
    specs: Object.freeze(["tests/e2e/live-hosted-building-actions-visible-ui.spec.js"])
  }),
  Object.freeze({
    name: "ui-parity-non-spawn",
    gameplayInteraction: "visible-browser-opening-and-observation",
    scenario: "building-parity-non-spawn",
    bootstrapIdentityPrefix: "HostedNonSpawnParity",
    specs: Object.freeze(["tests/e2e/live-hosted-non-spawn-building-parity.spec.js"])
  }),
  Object.freeze({
    name: "multiplayer-core",
    gameplayInteraction: "direct-authoritative-api",
    scenario: "multiplayer-core",
    playerCount: 3,
    identityPrefix: "HostedCore",
    specs: Object.freeze(["tests/e2e/live-hosted-multiplayer-core.spec.js"])
  }),
  Object.freeze({
    name: "multiplayer-visible-actions",
    gameplayInteraction: "mixed-visible-browser-ui-and-parity-observation",
    scenario: "multiplayer-core",
    playerCount: 3,
    identityPrefix: "HostedVisible",
    specs: Object.freeze([
      "tests/e2e/manual-hosted-district-actions-ui.spec.js",
      "tests/e2e/live-demo-district-action-overlay-parity.spec.js"
    ])
  }),
  Object.freeze({
    name: "social-visible-ui",
    gameplayInteraction: "visible-browser-ui",
    scenario: "multiplayer-core",
    playerCount: 3,
    identityPrefix: "HostedSocial",
    specs: Object.freeze(["tests/e2e/live-hosted-social-visible-ui.spec.js"])
  }),
  Object.freeze({
    name: "lifecycle-stop",
    gameplayInteraction: "mixed-visible-admin-ui-and-direct-authoritative-api",
    playerCount: 1,
    identityPrefix: "HostedLifecycle",
    lifecycleStop: true,
    specs: Object.freeze(["tests/e2e/live-hosted-lifecycle-stop.spec.js"])
  })
]);
const MANUAL_HOSTED_MATERIAL_OVERRIDES = Object.freeze({
  chemicals: 7,
  "stim-pack": 0,
  "neon-dust": 3,
  "metal-parts": 4,
  "baseball-bat": 5
});
const MANUAL_HOSTED_STARTING_PLAYER_STATE = Object.freeze({
  cleanCash: 123_456,
  dirtyCash: 23_456,
  population: 345,
  spySlots: 2,
  materials: Object.freeze(Object.fromEntries(
    Object.keys(HOSTED_E2E_STARTING_PLAYER_STATE.materials)
      .map((materialId, index) => [
        materialId,
        MANUAL_HOSTED_MATERIAL_OVERRIDES[materialId] ?? index * 11
      ])
  ))
});
function createProductionStartingPlayerState(outputResourceKey) {
  return Object.freeze({
    ...HOSTED_E2E_STARTING_PLAYER_STATE,
    materials: Object.freeze({
      ...HOSTED_E2E_STARTING_PLAYER_STATE.materials,
      [outputResourceKey]: 0
    })
  });
}
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
const uiParityDebugBuildingTypeIds = parseUiParityDebugBuildingTypes(
  process.env[UI_PARITY_DEBUG_BUILDING_TYPES_ENV]
);
if (
  uiParityDebugBuildingTypeIds.length > 0
  && (selectedSuites.length !== 1 || selectedSuites[0]?.name !== "ui-parity")
) {
  throw new Error(
    `${UI_PARITY_DEBUG_BUILDING_TYPES_ENV} is debug-only and requires --suite=ui-parity as the only suite.`
  );
}
if (uiParityDebugBuildingTypeIds.length > 0) {
  console.warn(
    `[local-hosted] DEBUG-ONLY building parity filter: ${uiParityDebugBuildingTypeIds.join(", ")}. This is not a comprehensive parity gate.`
  );
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
const browserArtifactRoot = String(
  process.env.EMPIRE_LOCAL_HOSTED_BROWSER_ARTIFACT_ROOT || ""
).trim();
const browserArtifactRunDirectory = browserArtifactRoot
  ? await createRunDirectory(browserArtifactRoot)
  : runDirectory;
const runtimeBundleDirectory = path.join(runDirectory, "runtime-bundle");
const hostedApiBundlePath = path.join(runtimeBundleDirectory, "hosted-dev-http.mjs");
const hostedWorkerBundlePath = path.join(runtimeBundleDirectory, "hosted-runtime-worker.mjs");
const hostedE2eScenarioBundlePath = path.join(runtimeBundleDirectory, "hosted-e2e-scenario.mjs");
const databaseMigrationsBundlePath = path.join(runtimeBundleDirectory, "database-migrations.mjs");
const adminBootstrapBundlePath = path.join(runtimeBundleDirectory, "bootstrap-admin-user.mjs");
const browserConfigBundlePath = path.join(runtimeBundleDirectory, "generate-browser-gameplay-config.mjs");
let sourceBuildInputHash = null;
const processes = [];
let admin = null;
const suiteResults = [];
let assetManifest = null;
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
  EMPIRE_UI_PARITY_ARTIFACT_ROOT: path.join(browserArtifactRunDirectory, "ui-parity"),
  EMPIRE_LOCAL_HOSTED_RUNTIME_OUT_DIR: runtimeBundleDirectory,
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
const retainPlaywrightArtifacts = (result, phase) => {
  const outputDirectory = path.join(browserArtifactRunDirectory, "playwright", result.name, phase);
  result.evidence.playwrightArtifactDirectories.push(
    path.relative(process.cwd(), outputDirectory)
  );
  return outputDirectory;
};

try {
  console.log("[local-hosted] Safe isolated test database: yes.");
  console.log(`[local-hosted] Database host: loopback; database marker: ${databaseSummary.databaseName.includes("e2e") ? "e2e" : "test"}.`);
  await runNode("hosted-runtime-bundle", [
    "scripts/run-local-bin.mjs",
    "vite/bin/vite.js",
    "build",
    "--config",
    "vite.local-hosted-runtime.config.ts"
  ], 300_000);
  await runNode("migrations", [
    databaseMigrationsBundlePath,
    "--controlled-snapshot-recovery"
  ], 120_000);
  await runNode("admin-bootstrap", [
    adminBootstrapBundlePath
  ], 120_000);
  await runNode("browser-config", [
    browserConfigBundlePath
  ], 120_000);
  await runNode("client-bundle", [
    "scripts/run-local-bin.mjs",
    "vite/bin/vite.js",
    "build",
    "--config",
    "vite.client-page.config.ts"
  ], 300_000);
  await runNode("admin-bundle", [
    "scripts/run-local-bin.mjs",
    "vite/bin/vite.js",
    "build",
    "--config",
    "vite.admin-page.config.ts"
  ], 300_000);
  sourceBuildInputHash = await hashSourceInputs([
    "apps/admin/src",
    "apps/client/src",
    "packages/game-config/src",
    "packages/game-core/src",
    "packages/shared-types/src",
    "page-assets/css",
    "page-assets/js/app",
    "page-assets/js/app-entry.js",
    "page-assets/js/faction-entry.js",
    "page-assets/js/lobby-entry.js",
    "page-assets/js/login-entry.js",
    "pages/game.html",
    "pages/faction.html",
    "pages/lobby.html",
    "pages/login.html",
    "admin.html",
    "vite.admin-page.config.ts",
    "vite.client-page.config.ts"
  ]);

  const api = startManagedProcess({
    name: "hosted-api",
    args: [hostedApiBundlePath],
    environment,
    logDirectory: runDirectory
  });
  processes.push(api);
  let worker = startManagedProcess({
    name: "hosted-worker",
    args: [hostedWorkerBundlePath],
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
  assetManifest = await captureAssetManifest({
    browserOrigin,
    buildSha,
    sourceBuildInputHash
  });
  await writeFile(
    path.join(runDirectory, "frontend-build-manifest.json"),
    `${JSON.stringify(assetManifest, null, 2)}\n`,
    "utf8"
  );

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
      evidence: {
        provisioning: suite.manualProvisioning
          ? "admin-browser-create-wizard"
          : "admin-api-fixture-helper",
        playerEntry: suite.manualProvisioning
          ? "browser-account-lobby-faction"
          : "browser-bootstrap-helper",
        scenarioSetup: suite.scenario
          ? "direct-authoritative-scenario-seed"
          : "none",
        gameplayInteraction: suite.gameplayInteraction,
        qualifiesAsManualAdminFlow: suite.manualProvisioning === true,
        ...(suite.name === "ui-parity" ? {
          comprehensiveParityGate: uiParityDebugBuildingTypeIds.length === 0,
          debugBuildingTypeIds: uiParityDebugBuildingTypeIds
        } : {}),
        playwrightArtifactDirectories: []
      },
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
      delete environment.EMPIRE_MANUAL_HOSTED_E2E;
      delete environment.EMPIRE_MANUAL_HOSTED_DISPLAY_NAME;
      delete environment.EMPIRE_MANUAL_HOSTED_STARTING_STATE_JSON;
      delete environment.EMPIRE_UI_PARITY_SERVER_ID;
      delete environment.PLAYWRIGHT_WORKERS;
      const suiteStartingPlayerState = suite.startingPlayerState
        || HOSTED_E2E_STARTING_PLAYER_STATE;
      environment.EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON = JSON.stringify(
        suiteStartingPlayerState
      );
      if (suite.manualProvisioning) {
        const displaySuffix = randomBytes(4).toString("hex");
        const manualDisplayName = `Local Hosted Manual ${displaySuffix}`;
        environment.EMPIRE_MANUAL_HOSTED_E2E = "1";
        environment.EMPIRE_ADMIN_HOSTED_LIVE_E2E = "1";
        environment.EMPIRE_MANUAL_HOSTED_DISPLAY_NAME = manualDisplayName;
        environment.EMPIRE_MANUAL_HOSTED_STARTING_STATE_JSON = JSON.stringify(
          MANUAL_HOSTED_STARTING_PLAYER_STATE
        );
        const manualTraceDirectory = retainPlaywrightArtifacts(result, "acceptance");
        result.evidence.trace = "playwright-trace-on";
        result.evidence.traceDirectory = path.relative(process.cwd(), manualTraceDirectory);
        result.status = "testing";
        await runNode(`playwright-${suite.name}`, [
          "scripts/run-local-bin.mjs",
          "playwright/cli.js",
          "test",
          "--trace",
          "on",
          "--output",
          manualTraceDirectory,
          ...suite.specs
        ], 1_800_000);
        const controlPlane = await admin.request("/api/admin/control-plane");
        const manualServer = controlPlane.servers.find((server) => (
          server.displayName === manualDisplayName
        ));
        if (!manualServer) {
          throw new Error(`Manual hosted server ${manualDisplayName} is missing after acceptance.`);
        }
        result.serverInstanceId = manualServer.serverInstanceId;
        result.status = "passed";
        if (manualServer.status === "archived") {
          result.cleanup = "archived";
        } else {
          result.cleanup = "stopping";
          await stopDisposableHostedServer(admin, manualServer.serverInstanceId);
          result.cleanup = "stopped";
        }
        continue;
      }
      if (suite.buildingActionPhase) {
        const identitySuffix = randomBytes(6).toString("hex");
        environment.EMPIRE_HOSTED_BOOTSTRAP_USERNAME = `HostedAction${identitySuffix}`;
        environment.EMPIRE_HOSTED_BOOTSTRAP_GANG_NAME = `Hosted Action Crew ${identitySuffix}`;
        environment.EMPIRE_HOSTED_BOOTSTRAP_PASSWORD = randomBytes(24).toString("base64url");
        environment.EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER = `2001:db8::${randomBytes(8).toString("hex")}`;
        environment.EMPIRE_HOSTED_BUILDING_ACTION_PHASE = suite.buildingActionPhase;
      }
      if (suite.bootstrapIdentityPrefix) {
        const identitySuffix = randomBytes(6).toString("hex");
        environment.EMPIRE_HOSTED_BOOTSTRAP_USERNAME =
          `${suite.bootstrapIdentityPrefix}${identitySuffix}`;
        environment.EMPIRE_HOSTED_BOOTSTRAP_GANG_NAME =
          `${suite.bootstrapIdentityPrefix} Crew ${identitySuffix}`;
        environment.EMPIRE_HOSTED_BOOTSTRAP_PASSWORD = randomBytes(24).toString("base64url");
        environment.EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER =
          `2001:db8::${randomBytes(8).toString("hex")}`;
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
        startingPlayerState: suiteStartingPlayerState,
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
      const bootstrapArtifactDirectory = retainPlaywrightArtifacts(result, "bootstrap");
      await runNode(`playwright-${suite.name}-bootstrap`, [
        "scripts/run-local-bin.mjs",
        "playwright/cli.js",
        "test",
        "--output",
        bootstrapArtifactDirectory,
        "tests/e2e/local-hosted-bootstrap-player.spec.js"
      ], 600_000);
      const scenario = suite.scenario || (suite.name === "city-events" ? "city-events" : "");
      if (scenario) {
        result.status = "seeding-scenario";
        await runFixtureNode(`seed-${suite.name}`, [
          hostedE2eScenarioBundlePath,
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
          args: [hostedWorkerBundlePath],
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
      const configuredPlaywrightGroups = suite.playwrightGroups || [{ name: "all", grep: "" }];
      const playwrightGroups = suite.name === "ui-parity"
        && uiParityDebugBuildingTypeIds.length > 0
        ? configuredPlaywrightGroups.filter((group) => group.name === "spawn-building-matrix")
        : configuredPlaywrightGroups;
      for (const group of playwrightGroups) {
        const groupArtifactDirectory = retainPlaywrightArtifacts(result, group.name);
        await runNode(`playwright-${suite.name}-${group.name}`, [
          "scripts/run-local-bin.mjs",
          "playwright/cli.js",
          "test",
          "--output",
          groupArtifactDirectory,
          ...suite.specs,
          ...(group.grep ? [`--grep=${group.grep}`] : [])
        ], 1_800_000);
      }
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
    artifactDirectories: {
      browser: browserArtifactRunDirectory,
      logs: runDirectory
    },
    assetManifest,
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
if (browserArtifactRunDirectory !== runDirectory) {
  console.log(`[local-hosted] Browser artifacts: ${browserArtifactRunDirectory}`);
}
process.exitCode = succeeded ? 0 : 1;

async function captureAssetManifest({
  browserOrigin: origin,
  buildSha: sourceBuildSha,
  sourceBuildInputHash: inputHash
}) {
  const targets = [
    {
      id: "gameplayClient",
      kind: "script",
      localPath: "page-assets/js/client-assets/gameplay-slice-client.js",
      servedPath: "/page-assets/js/client-assets/gameplay-slice-client.js"
    },
    {
      id: "adminClient",
      kind: "script",
      localPath: "page-assets/js/admin-assets/admin-app.js",
      servedPath: "/page-assets/js/admin-assets/admin-app.js"
    },
    {
      id: "mainCss",
      kind: "stylesheet",
      localPath: "page-assets/css/styles.css",
      servedPath: "/page-assets/css/styles.css"
    },
    {
      id: "browserGameplayConfig",
      kind: "script",
      localPath: "packages/game-config/src/legacy-page/gameplay-config.generated.js",
      servedPath: "/packages/game-config/src/legacy-page/gameplay-config.generated.js"
    }
  ];
  const assets = {};
  for (const target of targets) {
    const generated = await readFile(path.resolve(target.localPath));
    const manifestQuery = `asset-manifest=${encodeURIComponent(sourceBuildSha)}`;
    const response = await fetch(
      `${origin}${target.servedPath}?${manifestQuery}`,
      {
        cache: "no-store",
        headers: target.kind === "stylesheet"
          ? { accept: "text/css,*/*;q=0.1" }
          : { accept: "text/javascript,*/*;q=0.1" }
      }
    );
    if (!response.ok) {
      throw new Error(
        `Served asset ${target.servedPath} returned HTTP ${response.status}.`
      );
    }
    const served = Buffer.from(await response.arrayBuffer());
    const generatedHash = sha256(generated);
    const servedHash = sha256(served);
    const verification = target.kind === "script"
      ? Buffer.from(stripInlineSourceMap(served.toString("utf8")), "utf8")
      : await fetchServedSourceAsset(
          `${origin}${target.servedPath}?raw&${manifestQuery}`
        );
    const verificationHash = sha256(verification);
    if (generatedHash !== verificationHash) {
      throw new Error(
        `Served source hash mismatch for ${target.id}: ${generatedHash} != ${verificationHash}.`
      );
    }
    assets[target.id] = {
      sourceBuildInputHash: inputHash,
      generatedPath: target.localPath.replaceAll("\\", "/"),
      generatedHash,
      servedPath: target.servedPath,
      servedHash,
      servedContentType: response.headers.get("content-type"),
      verificationMode: target.kind === "script"
        ? "vite-inline-sourcemap-stripped"
        : "vite-raw-source",
      servedSourceHash: verificationHash,
      parity: "PASS"
    };
  }
  assets.cssSourceTree = await captureCssSourceTreeManifest({
    browserOrigin: origin,
    buildSha: sourceBuildSha,
    sourceBuildInputHash: inputHash
  });
  return {
    buildSha: sourceBuildSha,
    sourceBuildInputHash: inputHash,
    assets
  };
}

async function captureCssSourceTreeManifest({
  browserOrigin: origin,
  buildSha: sourceBuildSha,
  sourceBuildInputHash: inputHash
}) {
  const files = [];
  await collectSourceFiles(path.resolve("page-assets/css"), files);
  const cssFiles = files
    .filter((filePath) => filePath.toLowerCase().endsWith(".css"))
    .sort((left, right) => left.localeCompare(right));
  const generatedHash = createHash("sha256");
  const servedHash = createHash("sha256");
  const manifestQuery = `asset-manifest=${encodeURIComponent(sourceBuildSha)}`;
  for (const filePath of cssFiles) {
    const relativePath = path.relative(process.cwd(), filePath).replaceAll("\\", "/");
    const generated = await readFile(filePath);
    const served = await fetchServedSourceAsset(
      `${origin}/${relativePath}?raw&${manifestQuery}`
    );
    const generatedFileHash = sha256(generated);
    const servedFileHash = sha256(served);
    if (generatedFileHash !== servedFileHash) {
      throw new Error(
        `Served CSS source hash mismatch for ${relativePath}: ${generatedFileHash} != ${servedFileHash}.`
      );
    }
    for (const hash of [generatedHash, servedHash]) {
      hash.update(relativePath);
      hash.update("\0");
    }
    generatedHash.update(generated);
    servedHash.update(served);
    generatedHash.update("\0");
    servedHash.update("\0");
  }
  const generatedTreeHash = `sha256:${generatedHash.digest("hex")}`;
  const servedTreeHash = `sha256:${servedHash.digest("hex")}`;
  if (generatedTreeHash !== servedTreeHash) {
    throw new Error(
      `Served CSS tree hash mismatch: ${generatedTreeHash} != ${servedTreeHash}.`
    );
  }
  return {
    sourceBuildInputHash: inputHash,
    sourceRoot: "page-assets/css",
    sourceCount: cssFiles.length,
    generatedHash: generatedTreeHash,
    servedHash: servedTreeHash,
    verificationMode: "vite-raw-source-tree",
    parity: "PASS"
  };
}

async function hashSourceInputs(inputPaths) {
  const files = [];
  for (const inputPath of inputPaths) {
    await collectSourceFiles(path.resolve(inputPath), files);
  }
  const hash = createHash("sha256");
  for (const filePath of files.sort((left, right) => left.localeCompare(right))) {
    const relativePath = path.relative(process.cwd(), filePath).replaceAll("\\", "/");
    hash.update(relativePath);
    hash.update("\0");
    hash.update(await readFile(filePath));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

async function collectSourceFiles(inputPath, files) {
  const entries = await readdir(inputPath, { withFileTypes: true }).catch(() => null);
  if (!entries) {
    files.push(inputPath);
    return;
  }
  for (const entry of entries) {
    const entryPath = path.join(inputPath, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(entryPath, files);
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function fetchServedSourceAsset(url) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "text/css,*/*;q=0.1" }
  });
  if (!response.ok) {
    throw new Error(`Served source asset ${url} returned HTTP ${response.status}.`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function stripInlineSourceMap(source) {
  return String(source || "").replace(
    /\n?\/\/# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+\s*$/u,
    ""
  );
}
