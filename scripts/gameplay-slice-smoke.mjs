import "./require-node20.mjs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const DEFAULT_URL = "http://127.0.0.1:5174/pages/game.html";
const BROWSER_CANDIDATES = [
  process.env.EMPIRE_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

const url = process.argv.find((arg) => arg.startsWith("--url="))?.slice("--url=".length) || DEFAULT_URL;
const timeoutMs = Number(process.argv.find((arg) => arg.startsWith("--timeout-ms="))?.slice("--timeout-ms=".length) || 180000);
const startServer = !process.argv.includes("--no-start-server");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const findBrowserPath = () => BROWSER_CANDIDATES.find((candidate) => existsSync(candidate)) || undefined;

const createSmokeSession = () => {
  const now = new Date().toISOString();
  const serverInstanceId = "instance:free:eu-central:public-1";
  return {
    registration: {
      identity: "Server Slice Smoke",
      gangName: "Authoritative Crew",
      isGuest: true,
      loginKind: "guest",
      activeServerId: serverInstanceId,
      activeServerInstanceId: serverInstanceId,
      activeServerName: "Neon Docks FREE-01",
      activeServerMode: "free",
      activeServerRegion: "EU Central",
      activeServerStatus: "ONLINE",
      serverId: serverInstanceId,
      serverInstanceId,
      serverLabel: "Neon Docks FREE-01",
      serverMode: "free",
      serverRegion: "EU Central",
      preferredStartDistrictId: 27,
      startDistrictId: 27,
      factionId: "mafian",
      selectedFaction: "mafian",
      structure: "mafián",
      selectedStructure: "mafián",
      factionLocked: true,
      hasCompletedServerEntry: true,
      serverRegistrationStatus: "faction_locked",
      gangColor: "#67e8f9",
      lastLoginAt: now,
      lobbyLockedAt: now,
      lockedAt: now
    },
    world: {
      ownedDistrictIds: [27],
      destroyedDistrictIds: [],
      districtDefenseById: {},
      districtDefenseLoadoutById: {},
      districtDefenseResidentsById: {},
      districtTrapById: {},
      districtGossipById: {},
      districtPoliceActionById: {},
      phaseState: {
        gamePhase: "live",
        mapPhase: "night",
        cityMinutes: 1334
      }
    }
  };
};

const startVite = async (targetUrl) => {
  const parsedUrl = new URL(targetUrl);
  const host = parsedUrl.hostname || "127.0.0.1";
  const port = parsedUrl.port || "5174";
  const child = spawn(process.execPath, [
    "scripts/run-local-bin.mjs",
    "vite/bin/vite.js",
    "--config",
    "vite.game.config.ts",
    "--host",
    host,
    "--port",
    port
  ], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const output = [];
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => output.push(String(chunk).trim()));
  child.stderr?.on("data", (chunk) => output.push(String(chunk).trim()));

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`Local gameplay dev server exited before smoke could start. Port ${port} may be in use.\n${output.slice(-20).join("\n")}`);
    }
    try {
      const response = await fetch(targetUrl, { method: "GET" });
      if (response.ok) {
        return {
          child,
          output,
          async stop() {
            if (child.exitCode === null && !child.killed) {
              child.kill();
              await Promise.race([
                once(child, "exit").catch(() => {}),
                delay(1500)
              ]);
            }
          }
        };
      }
    } catch {}
    await delay(300);
  }

  child.kill();
  throw new Error(`Timed out waiting for local gameplay dev server at ${targetUrl}.\n${output.slice(-20).join("\n")}`);
};

const collectDiagnostics = async (page, { apiResponses, failedRequests, consoleErrors }) => {
  const pageState = await page.evaluate(() => {
    const sessionRaw = localStorage.getItem("empireStreets.session.v1");
    const sliceRoot = document.querySelector("[data-gameplay-slice-client]");
    let session = null;
    try {
      session = sessionRaw ? JSON.parse(sessionRaw) : null;
    } catch {}
    return {
      url: location.href,
      hasSession: Boolean(sessionRaw),
      session: session ? {
        identity: session.registration?.identity || "",
        serverId: session.registration?.serverId || "",
        serverInstanceId: session.registration?.serverInstanceId || "",
        factionId: session.registration?.factionId || "",
        startDistrictId: session.registration?.startDistrictId || null
      } : null,
      legacyRuntimeInit: document.querySelector("#game-root")?.dataset?.runtimeInit || "",
      gameplayRuntime: document.body?.dataset?.gameplayRuntime || "",
      gameplayFallback: document.body?.dataset?.gameplayFallback || "",
      sliceRuntime: sliceRoot?.dataset?.gameplayRuntime || "",
      sliceUnavailable: sliceRoot?.dataset?.gameplaySliceUnavailable || "",
      sliceError: sliceRoot?.dataset?.gameplaySliceError || "",
      loadEndpoint: sliceRoot?.dataset?.gameplaySliceEndpoint || "",
      canvasVisible: Boolean(document.querySelector("[data-testid='district-canvas']")),
      serverSliceVisible: Boolean(sliceRoot && !sliceRoot.hidden)
    };
  }).catch((error) => ({
    evaluateError: error instanceof Error ? error.message : String(error)
  }));

  return {
    ...pageState,
    apiResponses: apiResponses.slice(-10),
    nonOkResponses: apiResponses.filter((entry) => !entry.ok).slice(-10),
    failedApiRequests: failedRequests.filter((entry) => entry.url.includes("/api/")).slice(-10),
    consoleErrors: consoleErrors.slice(-20)
  };
};

const failWithDiagnostics = async (message, page, data) => {
  throw new Error(`${message}\nDiagnostics: ${JSON.stringify(await collectDiagnostics(page, data), null, 2)}`);
};

async function run() {
  let server = null;
  let browser = null;
  const apiResponses = [];
  const failedRequests = [];
  const consoleErrors = [];

  try {
    if (startServer) {
      server = await startVite(url);
    }

    browser = await chromium.launch({
      executablePath: findBrowserPath(),
      headless: true
    });
    const page = await browser.newPage();

    page.on("console", (message) => {
      if (!["error", "warning", "assert"].includes(message.type())) {
        return;
      }
      const text = message.text();
      const url = message.location().url || "";
      if (/favicon\.ico/i.test(`${text} ${url}`)) {
        return;
      }
      consoleErrors.push({
        type: message.type(),
        text: text.slice(0, 500),
        url
      });
    });
    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        errorText: request.failure()?.errorText || ""
      });
    });
    page.on("response", async (response) => {
      if (!response.ok()) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          ok: false
        });
      }
      if (!response.url().includes("/api/")) {
        return;
      }
      const entry = {
        url: response.url(),
        status: response.status(),
        ok: response.ok()
      };
      if (response.url().includes("/api/gameplay-slice/")) {
        try {
          const body = await response.json();
          entry.accepted = body?.accepted ?? null;
          entry.errorCodes = Array.isArray(body?.errors) ? body.errors.map((error) => error.code).slice(0, 5) : [];
          entry.hasReadModel = Boolean(body?.readModel);
          entry.stateVersion = body?.metadata?.stateVersion ?? body?.readModel?.server?.stateVersion ?? null;
        } catch {}
      }
      apiResponses.push(entry);
    });

    await page.addInitScript((session) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem("empireStreets.session.v1", JSON.stringify(session));
      window.localStorage.setItem("empire:active_guest_mode", "free");
      window.localStorage.setItem("empire:active_mode", "free");
      window.localStorage.setItem("empireStreets.freeSessionOnboarding.v1", JSON.stringify({
        completedStepIds: [],
        hidden: true,
        minimized: true
      }));
    }, createSmokeSession());

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    if (new URL(page.url()).pathname !== new URL(url).pathname) {
      await failWithDiagnostics("Game page redirected before the seeded session reached the auth guard.", page, { apiResponses, failedRequests, consoleErrors });
    }

    await page.waitForFunction(() => {
      const marker = document.body?.dataset?.gameplayRuntime || "";
      return marker && marker !== "initializing";
    }, null, { timeout: 60000 }).catch(async () => {
      await failWithDiagnostics("Timed out waiting for server-authoritative runtime to leave initializing.", page, {
        apiResponses,
        failedRequests,
        consoleErrors
      });
    });
    const marker = await page.evaluate(() => document.body?.dataset?.gameplayRuntime || "");
    if (marker !== "server-authoritative-ready") {
      await failWithDiagnostics(`Expected server-authoritative-ready runtime, got ${marker || "missing"}.`, page, { apiResponses, failedRequests, consoleErrors });
    }

    const loadResponse = apiResponses.find((entry) => entry.url.includes("/api/gameplay-slice/load"));
    if (!loadResponse || loadResponse.status === 404 || !loadResponse.hasReadModel) {
      await failWithDiagnostics("/api/gameplay-slice/load did not return an authoritative read model.", page, { apiResponses, failedRequests, consoleErrors });
    }

    await page.waitForSelector("[data-testid='district-canvas']", { state: "visible", timeout: 10000 });
    await page.waitForSelector("[data-gameplay-slice-client]:not([hidden])", { state: "attached", timeout: 10000 });
    await page.evaluate(() => {
      window.__empireGameplaySmoke = { legacyMutationEvents: [] };
      for (const name of ["empire:action-result", "empire:production-collected", "empire:spy-started", "empire:attack-started"]) {
        document.addEventListener(name, (event) => {
          window.__empireGameplaySmoke.legacyMutationEvents.push({
            name,
            detailType: event?.detail?.type || event?.detail?.kind || ""
          });
        });
      }
    });

    const action = page.locator("[data-gameplay-slice-client] button[data-building-action-building-id][data-building-action-id]:not([disabled])").first();
    if (await action.count() === 0) {
      await failWithDiagnostics("No enabled server-fed building action button was available.", page, { apiResponses, failedRequests, consoleErrors });
    }

    const submitPromise = page.waitForResponse((response) => response.url().includes("/api/gameplay-slice/submit"), { timeout: 15000 });
    await page.evaluate(() => {
      const actionButton = document.querySelector("[data-gameplay-slice-client] button[data-building-action-building-id][data-building-action-id]:not([disabled])");
      if (!(actionButton instanceof HTMLElement)) {
        throw new Error("No enabled server-fed building action button was available.");
      }
      actionButton.click();
    });
    const submitResponse = await submitPromise;
    const submitJson = await submitResponse.json();
    if (submitResponse.status() === 404 || !submitJson?.accepted || !submitJson?.readModel) {
      await failWithDiagnostics("Server-authoritative submit did not return an accepted read model.", page, { apiResponses, failedRequests, consoleErrors });
    }

    await page.waitForFunction(() => (
      document.querySelector("[data-gameplay-slice-status]")?.textContent?.includes("Akce přijata")
    ), null, { timeout: 10000 });
    const legacyMutationEvents = await page.evaluate(() => window.__empireGameplaySmoke?.legacyMutationEvents || []);
    if (legacyMutationEvents.length > 0) {
      await failWithDiagnostics("Legacy runtime handled the server-fed command click.", page, { apiResponses, failedRequests, consoleErrors });
    }

    const spyAction = page.locator("[data-gameplay-slice-client] button[data-spy-target-id]:not([disabled])").first();
    if (await spyAction.count() === 0) {
      await failWithDiagnostics("No enabled server-fed spy target button was available.", page, { apiResponses, failedRequests, consoleErrors });
    }

    const spySubmitPromise = page.waitForResponse((response) => response.url().includes("/api/gameplay-slice/submit"), { timeout: 15000 });
    await page.evaluate(() => {
      const spyButton = document.querySelector("[data-gameplay-slice-client] button[data-spy-target-id]:not([disabled])");
      if (!(spyButton instanceof HTMLElement)) {
        throw new Error("No enabled server-fed spy target button was available.");
      }
      spyButton.click();
    });
    const spySubmitResponse = await spySubmitPromise;
    const spySubmitJson = await spySubmitResponse.json();
    const spyReport = spySubmitJson?.readModel?.reports?.find((report) => report?.reportType === "spy");
    const allowedSpyResults = new Set(["success", "partial", "failed", "critical_failed"]);
    if (
      spySubmitResponse.status() === 404
      || !spySubmitJson?.accepted
      || !spySubmitJson?.readModel
      || !spyReport
      || spyReport.actionType !== "spy-district"
      || !allowedSpyResults.has(spyReport.result)
    ) {
      await failWithDiagnostics("Server-authoritative spy submit did not return an accepted spy read model.", page, { apiResponses, failedRequests, consoleErrors });
    }
    const matchingOccupyTarget = spySubmitJson.readModel?.district?.occupyTargets?.find(
      (target) => target?.districtId === spyReport.targetDistrictId
    );
    if (spyReport.result !== "success" && matchingOccupyTarget?.enabled) {
      await failWithDiagnostics("Non-success spy result unlocked occupy in the authoritative read model.", page, { apiResponses, failedRequests, consoleErrors });
    }

    await page.waitForFunction(() => (
      document.querySelector("[data-gameplay-slice-status]")?.textContent?.includes("Akce přijata")
      && document.querySelector("[data-gameplay-slice-client]")?.textContent?.includes("Špehování")
    ), null, { timeout: 10000 });
    const legacySpyMutationEvents = await page.evaluate(() => window.__empireGameplaySmoke?.legacyMutationEvents || []);
    if (legacySpyMutationEvents.length > 0) {
      await failWithDiagnostics("Legacy runtime handled the server-fed spy command click.", page, { apiResponses, failedRequests, consoleErrors });
    }
    if (consoleErrors.some((entry) => entry.type === "error")) {
      await failWithDiagnostics("Browser console reported unexpected errors.", page, { apiResponses, failedRequests, consoleErrors });
    }

    const attackAction = page.locator("[data-gameplay-slice-client] button[data-attack-target-id]:not([disabled])").first();
    if (await attackAction.count() === 0) {
      await failWithDiagnostics("No enabled server-fed attack target button was available.", page, { apiResponses, failedRequests, consoleErrors });
    }

    const attackSubmitPromise = page.waitForResponse((response) => response.url().includes("/api/gameplay-slice/submit"), { timeout: 15000 });
    await page.evaluate(() => {
      const attackButton = document.querySelector("[data-gameplay-slice-client] button[data-attack-target-id]:not([disabled])");
      if (!(attackButton instanceof HTMLElement)) {
        throw new Error("No enabled server-fed attack target button was available.");
      }
      attackButton.click();
    });
    const attackSubmitResponse = await attackSubmitPromise;
    const attackSubmitJson = await attackSubmitResponse.json();
    const battleReport = attackSubmitJson?.readModel?.reports?.find((report) => report?.reportType === "battle");
    if (
      attackSubmitResponse.status() === 404
      || !attackSubmitJson?.accepted
      || !attackSubmitJson?.readModel
      || !battleReport
      || battleReport.actionType !== "attack-district"
    ) {
      await failWithDiagnostics("Server-authoritative attack submit did not return an accepted battle read model.", page, { apiResponses, failedRequests, consoleErrors });
    }

    await page.waitForFunction(() => (
      document.querySelector("[data-gameplay-slice-status]")?.textContent?.includes("Akce přijata")
      && document.querySelector("[data-gameplay-slice-client]")?.textContent?.includes("Útok")
    ), null, { timeout: 10000 });
    const legacyAttackMutationEvents = await page.evaluate(() => window.__empireGameplaySmoke?.legacyMutationEvents || []);
    if (legacyAttackMutationEvents.length > 0) {
      await failWithDiagnostics("Legacy runtime handled the server-fed attack command click.", page, { apiResponses, failedRequests, consoleErrors });
    }
    if (consoleErrors.some((entry) => entry.type === "error")) {
      await failWithDiagnostics("Browser console reported unexpected errors after attack submit.", page, { apiResponses, failedRequests, consoleErrors });
    }

    console.log(JSON.stringify({
      smoke: "server-authoritative gameplay slice",
      runtime: marker,
      load: loadResponse,
      submit: {
        status: submitResponse.status(),
        accepted: submitJson.accepted,
        stateVersion: submitJson.metadata?.stateVersion ?? submitJson.readModel?.server?.stateVersion ?? null,
        firstReportType: submitJson.readModel?.reports?.[0]?.reportType ?? null
      },
      spySubmit: {
        status: spySubmitResponse.status(),
        accepted: spySubmitJson.accepted,
        stateVersion: spySubmitJson.metadata?.stateVersion ?? spySubmitJson.readModel?.server?.stateVersion ?? null,
        firstSpyResult: spyReport.result,
        firstSpyTargetDistrictId: spyReport.targetDistrictId,
        firstSpyOccupyUnlocked: Boolean(spyReport.occupyUnlocked),
        firstSpyBlockedUntilTick: spyReport.blockedUntilTick ?? null
      },
      attackSubmit: {
        status: attackSubmitResponse.status(),
        accepted: attackSubmitJson.accepted,
        stateVersion: attackSubmitJson.metadata?.stateVersion ?? attackSubmitJson.readModel?.server?.stateVersion ?? null,
        firstBattleResult: battleReport.result,
        firstBattleTargetDistrictId: battleReport.targetDistrictId,
        firstBattleDistrictCaptured: Boolean(battleReport.districtCaptured),
        firstBattleDistrictDestroyed: Boolean(battleReport.districtDestroyed)
      },
      legacyMutationEvents: legacyAttackMutationEvents
    }, null, 2));
  } finally {
    await browser?.close().catch(() => {});
    await server?.stop().catch(() => {});
  }
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
