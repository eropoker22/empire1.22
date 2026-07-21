// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError, type AdminApiClient } from "../../apps/admin/src/app/admin-monitoring-client";
import { createAdminApp } from "../../apps/admin/src/app/create-admin-app";
import { renderDashboard } from "../../apps/admin/src/app/read-only-admin-page";
import { FREE_HOSTED_SERVER_LIFECYCLE_POLICY, resolveModeConfig } from "@empire/game-config";
import type { AdminHostedServerView, AdminInstanceDetailView, AdminInstanceSummaryView, AdminOverviewView, AdminSessionView } from "@empire/shared-types";

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

  it("keeps the login form available when the initial admin API probe is unavailable", async () => {
    const client = createClient();
    client.getSession = vi.fn().mockRejectedValue(new AdminApiError(
      503,
      "ADMIN_CONFIGURATION_UNAVAILABLE",
      "Admin durable repository is unavailable."
    ));

    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();

    expect(document.querySelector("[data-admin-login]")).not.toBeNull();
    expect(document.querySelector("[data-admin-username]")).not.toBeNull();
    expect(document.querySelector("[data-admin-password]")).not.toBeNull();
    expect(document.body.textContent).toContain("Admin API momentálně není připojené k databázi");
    expect(document.body.textContent).not.toContain("ADMIN SERVER NEDOSTUPNÝ");
  });

  it("explains missing production database configuration after a login attempt", async () => {
    const client = createClient();
    client.getSession = vi.fn().mockRejectedValue(new AdminApiError(401, "ADMIN_SESSION_REQUIRED", "Session required."));
    client.login = vi.fn().mockRejectedValue(new AdminApiError(
      503,
      "ADMIN_CONFIGURATION_UNAVAILABLE",
      "Admin durable repository is unavailable."
    ));
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();

    document.querySelector<HTMLInputElement>("[data-admin-username]")!.value = "owner";
    document.querySelector<HTMLInputElement>("[data-admin-password]")!.value = "password";
    document.querySelector<HTMLFormElement>("[data-admin-login]")!.requestSubmit();

    await vi.waitFor(() => expect(document.querySelector("[data-admin-login-error]")?.textContent)
      .toContain("EMPIRE_DATABASE_URL"));
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
        servers: [],
        generatedAt: "2026-07-16T10:00:00.000Z"
      },
      wizardOpen: true,
      wizardStep: 3
    });

    expect(document.querySelector<HTMLInputElement>('[name="joinPolicy"][value="closed"]')?.type).toBe("hidden");
    expect(document.querySelector('[name="joinPolicy"][value="invite_only"]')).toBeNull();
    expect(document.querySelector('[name="joinPolicy"][value="open"]')).toBeNull();
    expect(document.querySelector<HTMLOptionElement>('[name="mode"] [value="war"]')?.disabled).toBe(true);
    expect(document.querySelector<HTMLInputElement>('[name="capacity"]')?.min)
      .toBe(String(FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart));
    expect(document.querySelector<HTMLSelectElement>('[name="serverTemplate"]')?.value).toBe("control");
    expect(document.body.textContent).toContain("Kontrolní test · 2–20 hráčů · bez Očisty");
    expect(document.body.textContent).toContain("Plnohodnotný server · 20 hráčů · canonical Očista");
    expect(document.body.textContent).toContain("Minimum ke spuštění");
    expect(document.body.textContent).toContain("60 minut");
    expect(document.querySelector<HTMLInputElement>('[name="capacity"]')?.value)
      .toBe(String(FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart));
  });

  it("locks full template capacity without exposing raw elimination balance", async () => {
    const owner = { ...session, role: "owner" as const };
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue(owner);
    client.getControlPlane = vi.fn().mockResolvedValue({ ...controlPlane(hostedServer()), servers: [] });
    client.createServer = vi.fn().mockResolvedValue({ replayed: false, server: hostedServer({ serverInstanceId: "server:full" }), provisioningJobId: "job:full" });
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();
    document.querySelector<HTMLButtonElement>("[data-admin-create-open]")!.click();

    const template = document.querySelector<HTMLSelectElement>("[data-admin-server-template]")!;
    const capacity = document.querySelector<HTMLInputElement>("[data-admin-server-capacity]")!;
    template.value = "full";
    template.dispatchEvent(new Event("change", { bubbles: true }));
    expect(capacity.value).toBe(String(resolveModeConfig("free").balance.maxPlayersPerServer));
    expect(capacity.readOnly).toBe(true);
    expect(document.querySelector('[name="eliminationInterval"]')).toBeNull();
    expect(document.querySelector('[name="finalLockdownTrigger"]')).toBeNull();

    template.value = "control";
    template.dispatchEvent(new Event("change", { bubbles: true }));
    expect(capacity.value).toBe(String(FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart));
    expect(capacity.readOnly).toBe(false);

    template.value = "full";
    template.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector<HTMLInputElement>('[name="displayName"]')!.value = "Plný alpha server";
    document.querySelector<HTMLFormElement>("[data-admin-create-form]")!.requestSubmit();
    await vi.waitFor(() => expect(client.createServer).toHaveBeenCalled());
    const payload = vi.mocked(client.createServer).mock.calls[0]![0];
    expect(payload).toMatchObject({ serverTemplate: "full", capacity: resolveModeConfig("free").balance.maxPlayersPerServer, joinPolicy: "closed" });
    expect(payload).not.toHaveProperty("eliminationInterval");
    expect(payload).not.toHaveProperty("finalLockdownTrigger");
  });

  it("disables lifecycle controls until provisioning is ready", () => {
    document.body.innerHTML = renderDashboard({
      session: { ...session, role: "owner" }, overview: overview(), selectedInstanceId: "server:requested", detail: null,
      controlPlane: {
        writesEnabled: true, provisioningEnabled: true, databaseAvailable: true, migrationsCurrent: true,
        workerStatus: "online", unavailableCode: null, generatedAt: "2026-07-16T10:00:00.000Z",
        servers: [hostedServer({ serverInstanceId: "server:requested", displayName: "Requested",
          status: "requested", provisioningState: "requested", currentSnapshotId: null,
          lastWorkerHeartbeatAt: null, runtimeLeaseOwnerId: null, runtimeLeaseExpiresAt: null })]
      }, wizardOpen: false, wizardStep: 1
    });

    const actions = [...document.querySelectorAll<HTMLButtonElement>("[data-admin-lifecycle]")];
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((button) => button.disabled && button.getAttribute("aria-disabled") === "true")).toBe(true);
  });

  it("uses the authoritative ready count and canStart flag", () => {
    document.body.innerHTML = renderHosted(hostedServer({ readyPlayers: 1, canStart: false,
      startDisabledReason: "Server potřebuje alespoň 2 aktivní hráče." }));
    expect(document.body.textContent).toContain("1 / 2");
    expect(document.body.textContent).toContain("BLOKOVÁNO");
    expect(document.querySelector<HTMLButtonElement>('[data-admin-lifecycle="start"]')?.disabled).toBe(true);

    document.body.innerHTML = renderHosted(hostedServer({ readyPlayers: 2, canStart: true, startDisabledReason: null }));
    expect(document.body.textContent).toContain("2 / 2");
    expect(document.body.textContent).toContain("PŘIPRAVENO");
    expect(document.querySelector<HTMLButtonElement>('[data-admin-lifecycle="start"]')?.disabled).toBe(false);
  });

  it("sends only registrationOpensAt when scheduling", async () => {
    history.replaceState(null, "", "/admin.html?instance=server%3Aregistration");
    const owner = { ...session, role: "owner" as const };
    const server = hostedServer({ serverInstanceId: "server:registration", displayName: "Registration" });
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue(owner);
    client.getControlPlane = vi.fn().mockResolvedValue(controlPlane(server));
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();

    const opensAt = document.querySelector<HTMLInputElement>("[data-admin-registration-opens-at]")!;
    opensAt.value = "2026-07-18T18:00";
    opensAt.dispatchEvent(new Event("input", { bubbles: true }));
    const reason = document.querySelector<HTMLInputElement>("[data-admin-action-reason]")!;
    reason.value = "První closed alpha test";
    document.querySelector<HTMLButtonElement>('[data-admin-registration-action="schedule-registration"]')!.click();

    await vi.waitFor(() => expect(client.requestLifecycleAction).toHaveBeenCalled());
    const payload = vi.mocked(client.requestLifecycleAction).mock.calls[0]![1];
    expect(payload).toMatchObject({ action: "schedule-registration", expectedVersion: server.version,
      reason: "První closed alpha test", registrationOpensAt: new Date("2026-07-18T18:00").toISOString() });
    expect(payload).not.toHaveProperty("registrationClosesAt");
  });

});

const createClient = (): AdminApiClient => ({
  getSession: vi.fn().mockResolvedValue(session),
  login: vi.fn().mockResolvedValue(session),
  logout: vi.fn().mockResolvedValue(undefined),
  getOverview: vi.fn().mockResolvedValue(overview()),
  getInstance: vi.fn((id: string) => Promise.resolve(detail(id))),
  getControlPlane: vi.fn().mockResolvedValue({ writesEnabled: false, provisioningEnabled: false,
    databaseAvailable: false, migrationsCurrent: false, workerStatus: "offline", unavailableCode: "ADMIN_WRITES_DISABLED",
    servers: [], generatedAt: "2026-07-16T10:00:00.000Z" }),
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

const hostedServer = (overrides: Partial<AdminHostedServerView> = {}): AdminHostedServerView => ({
  serverInstanceId: "server:ready", displayName: "Ready", mode: "free", serverTemplate: "full", region: "eu-central", capacity: 20,
  status: "lobby", joinPolicy: "closed", provisioningState: "ready", minimumReadyPlayersToStart: 2,
  registrationWindowMinutes: 60, registrationScheduleVersion: 0, registrationOpensAt: null,
  registrationClosesAt: null, registrationClosedAt: null, registrationBaselinePlayers: null,
  canonicalFinalLockdownTrigger: 8, canonicalFirstEliminationTick: 720, canonicalTickRateMs: 10_000,
  effectiveFinalLockdownTrigger: null, effectiveFirstEliminationTick: null, currentSnapshotId: "snapshot:ready",
  runtimeLeaseOwnerId: "worker:ready", runtimeLeaseExpiresAt: "2026-07-16T10:01:00.000Z",
  lastWorkerHeartbeatAt: "2026-07-16T10:00:00.000Z", lastErrorCode: null, createdAt: "2026-07-16T10:00:00.000Z",
  updatedAt: "2026-07-16T10:00:00.000Z", version: 3, committedPlayers: 0, reservedSlots: 0,
  readyPlayers: 0, registrationState: "not_scheduled", registrationRemainingMs: 0,
  registrationReasonCode: "SERVER_REGISTRATION_NOT_SCHEDULED", canStart: false,
  startDisabledReason: "Registrace na server ještě nezačala.", joinable: false,
  disabledReason: "SERVER_REGISTRATION_NOT_SCHEDULED", ...overrides
});

const controlPlane = (server: AdminHostedServerView) => ({
  writesEnabled: true, provisioningEnabled: true, databaseAvailable: true, migrationsCurrent: true,
  workerStatus: "online" as const, unavailableCode: null, servers: [server], generatedAt: "2026-07-16T10:00:00.000Z"
});

const renderHosted = (server: AdminHostedServerView): string => renderDashboard({
  session: { ...session, role: "owner" }, overview: overview(), selectedInstanceId: server.serverInstanceId,
  detail: null, controlPlane: controlPlane(server), wizardOpen: false, wizardStep: 1
});
