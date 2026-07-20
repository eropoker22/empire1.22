// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError, type AdminApiClient } from "../../apps/admin/src/app/admin-monitoring-client";
import { createAdminApp } from "../../apps/admin/src/app/create-admin-app";
import { renderDashboard } from "../../apps/admin/src/app/read-only-admin-page";
import { resolveModeConfig } from "@empire/game-config";
import type { AdminInstanceDetailView, AdminInstanceSummaryView, AdminOverviewView, AdminSessionView } from "@empire/shared-types";

const session: AdminSessionView = {
  adminSessionId: "session:viewer", adminUserId: "user:viewer", actorId: "user:viewer", username: "viewer", displayName: "Viewer", role: "viewer",
  createdAt: "2026-07-16T10:00:00.000Z", expiresAt: "2026-07-16T10:30:00.000Z", revokedAt: null,
  lastSeenAt: "2026-07-16T10:00:00.000Z", authenticationMethod: "password"
};

describe("read-only admin app", () => {
  beforeEach(() => {
    document.body.innerHTML = `<main id="admin-dashboard-root"></main>`;
    history.replaceState(null, "", "/admin.html");
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("does not use the first server as an implicit detail selection", async () => {
    const client = createClient();
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();

    expect(client.getInstance).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Vyberte instanci");
    expect(location.search).toBe("");
  });

  it("requests only the explicitly selected instance", async () => {
    const client = createClient();
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();
    document.querySelector<HTMLElement>(`[data-admin-instance="server:B"]`)!.click();
    await vi.waitFor(() => expect(client.getInstance).toHaveBeenCalledWith("server:B", expect.any(AbortSignal)));
    await vi.waitFor(() => expect(document.body.textContent).toContain("Detail server:B"));
    expect(location.search).toBe("?instance=server%3AB");
    expect(document.body.textContent).not.toContain("Detail server:A");
  });

  it("does not let a late response from the previous selection overwrite the current detail", async () => {
    const pendingA = deferred<AdminInstanceDetailView>();
    const client = createClient();
    client.getInstance = vi.fn((id: string) => id === "server:A" ? pendingA.promise : Promise.resolve(detail(id)));
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();
    document.querySelector<HTMLElement>(`[data-admin-instance="server:A"]`)!.click();
    document.querySelector<HTMLElement>(`[data-admin-instance="server:B"]`)!.click();
    await vi.waitFor(() => expect(document.body.textContent).toContain("Detail server:B"));
    pendingA.resolve(detail("server:A"));
    await Promise.resolve();
    expect(document.body.textContent).toContain("Detail server:B");
    expect(document.body.textContent).not.toContain("Detail server:A");
  });

  it("clears the password input after login", async () => {
    const client = createClient();
    client.getSession = vi.fn().mockRejectedValue(new AdminApiError(401, "ADMIN_SESSION_REQUIRED", "Session required."));
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();
    const username = document.querySelector<HTMLInputElement>("[data-admin-username]")!;
    const input = document.querySelector<HTMLInputElement>("[data-admin-password]")!;
    username.value = "test-owner";
    input.value = "TestPassword-Only-For-Fixtures";
    document.querySelector<HTMLFormElement>("[data-admin-login]")!.requestSubmit();
    await vi.waitFor(() => expect(client.login).toHaveBeenCalledWith("test-owner", "TestPassword-Only-For-Fixtures"));
    expect(input.value).toBe("");
  });

  it("offers only the implemented closed policy during server creation", () => {
    document.body.innerHTML = renderDashboard({
      session: { ...session, role: "owner" },
      overview: overview(),
      selectedInstanceId: null,
      detail: null,
      controlPlane: {
        writesEnabled: true,
        provisioningEnabled: true,
        databaseAvailable: true,
        migrationsCurrent: true,
        workerStatus: "online",
        unavailableCode: null,
        servers: []
      },
      wizardOpen: true,
      wizardStep: 3
    });

    expect(document.querySelector('[name="joinPolicy"][value="closed"]')).not.toBeNull();
    expect(document.querySelector('[name="joinPolicy"][value="invite_only"]')).toBeNull();
    expect(document.querySelector<HTMLInputElement>('[name="joinPolicy"][value="open"]')?.disabled).toBe(true);
    expect(document.querySelector<HTMLOptionElement>('[name="mode"] [value="war"]')?.disabled).toBe(true);
    expect(document.querySelector<HTMLInputElement>('[name="capacity"]')?.min).toBe(String(
      resolveModeConfig("free").balance.finalLockdown!.triggerActivePlayers + 1
    ));
  });

  it("disables lifecycle controls until provisioning is ready", () => {
    document.body.innerHTML = renderDashboard({
      session: { ...session, role: "owner" }, overview: overview(), selectedInstanceId: "server:requested", detail: null,
      controlPlane: {
        writesEnabled: true, provisioningEnabled: true, databaseAvailable: true, migrationsCurrent: true,
        workerStatus: "online", unavailableCode: null, servers: [{
          serverInstanceId: "server:requested", displayName: "Requested", mode: "free", region: "eu-central",
          capacity: 20, status: "requested", joinPolicy: "closed", provisioningState: "requested",
          currentSnapshotId: null, runtimeLeaseOwnerId: null, runtimeLeaseExpiresAt: null,
          lastWorkerHeartbeatAt: null, lastErrorCode: null, createdAt: "2026-07-16T10:00:00.000Z",
          updatedAt: "2026-07-16T10:00:00.000Z", version: 1, committedPlayers: 0, reservedSlots: 0
        }]
      }, wizardOpen: false, wizardStep: 1
    });

    const actions = [...document.querySelectorAll<HTMLButtonElement>("[data-admin-lifecycle]")];
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((button) => button.disabled && button.getAttribute("aria-disabled") === "true")).toBe(true);
  });

});

const createClient = (): AdminApiClient => ({
  getSession: vi.fn().mockResolvedValue(session),
  login: vi.fn().mockResolvedValue(session),
  logout: vi.fn().mockResolvedValue(undefined),
  getOverview: vi.fn().mockResolvedValue(overview()),
  getInstance: vi.fn((id: string) => Promise.resolve(detail(id))),
  getControlPlane: vi.fn().mockResolvedValue({ writesEnabled: false, provisioningEnabled: false,
    databaseAvailable: false, migrationsCurrent: false, workerStatus: "offline", unavailableCode: "ADMIN_WRITES_DISABLED", servers: [] }),
  createServer: vi.fn(),
  requestLifecycleAction: vi.fn()
});

const summary = (id: string): AdminInstanceSummaryView => ({
  serverInstanceId: id, displayName: `Server ${id}`, mode: "free", region: "eu", capacity: 20,
  joinPolicy: "open", status: "running", currentTick: 10, stateVersion: 2, playerCount: id.endsWith("A") ? 2 : 5,
  workerStatus: "live", lastHeartbeatAt: "2026-07-16T10:00:00.000Z", leaseOwner: "worker:1",
  leaseExpiresAt: "2026-07-16T10:01:00.000Z", lastSnapshotAt: "2026-07-16T10:00:00.000Z",
  snapshotStale: false, lastErrorAt: null,
  freshness: { serverInstanceId: id, generatedAt: "2026-07-16T10:00:00.000Z", source: "durable-snapshot",
    dataAsOf: "2026-07-16T10:00:00.000Z", lastSnapshotAt: "2026-07-16T10:00:00.000Z",
    lastHeartbeatAt: "2026-07-16T10:00:00.000Z", stale: false, staleReason: null }
});
const overview = (): AdminOverviewView => ({
  generatedAt: "2026-07-16T10:00:00.000Z", databaseStatus: "available", instances: [summary("server:A"), summary("server:B")],
  counts: { known: 2, live: 2, stale: 0, offline: 0, noWorker: 0, failed: 0, running: 2, lobby: 0, paused: 0, players: 7 }
});
const detail = (id: string): AdminInstanceDetailView => ({
  serverInstanceId: id, generatedAt: "2026-07-16T10:00:00.000Z", summary: { ...summary(id), displayName: `Detail ${id}` },
  freshness: summary(id).freshness, runtimeAvailable: true, players: [], districts: [],
  economy: { serverInstanceId: id, totalCleanCash: 0, totalDirtyCash: 0, totalResources: {} },
  production: { serverInstanceId: id, productionBuildingCount: 0, readyToCollectCount: 0, activeCraftCount: 0, storageFullCount: 0 },
  police: { serverInstanceId: id, heatPressure: "none", maxPlayerHeat: 0, wantedPlayerCount: 0, pendingRaidCount: 0 },
  liveness: { serverInstanceId: id, activePlayers: 0, playablePlayers: 0, temporarilySealedPlayers: 0, encircledPlayers: 0,
    lastStandPlayers: 0, emergencyRecoveryEligiblePlayers: 0, invalidSoftlocks: 0 },
  alliances: [], snapshot: { serverInstanceId: id, snapshotId: null, createdAt: null, tick: null, stateVersion: null, schemaVersion: null, stale: false },
  commands: [], events: [], diagnostics: []
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
