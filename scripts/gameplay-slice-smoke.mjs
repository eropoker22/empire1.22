import "./require-supported-node.mjs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const DEFAULT_URL = "http://127.0.0.1:5174/pages/game.html";
const BROWSER_CANDIDATES = [
  process.env.EMPIRE_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

const readArgument = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) || "";
};

const rawUrl = readArgument("url") || DEFAULT_URL;
const smokeUrl = new URL(rawUrl);
smokeUrl.searchParams.set("runtimeMode", "server-authoritative");
const url = smokeUrl.toString();
const timeoutMs = Number(readArgument("timeout-ms") || 180000);
const startServer = !process.argv.includes("--no-start-server");
const allowServerMissing = process.argv.includes("--allow-server-missing");
const storageStateArgument = readArgument("storage-state")
  || String(process.env.EMPIRE_GAMEPLAY_SMOKE_STORAGE_STATE || "").trim();
const storageStatePath = storageStateArgument
  ? resolve(process.cwd(), storageStateArgument)
  : "";

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const findBrowserPath = () => BROWSER_CANDIDATES.find((candidate) => existsSync(candidate)) || undefined;

const sanitizeDiagnosticText = (value, maxLength = 500) => String(value || "")
  .replace(/(snapshotToken|sessionToken|token|password)["':=\s]+[^,}\s]+/giu, "$1=<redacted>")
  .replace(/[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/gu, "<redacted-token>")
  .slice(0, maxLength);

const safeRequestPath = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.pathname;
  } catch {
    return String(value || "").split("?")[0];
  }
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
    const controllerRoot = document.querySelector("[data-gameplay-slice-client]");
    const districtPopup = document.querySelector("[data-district-popup]");
    const buildingDetail = document.querySelector("[data-district-building-detail-popup]:not([hidden])");
    const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.() || null;
    return {
      path: location.pathname,
      runtimeMode: document.documentElement?.dataset?.runtimeMode || "",
      gameplayExecutionMode: document.documentElement?.dataset?.gameplayExecutionMode || "",
      sharedRuntimeInit: document.querySelector("#game-root")?.dataset?.runtimeInit || "",
      authorityState: document.body?.dataset?.authorityState || "",
      gameplayRuntime: document.body?.dataset?.gameplayRuntime || "",
      gameplayServerRuntime: document.body?.dataset?.gameplayServerRuntime || "",
      gameplayFallback: document.body?.dataset?.gameplayFallback || "",
      controller: {
        present: Boolean(controllerRoot),
        hidden: controllerRoot instanceof HTMLElement ? controllerRoot.hidden : null,
        presentationMode: controllerRoot?.dataset?.gameplaySlicePresentationMode || "",
        runtime: controllerRoot?.dataset?.gameplayRuntime || "",
        serverRuntime: controllerRoot?.dataset?.gameplayServerRuntime || "",
        unavailable: controllerRoot?.dataset?.gameplaySliceUnavailable || "",
        error: controllerRoot?.dataset?.gameplaySliceError || "",
        renderedButtonCount: controllerRoot?.querySelectorAll?.("button")?.length || 0
      },
      headlessPort: {
        getCurrentReadModel: typeof window.EmpireGameplaySliceClient?.getCurrentReadModel === "function",
        submitCommand: typeof window.EmpireGameplaySliceClient?.submitCommand === "function"
      },
      readModel: readModel ? {
        serverInstanceId: readModel.server?.serverInstanceId || "",
        serverStatus: readModel.server?.status || "",
        stateVersion: readModel.server?.stateVersion ?? null,
        currentTick: readModel.server?.currentTick ?? null,
        playerId: readModel.player?.playerId || "",
        districtId: readModel.district?.districtId || ""
      } : null,
      visibleUi: {
        canvas: Boolean(document.querySelector("[data-district-canvas]")),
        districtPopup: districtPopup instanceof HTMLElement ? !districtPopup.hidden : false,
        districtId: districtPopup?.dataset?.districtId || "",
        buildingDetail: buildingDetail instanceof HTMLElement,
        buildingId: buildingDetail?.dataset?.serverBuildingId || "",
        buildingActionCount: buildingDetail?.querySelectorAll?.("[data-district-building-detail-action-id]")?.length || 0
      }
    };
  }).catch((error) => ({
    evaluateError: error instanceof Error ? error.message : String(error)
  }));

  return {
    ...pageState,
    apiResponses: apiResponses.slice(-12),
    nonOkResponses: apiResponses.filter((entry) => !entry.ok).slice(-12),
    failedApiRequests: failedRequests.slice(-12),
    consoleErrors: consoleErrors.slice(-20)
  };
};

const failWithDiagnostics = async (message, page, data) => {
  throw new Error(`${message}\nDiagnostics: ${JSON.stringify(await collectDiagnostics(page, data), null, 2)}`);
};

const collectGameplaySliceErrorCodes = (diagnostics) =>
  (diagnostics?.apiResponses || [])
    .flatMap((entry) => Array.isArray(entry.errorCodes) ? entry.errorCodes : [])
    .filter(Boolean);

const isAuthenticationRedirect = (pathname) => [
  "/pages/login.html",
  "/pages/lobby.html",
  "/pages/faction.html"
].includes(pathname);

const isHostedRuntimeUnavailable = (diagnostics) => {
  const errorCodes = collectGameplaySliceErrorCodes(diagnostics);
  const hasAuthoritativeReadModel = diagnostics?.apiResponses?.some((entry) => (
    entry.path === "/api/gameplay-slice/load" && entry.hasReadModel
  ));
  return diagnostics?.gameplayRuntime === "server-authoritative-error"
    || diagnostics?.authorityState === "unavailable"
    || diagnostics?.controller?.unavailable === "true"
    || errorCodes.some((code) => [
      "SESSION_REQUIRED",
      "SESSION_INVALID",
      "GAMEPLAY_SESSION_REQUIRED",
      "GAMEPLAY_SESSION_INVALID",
      "INSTANCE_NOT_RUNNING",
      "SERVER_NOT_RUNNING"
    ].includes(code))
    || !hasAuthoritativeReadModel;
};

const printSkippedSmoke = (reason, diagnostics) => {
  console.log(JSON.stringify({
    smoke: "server-authoritative shared game UI",
    outcome: "SKIPPED",
    reason,
    runtime: diagnostics.gameplayRuntime || "missing",
    authorityState: diagnostics.authorityState || "missing",
    errorCodes: collectGameplaySliceErrorCodes(diagnostics),
    coverage: {
      visibleUi: false,
      headlessReadPort: false,
      commandTransport: "not exercised"
    }
  }, null, 2));
};

const waitForApiResponse = async (apiResponses, predicate, waitMs = 5000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < waitMs) {
    const match = [...apiResponses].reverse().find(predicate);
    if (match) return match;
    await delay(50);
  }
  return null;
};

const dismissVisibleBlockingOverlays = async (page) => {
  const milestone = page.locator("[data-server-milestone-modal]:not([hidden])");
  if (await milestone.isVisible().catch(() => false)) {
    await milestone.locator("[data-server-milestone-confirm]").click();
    await milestone.waitFor({ state: "hidden", timeout: 5000 });
  }

  const onboarding = page.locator("[data-onboarding-panel]:not([hidden])");
  if (await onboarding.isVisible().catch(() => false)) {
    const skip = onboarding.locator("[data-onboarding-skip-action]").first();
    if (!await skip.isVisible().catch(() => false)) {
      throw new Error("The canonical onboarding overlay is visible but has no visible skip control.");
    }
    await skip.click();
    await onboarding.waitFor({ state: "hidden", timeout: 5000 });
  }
};

const selectSmokeBuildingAction = (page) => page.evaluate(() => {
  const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.();
  if (!readModel?.district?.districtId) return null;
  for (const building of readModel.district.buildings || []) {
    const action = (building.actions || []).find((candidate) => (
      candidate?.enabled === true
      && !candidate?.disabledReason
      && (!Array.isArray(candidate?.requiresInput) || candidate.requiresInput.length === 0)
    ));
    if (action) {
      return {
        actionId: action.actionId,
        buildingId: building.buildingId,
        buildingTypeId: building.buildingTypeId,
        districtId: readModel.district.districtId,
        playerId: readModel.player?.playerId || "",
        previousStateVersion: Number(readModel.server?.stateVersion || 0)
      };
    }
  }
  return null;
});

const openDistrictThroughVisibleMap = async (page, districtId) => {
  const numericDistrictId = Number(String(districtId || "").replace(/^district:/u, ""));
  const clickTarget = await page.evaluate((requestedDistrictId) => {
    const district = window.empireStreetsDistrictState?.getDistrictById?.(requestedDistrictId);
    const canvas = document.querySelector("[data-district-canvas]");
    const canvasHost = document.querySelector("[data-map-canvas]");
    const viewport = document.querySelector("[data-map-viewport]");
    if (!district || !(canvas instanceof HTMLCanvasElement) || !(canvasHost instanceof HTMLElement)) {
      return null;
    }
    window.__EMPIRE_GAMEPLAY_SLICE_SMOKE_MAP_CLICKS__ = [];
    viewport?.addEventListener("click", (event) => {
      window.__EMPIRE_GAMEPLAY_SLICE_SMOKE_MAP_CLICKS__.push({ isTrusted: event.isTrusted });
    }, { once: true });
    const rect = canvasHost.getBoundingClientRect();
    return {
      x: rect.left + (Number(district.centerX) / canvas.width) * rect.width,
      y: rect.top + (Number(district.centerY) / canvas.height) * rect.height
    };
  }, numericDistrictId);
  if (!clickTarget) {
    throw new Error(`District ${districtId} has no canonical visible canvas coordinate.`);
  }

  await page.mouse.click(clickTarget.x, clickTarget.y);
  await page.waitForFunction((expectedDistrictId) => {
    const popup = document.querySelector("[data-district-popup]");
    const currentDistrictId = window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.district?.districtId;
    return popup instanceof HTMLElement
      && !popup.hidden
      && popup.dataset.districtId === expectedDistrictId.replace(/^district:/u, "")
      && currentDistrictId === expectedDistrictId;
  }, districtId, { timeout: 30000 });

  const trustedClicks = await page.evaluate(() => window.__EMPIRE_GAMEPLAY_SLICE_SMOKE_MAP_CLICKS__ || []);
  if (trustedClicks.length !== 1 || trustedClicks[0]?.isTrusted !== true) {
    throw new Error("District popup was not opened by one trusted visible map click.");
  }
};

const openBuildingThroughSharedUi = async (page, target) => {
  const chip = page.locator(
    `[data-district-popup]:not([hidden]) [data-district-building-id="${target.buildingId}"]`
  ).first();
  if (!await chip.isVisible().catch(() => false)) {
    throw new Error(`Building ${target.buildingId} is not exposed by the visible shared district popup.`);
  }
  await chip.click();

  const shell = page.locator(
    `[data-district-building-detail-popup][data-server-building-id="${target.buildingId}"]:not([hidden])`
  ).last();
  await shell.waitFor({ state: "visible", timeout: 10000 });
  const contract = await shell.evaluate((element) => ({
    executionMode: element.dataset.executionMode || "",
    uiOwner: element.dataset.uiOwner || "",
    buildingTypeId: element.dataset.serverBuildingTypeId || "",
    districtId: element.dataset.serverDistrictId || ""
  }));
  if (
    contract.executionMode !== "server-authoritative"
    || contract.uiOwner !== "legacy-shared"
    || contract.buildingTypeId !== target.buildingTypeId
    || contract.districtId !== target.districtId
  ) {
    throw new Error(`Building ${target.buildingId} did not use the canonical shared presentation contract.`);
  }

  const action = shell.locator(
    `[data-district-building-detail-action-id="${target.actionId}"]`
  ).first();
  if (!await action.isVisible().catch(() => false) || !await action.isEnabled().catch(() => false)) {
    throw new Error(`Building action ${target.actionId} is not enabled in the visible shared building card.`);
  }
  return { action, shell };
};

const waitForTerminalBuildingSubmit = (page, target, waitMs = 30000) => {
  let timer = null;
  let onResponse = null;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    if (onResponse) page.off("response", onResponse);
    timer = null;
    onResponse = null;
  };
  const promise = new Promise((resolveSubmit, rejectSubmit) => {
    timer = setTimeout(() => {
      cleanup();
      rejectSubmit(new Error(`Timed out waiting for visible ${target.actionId} submit.`));
    }, waitMs);

    onResponse = async (response) => {
      if (safeRequestPath(response.url()) !== "/api/gameplay-slice/submit") return;
      let request = null;
      let body = null;
      try {
        request = response.request().postDataJSON();
        body = await response.json();
      } catch {
        return;
      }
      if (
        request?.command?.type !== "run-building-action"
        || request.command.payload?.actionId !== target.actionId
        || request.command.payload?.buildingId !== target.buildingId
      ) {
        return;
      }
      const errorCodes = Array.isArray(body?.errors) ? body.errors.map((error) => error?.code).filter(Boolean) : [];
      if (response.status() === 409 && errorCodes.some((code) => String(code).includes("STATE_VERSION_CONFLICT"))) {
        return;
      }
      cleanup();
      resolveSubmit({ body, request, response });
    };

    page.on("response", onResponse);
  });
  return { cancel: cleanup, promise };
};

const clickVisibleBuildingAction = async (page, target, action) => {
  const submitWait = waitForTerminalBuildingSubmit(page, target);
  const confirmation = page.locator(".building-special-action-confirm:not([hidden])").last();
  const confirmationPromise = confirmation.waitFor({
    state: "visible",
    timeout: 5000
  }).then(
    () => "visible-confirmation",
    () => new Promise(() => {})
  );

  try {
    await action.click();
    const firstOutcome = await Promise.race([
      confirmationPromise,
      submitWait.promise.then(() => "immediate-submit")
    ]);
    if (firstOutcome !== "visible-confirmation") {
      throw new Error(`Visible action ${target.actionId} bypassed the canonical shared confirmation.`);
    }
    const confirmButton = confirmation.locator(".building-special-action-confirm__button--confirm");
    if (!await confirmButton.isVisible().catch(() => false) || !await confirmButton.isEnabled().catch(() => false)) {
      throw new Error(`Visible confirmation for ${target.actionId} cannot be confirmed.`);
    }
    await confirmButton.click();
    const submission = await submitWait.promise;
    return { confirmation: firstOutcome, ...submission };
  } catch (error) {
    submitWait.cancel();
    throw error;
  }
};

async function run() {
  let server = null;
  let browser = null;
  const apiResponses = [];
  const failedRequests = [];
  const consoleErrors = [];

  try {
    if (storageStatePath && !existsSync(storageStatePath)) {
      throw new Error(`Gameplay smoke storage state does not exist: ${storageStatePath}`);
    }
    if (startServer) {
      server = await startVite(url);
    }

    browser = await chromium.launch({
      executablePath: findBrowserPath(),
      headless: true
    });
    const context = await browser.newContext(storageStatePath ? { storageState: storageStatePath } : {});
    const page = await context.newPage();

    page.on("console", (message) => {
      if (![
        "error",
        "warning",
        "assert"
      ].includes(message.type())) return;
      const text = message.text();
      const location = message.location().url || "";
      if (/favicon\.ico/i.test(`${text} ${location}`)) return;
      consoleErrors.push({
        type: message.type(),
        text: sanitizeDiagnosticText(text),
        path: safeRequestPath(location)
      });
    });
    page.on("requestfailed", (request) => {
      if (!request.url().includes("/api/")) return;
      failedRequests.push({
        path: safeRequestPath(request.url()),
        errorText: sanitizeDiagnosticText(request.failure()?.errorText || "", 200)
      });
    });
    page.on("response", async (response) => {
      if (!response.url().includes("/api/")) return;
      const entry = {
        path: safeRequestPath(response.url()),
        status: response.status(),
        ok: response.ok()
      };
      if (entry.path.startsWith("/api/gameplay-slice/")) {
        try {
          const body = await response.json();
          entry.accepted = body?.accepted ?? null;
          entry.errorCodes = Array.isArray(body?.errors)
            ? body.errors.map((error) => error?.code).filter(Boolean).slice(0, 5)
            : [];
          entry.hasReadModel = Boolean(body?.readModel);
          entry.stateVersion = body?.metadata?.stateVersion ?? body?.readModel?.server?.stateVersion ?? null;
          const request = response.request().postDataJSON();
          entry.commandType = request?.command?.type || null;
          entry.actionId = request?.command?.payload?.actionId || null;
          entry.buildingId = request?.command?.payload?.buildingId || null;
          entry.districtId = request?.command?.payload?.districtId || request?.districtId || null;
        } catch {}
      }
      apiResponses.push(entry);
    });

    await page.addInitScript(() => {
      window.sessionStorage.removeItem("empire:local-demo-session:v1");
      window.localStorage.removeItem("empire:demo:execution-mode:v1");
    });

    const expectedPath = smokeUrl.pathname;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForFunction((gamePath) => {
      if (location.pathname !== gamePath) return true;
      const runtime = document.body?.dataset?.gameplayRuntime || "";
      const authorityState = document.body?.dataset?.authorityState || "";
      return (runtime && runtime !== "initializing")
        || ["ready", "unavailable", "waiting-for-start", "paused"].includes(authorityState);
    }, expectedPath, { timeout: Math.min(timeoutMs, 60000) }).catch(() => {});

    if (new URL(page.url()).pathname !== expectedPath) {
      const redirectedPath = new URL(page.url()).pathname;
      const diagnostics = await collectDiagnostics(page, { apiResponses, failedRequests, consoleErrors });
      if (allowServerMissing && isAuthenticationRedirect(redirectedPath)) {
        printSkippedSmoke("validated hosted account or active membership is not available", diagnostics);
        return;
      }
      throw new Error(`Game page redirected to ${redirectedPath}; provide an authenticated --storage-state file.\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
    }

    const diagnostics = await collectDiagnostics(page, { apiResponses, failedRequests, consoleErrors });
    if (["demo-ready", "legacy-fallback"].includes(diagnostics.gameplayRuntime) || diagnostics.gameplayFallback) {
      throw new Error(`Hosted smoke entered a forbidden demo/fallback runtime.\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
    }
    if (diagnostics.gameplayRuntime !== "server-authoritative-ready") {
      if (allowServerMissing && isHostedRuntimeUnavailable(diagnostics)) {
        printSkippedSmoke("validated hosted runtime is not connected", diagnostics);
        return;
      }
      throw new Error(`Expected server-authoritative-ready runtime, got ${diagnostics.gameplayRuntime || "missing"}.\nDiagnostics: ${JSON.stringify(diagnostics, null, 2)}`);
    }

    await page.waitForFunction(() => {
      const root = document.querySelector("#game-root");
      const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.();
      return root?.dataset?.runtimeInit === "ready"
        && document.body?.dataset?.authorityState === "ready"
        && readModel?.server?.status === "running"
        && Boolean(readModel?.player?.playerId)
        && Boolean(readModel?.district?.districtId);
    }, null, { timeout: 30000 }).catch(async () => {
      await failWithDiagnostics("Timed out waiting for the canonical hosted game shell and headless read port.", page, {
        apiResponses,
        failedRequests,
        consoleErrors
      });
    });

    const loadResponse = await waitForApiResponse(apiResponses, (entry) => (
      entry.path === "/api/gameplay-slice/load" && entry.ok && entry.hasReadModel
    ));
    if (!loadResponse) {
      await failWithDiagnostics("/api/gameplay-slice/load did not return an authoritative read model.", page, {
        apiResponses,
        failedRequests,
        consoleErrors
      });
    }

    const headlessContract = await page.evaluate(() => {
      const root = document.querySelector("[data-gameplay-slice-client]");
      return {
        present: root instanceof HTMLElement,
        hidden: root instanceof HTMLElement ? root.hidden : false,
        presentationMode: root?.dataset?.gameplaySlicePresentationMode || "",
        renderedButtonCount: root?.querySelectorAll?.("button")?.length || 0,
        readPortAvailable: typeof window.EmpireGameplaySliceClient?.getCurrentReadModel === "function"
      };
    });
    if (
      !headlessContract.present
      || !headlessContract.hidden
      || headlessContract.presentationMode !== "controller-only"
      || headlessContract.renderedButtonCount !== 0
      || !headlessContract.readPortAvailable
    ) {
      await failWithDiagnostics("The gameplay slice mount is not a hidden controller-only port.", page, {
        apiResponses,
        failedRequests,
        consoleErrors
      });
    }

    await page.locator("[data-district-canvas]").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForFunction(() => typeof window.empireStreetsDistrictState?.getDistrictById === "function", null, {
      timeout: 10000
    });
    await dismissVisibleBlockingOverlays(page);

    const target = await selectSmokeBuildingAction(page);
    if (!target) {
      await failWithDiagnostics("No enabled input-free building action exists in the authoritative focused district.", page, {
        apiResponses,
        failedRequests,
        consoleErrors
      });
    }

    await openDistrictThroughVisibleMap(page, target.districtId);
    const { action } = await openBuildingThroughSharedUi(page, target);
    const submission = await clickVisibleBuildingAction(page, target, action);
    const report = submission.body?.readModel?.reports?.find((candidate) => (
      candidate?.reportType === "building-action"
      && candidate?.buildingActionId === target.actionId
      && candidate?.buildingId === target.buildingId
      && candidate?.districtId === target.districtId
    ));
    if (
      submission.response.status() !== 200
      || submission.body?.accepted !== true
      || !submission.body?.readModel
      || submission.request?.command?.payload?.districtId !== target.districtId
      || submission.body.readModel?.player?.playerId !== target.playerId
      || Number(submission.body.readModel?.server?.stateVersion || 0) <= target.previousStateVersion
      || !report
      || report.result !== "success"
    ) {
      await failWithDiagnostics("Visible shared building action did not return an accepted authoritative mutation.", page, {
        apiResponses,
        failedRequests,
        consoleErrors
      });
    }

    await page.waitForFunction((expectedStateVersion) => (
      Number(window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.server?.stateVersion || 0)
        >= expectedStateVersion
    ), Number(submission.body.readModel.server.stateVersion), { timeout: 10000 });

    if (consoleErrors.some((entry) => entry.type === "error")) {
      await failWithDiagnostics("Browser console reported unexpected errors.", page, {
        apiResponses,
        failedRequests,
        consoleErrors
      });
    }

    console.log(JSON.stringify({
      smoke: "server-authoritative shared game UI",
      outcome: "PASS",
      runtime: diagnostics.gameplayRuntime,
      load: loadResponse,
      coverage: {
        visibleUi: {
          trustedMapClick: true,
          sharedDistrictPopup: true,
          sharedBuildingCard: true,
          visibleBuildingActionClick: true,
          visibleConfirmation: submission.confirmation === "visible-confirmation"
        },
        headlessReadPort: true,
        commandTransport: "visible-shared-ui"
      },
      submit: {
        status: submission.response.status(),
        accepted: submission.body.accepted,
        actionId: target.actionId,
        buildingId: target.buildingId,
        buildingTypeId: target.buildingTypeId,
        districtId: target.districtId,
        stateVersion: submission.body.readModel.server.stateVersion,
        reportId: report.reportId || null,
        reportResult: report.result
      }
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
