import { expect, test } from "@playwright/test";

test("read-only admin session and per-instance isolation", async ({ page }) => {
  let authenticated = false;
  let sessionExpired = false;
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/admin/session" && request.method() === "POST") {
      authenticated = true;
      return json(route, 200, success(session));
    }
    if (path === "/api/admin/session" && request.method() === "GET") {
      return authenticated && !sessionExpired ? json(route, 200, success(session)) : failure(route, 401, "ADMIN_SESSION_REQUIRED");
    }
    if (!authenticated || sessionExpired) return failure(route, 401, "ADMIN_SESSION_EXPIRED");
    if (path === "/api/admin/overview") return json(route, 200, success(overview));
    if (path.endsWith("/server%3AA") || path.endsWith("/server:A")) return json(route, 200, success(detail("server:A", 2, 10, 20, 5)));
    if (path.endsWith("/server%3AB") || path.endsWith("/server:B")) return json(route, 200, success(detail("server:B", 5, 30, 80, 14)));
    return failure(route, 404, "ADMIN_NOT_FOUND");
  });

  await page.goto("/admin.html");
  await expect(page.getByRole("heading", { name: "Admin konzole" })).toBeVisible();
  await page.locator("[data-admin-secret]").fill("one-use-secret");
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await expect(page.getByRole("heading", { name: "Read-only admin" })).toBeVisible();
  await expect(page.getByText("Server A", { exact: true })).toBeVisible();
  await expect(page.locator('[data-admin-instance="server:B"]')).toBeVisible();
  await expect(page.locator("[data-admin-secret]")).toHaveCount(0);
  await expect(page.locator("button")).toHaveCount(2);
  await expect(page.locator("body")).not.toContainText(/mock|draft only|static fallback/iu);

  await page.locator('[data-admin-instance="server:A"]').click();
  await expect(page).toHaveURL(/instance=server%3AA/u);
  await expect(page.locator("#admin-players tbody tr")).toHaveCount(2);
  await expect(page.locator("#admin-map tbody tr")).toHaveCount(10);
  await expect(page.locator("#admin-commands tbody tr")).toHaveCount(5);
  await expect(page.locator("body")).not.toContainText("server:B Player");

  await page.locator('[data-admin-instance="server:B"]').click();
  await expect(page).toHaveURL(/instance=server%3AB/u);
  await expect(page.locator("#admin-players tbody tr")).toHaveCount(5);
  await expect(page.locator("#admin-map tbody tr")).toHaveCount(30);
  await expect(page.locator("#admin-commands tbody tr")).toHaveCount(14);
  await expect(page.getByText("OFFLINE", { exact: true })).toBeVisible();
  await expect(page.locator('[data-admin-instance="server:B"]')).toBeVisible();
  await expect(page.locator("body")).not.toContainText("server:A Player");

  sessionExpired = true;
  await page.getByRole("button", { name: "Obnovit" }).click();
  await expect(page.getByRole("heading", { name: "Admin konzole" })).toBeVisible();
  await expect(page.getByText("Admin session vypršela.")).toBeVisible();
});

const session = { adminSessionId: "session:e2e", actorId: "actor:e2e", displayName: "E2E Viewer", role: "viewer",
  createdAt: "2026-07-16T10:00:00.000Z", expiresAt: "2026-07-16T10:30:00.000Z", revokedAt: null,
  authenticationMethod: "closed-alpha-bootstrap" };
const NOW = "2026-07-16T10:00:00.000Z";
const summary = (id, count, workerStatus) => ({ serverInstanceId: id, displayName: id === "server:A" ? "Server A" : "Server B",
  mode: "free", region: "eu-central", capacity: 20, joinPolicy: "open", status: id === "server:A" ? "running" : "paused",
  currentTick: 42, stateVersion: 3, playerCount: count, workerStatus, lastHeartbeatAt: NOW, leaseOwner: id === "server:A" ? "worker:A" : null,
  leaseExpiresAt: NOW, lastSnapshotAt: NOW, snapshotStale: false, lastErrorAt: null,
  freshness: { serverInstanceId: id, generatedAt: NOW, source: "durable-snapshot", dataAsOf: NOW, lastSnapshotAt: NOW,
    lastHeartbeatAt: NOW, stale: workerStatus !== "live", staleReason: workerStatus === "live" ? null : "worker-offline" } });
const overview = { generatedAt: NOW, databaseStatus: "available", instances: [summary("server:A", 2, "live"), summary("server:B", 5, "offline")],
  counts: { known: 2, live: 1, stale: 0, offline: 1, noWorker: 0, failed: 0, running: 1, lobby: 0, paused: 1, players: 7 } };
const detail = (id, players, districts, heat, commands) => {
  const item = summary(id, players, id === "server:A" ? "live" : "offline");
  return { serverInstanceId: id, generatedAt: NOW, summary: item, freshness: item.freshness, runtimeAvailable: id === "server:A",
    players: Array.from({ length: players }, (_, index) => ({ serverInstanceId: id, playerId: `${id}:player:${index}`, displayName: `${id} Player ${index}`,
      factionId: "faction:test", status: "active", homeDistrictId: null, ownedDistrictCount: 1, cash: 100, dirtyCash: 0, population: 100, heat, wantedLevel: 0, lastActionAt: NOW })),
    districts: Array.from({ length: districts }, (_, index) => ({ serverInstanceId: id, districtId: `${id}:district:${index}`, name: `${id} District ${index}`,
      zone: "residential", status: "active", ownerPlayerId: `${id}:player:0`, influence: 1, heat, buildingCount: 1 })),
    economy: { serverInstanceId: id, totalCleanCash: 100, totalDirtyCash: 0, totalResources: { cash: 100 } },
    production: { serverInstanceId: id, productionBuildingCount: districts, readyToCollectCount: 0, activeCraftCount: 0, storageFullCount: 0 },
    police: { serverInstanceId: id, heatPressure: heat >= 40 ? "medium" : "low", maxPlayerHeat: heat, wantedPlayerCount: 0, pendingRaidCount: 0 },
    liveness: { serverInstanceId: id, activePlayers: players, playablePlayers: players, temporarilySealedPlayers: 0, encircledPlayers: 0,
      lastStandPlayers: 0, emergencyRecoveryEligiblePlayers: 0, invalidSoftlocks: 0 }, alliances: [],
    snapshot: { serverInstanceId: id, snapshotId: `${id}:snapshot`, createdAt: NOW, tick: 42, stateVersion: 3, schemaVersion: 1, stale: false },
    commands: Array.from({ length: commands }, (_, index) => ({ serverInstanceId: id, commandId: `${id}:command:${index}`, commandType: "collect-production",
      actorId: `${id}:player:0`, status: "recorded", receivedAt: NOW, tickAtReceive: index })), events: [], diagnostics: [] };
};
const success = (data) => ({ accepted: true, data, errors: [] });
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const failure = (route, status, code) => json(route, status, { accepted: false, data: null, errors: [{ code, message: "Admin session is unavailable." }] });
