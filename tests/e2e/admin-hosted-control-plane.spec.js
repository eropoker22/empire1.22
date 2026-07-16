import { expect, test } from "@playwright/test";

test("owner creates, provisions and controls a hosted server", async ({ page }) => {
  let authenticated = false;
  let hosted = null;
  let provisioningReads = 0;
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/admin/session" && request.method() === "POST") { authenticated = true; return json(route, 200, success(session)); }
    if (path === "/api/admin/session" && request.method() === "GET") return authenticated ? json(route, 200, success(session)) : failure(route, 401, "ADMIN_SESSION_REQUIRED");
    if (!authenticated) return failure(route, 401, "ADMIN_SESSION_REQUIRED");
    if (path === "/api/admin/servers" && request.method() === "POST") {
      expect(request.headers()["idempotency-key"]).toBeTruthy();
      const payload = request.postDataJSON();
      expect(payload.mapComposition).toEqual({ downtown: 8, commercial: 40, residential: 38, industrial: 38, park: 37 });
      hosted = hostedServer("requested", "requested", 1);
      return json(route, 202, success({ replayed: false, server: hosted, provisioningJobId: "job:e2e" }));
    }
    if (path.endsWith("/actions") && request.method() === "POST") {
      const payload = request.postDataJSON();
      expect(payload.expectedVersion).toBe(hosted.version);
      const next = transition(hosted, payload.action);
      hosted = { ...hosted, ...next, version: hosted.version + 1, updatedAt: NOW };
      return json(route, 202, success({ replayed: false, actionRequestId: `action:${payload.action}`,
        serverInstanceId: hosted.serverInstanceId, action: payload.action, status: "requested", expectedVersion: payload.expectedVersion }));
    }
    if (path === "/api/admin/control-plane") {
      if (hosted && hosted.provisioningState !== "ready") {
        provisioningReads += 1;
        hosted = provisioningReads === 1 ? { ...hosted, status: "provisioning", provisioningState: "provisioning", version: 2 }
          : { ...hosted, status: "lobby", provisioningState: "ready", currentSnapshotId: "snapshot:e2e:0", version: 3 };
      }
      return json(route, 200, success({ writesEnabled: true, provisioningEnabled: true, databaseAvailable: true,
        migrationsCurrent: true, workerStatus: "online", unavailableCode: null, servers: hosted ? [hosted] : [] }));
    }
    if (path === "/api/admin/overview") return json(route, 200, success(overview(hosted)));
    if (path.includes("/api/admin/instances/")) return json(route, 200, success(detail(hosted)));
    return failure(route, 404, "ADMIN_NOT_FOUND");
  });

  await page.goto("/admin.html");
  await page.locator("[data-admin-username]").fill("test-owner");
  await page.locator("[data-admin-password]").fill("TestPassword-Only-For-Fixtures");
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await page.getByRole("button", { name: "Vytvořit server" }).click();
  await page.getByLabel("Název").fill("E2E Hosted");
  await page.getByRole("button", { name: "Další" }).click();
  await expect(page.locator("[data-admin-map-total]")).toHaveText("161");
  await page.getByRole("button", { name: "Další" }).click();
  await page.getByLabel("Closed").check();
  await page.getByRole("button", { name: "Další" }).click();
  await expect(page.locator("[data-admin-create-review]")).toContainText("E2E Hosted");
  await page.getByRole("button", { name: "Create Server" }).click();
  await expect(page).toHaveURL(/instance=instance%3Afree%3Aeu-central%3Ae2e/u);
  await expect(page.locator("#admin-control-plane")).toContainText(/provisioning|lobby/iu);
  await page.getByRole("button", { name: "Obnovit" }).click();
  await expect(page.locator("#admin-control-plane")).toContainText("ready");

  const reason = page.locator("[data-admin-action-reason]");
  let expectedVersion = 3;
  for (const [button, expectedStatus] of [
    ["Open joins", "lobby"], ["Start", "running"], ["Pause", "paused"], ["Resume", "running"],
    ["Close joins", "running"], ["Safe restart", "running"], ["Stop", "stopped"]
  ]) {
    await reason.fill(`E2E ${button}`);
    await page.getByRole("button", { name: button, exact: true }).click();
    expectedVersion += 1;
    await expect(page.locator(".admin-lifecycle")).toContainText(`version ${expectedVersion}`);
    await expect(page.locator(".admin-lifecycle")).toContainText(expectedStatus);
  }
  await page.reload();
  await expect(page.locator(".admin-lifecycle")).toContainText("stopped");
  await expect(page.locator("body")).not.toContainText(/reset|hard delete|grant money/iu);
});

const NOW = "2026-07-16T10:00:00.000Z";
const session = { adminSessionId: "session:owner", adminUserId: "user:owner", actorId: "user:owner", username: "test-owner",
  displayName: "Test Owner", role: "owner", authenticationMethod: "password", createdAt: NOW,
  expiresAt: "2026-07-16T11:00:00.000Z", revokedAt: null, lastSeenAt: NOW };
const hostedServer = (status, provisioningState, version) => ({ serverInstanceId: "instance:free:eu-central:e2e", mode: "free",
  displayName: "E2E Hosted", region: "eu-central", capacity: 20, status, joinPolicy: "closed", provisioningState, version,
  lastWorkerHeartbeatAt: NOW, runtimeLeaseOwnerId: "worker:e2e", runtimeLeaseExpiresAt: "2026-07-16T10:01:00.000Z",
  currentSnapshotId: null, lastErrorCode: null, createdAt: NOW, updatedAt: NOW });
const transition = (server, action) => ({
  "open-joins": { joinPolicy: "open" }, "close-joins": { joinPolicy: "closed" }, start: { status: "running" },
  pause: { status: "paused" }, resume: { status: "running" }, restart: { status: server.status }, stop: { status: "stopped", joinPolicy: "closed" }
}[action]);
const overview = (server) => ({ generatedAt: NOW, databaseStatus: "available", instances: server ? [summary(server)] : [],
  counts: { known: server ? 1 : 0, live: server ? 1 : 0, stale: 0, offline: 0, noWorker: 0, failed: 0,
    running: server?.status === "running" ? 1 : 0, lobby: server?.status === "lobby" ? 1 : 0,
    paused: server?.status === "paused" ? 1 : 0, players: 0 } });
const summary = (server) => ({ serverInstanceId: server.serverInstanceId, displayName: server.displayName, mode: server.mode,
  region: server.region, capacity: server.capacity, joinPolicy: server.joinPolicy, status: server.status, currentTick: 0,
  stateVersion: 1, playerCount: 0, workerStatus: "live", lastHeartbeatAt: NOW, leaseOwner: "worker:e2e",
  leaseExpiresAt: "2026-07-16T10:01:00.000Z", lastSnapshotAt: NOW, snapshotStale: false, lastErrorAt: null,
  freshness: { serverInstanceId: server.serverInstanceId, generatedAt: NOW, source: "durable-snapshot", dataAsOf: NOW,
    lastSnapshotAt: NOW, lastHeartbeatAt: NOW, stale: false, staleReason: null } });
const detail = (server) => { const item = summary(server); return { serverInstanceId: server.serverInstanceId, generatedAt: NOW,
  summary: item, freshness: item.freshness, runtimeAvailable: true, players: [], districts: [],
  economy: { serverInstanceId: server.serverInstanceId, totalCleanCash: 0, totalDirtyCash: 0, totalResources: {} },
  production: { serverInstanceId: server.serverInstanceId, productionBuildingCount: 0, readyToCollectCount: 0, activeCraftCount: 0, storageFullCount: 0 },
  police: { serverInstanceId: server.serverInstanceId, heatPressure: "none", maxPlayerHeat: 0, wantedPlayerCount: 0, pendingRaidCount: 0 },
  liveness: { serverInstanceId: server.serverInstanceId, activePlayers: 0, playablePlayers: 0, temporarilySealedPlayers: 0,
    encircledPlayers: 0, lastStandPlayers: 0, emergencyRecoveryEligiblePlayers: 0, invalidSoftlocks: 0 }, alliances: [],
  snapshot: { serverInstanceId: server.serverInstanceId, snapshotId: "snapshot:e2e:0", createdAt: NOW, tick: 0, stateVersion: 1, schemaVersion: 1, stale: false },
  commands: [], events: [], diagnostics: [] }; };
const success = (data) => ({ accepted: true, data, errors: [] });
const failure = (route, status, code) => json(route, status, { accepted: false, data: null, errors: [{ code, message: code }] });
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
