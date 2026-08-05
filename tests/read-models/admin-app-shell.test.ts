// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError, type AdminApiClient } from "../../apps/admin/src/app/admin-monitoring-client";
import { createAdminApp } from "../../apps/admin/src/app/create-admin-app";
import { renderDashboard, renderUnavailable } from "../../apps/admin/src/app/read-only-admin-page";
import {
  FREE_HOSTED_SERVER_LIFECYCLE_POLICY,
  FREE_HOSTED_STARTING_MATERIAL_IDS,
  FREE_HOSTED_STARTING_PLAYER_STATE,
  resolveModeConfig
} from "@empire/game-config";
import type { AdminHostedServerView, AdminInstanceDetailView, AdminInstanceSummaryView, AdminOverviewView, AdminSessionView } from "@empire/shared-types";

const BUILD_SHA = "admin-test-build";
const session: AdminSessionView = {
  adminSessionId: "session:viewer", adminUserId: "user:viewer", actorId: "user:viewer", username: "viewer", displayName: "Viewer", role: "viewer",
  createdAt: "2026-07-16T10:00:00.000Z", expiresAt: "2026-07-16T10:30:00.000Z", revokedAt: null,
  lastSeenAt: "2026-07-16T10:00:00.000Z", authenticationMethod: "password"
};

describe("read-only admin app", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    document.head.innerHTML = `<meta name="empire-build-sha" content="${BUILD_SHA}">`;
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

  it("prioritizes system health, server operations, and collapsible diagnostics", () => {
    const server = hostedServer({ serverInstanceId: "server:A", status: "running", provisioningState: "ready" });
    document.body.innerHTML = renderDashboard({
      session: { ...session, role: "owner" },
      overview: overview(),
      selectedInstanceId: "server:A",
      detail: detail("server:A"),
      controlPlane: controlPlane(server),
      wizardOpen: false,
      wizardStep: 1,
      frontendBuildSha: BUILD_SHA
    });

    expect(document.querySelector("[data-admin-system-health]")).not.toBeNull();
    expect(document.querySelector("#admin-overview")?.textContent).toContain("Systém je připraven");
    expect(document.querySelector(".admin-command-metrics")?.textContent).toContain("Běžící servery");
    expect(document.querySelector(".admin-operations-workspace #admin-servers")).not.toBeNull();
    expect(document.querySelector(".admin-operations-workspace #admin-control-plane")).not.toBeNull();
    expect(document.querySelector("#admin-snapshots")).toBeInstanceOf(HTMLDetailsElement);
    expect(document.querySelector("#admin-players")?.hasAttribute("open")).toBe(true);
    expect(document.querySelector("#admin-commands")?.hasAttribute("open")).toBe(false);
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

  it("renders recovery head, checkpoint retention, and cleanup health metadata", () => {
    document.body.innerHTML = renderDashboard({
      session,
      overview: overview(),
      selectedInstanceId: "server:A",
      detail: detail("server:A"),
      controlPlane: null,
      wizardOpen: false,
      wizardStep: 1
    });

    expect(document.querySelector("#admin-snapshots")?.textContent).toContain("Recovery head tick42");
    expect(document.querySelector("#admin-snapshots")?.textContent).toContain("Recovery head root version77");
    expect(document.querySelector("#admin-snapshots")?.textContent).toContain("Rolling checkpoints24");
    expect(document.querySelector("#admin-snapshots")?.textContent).toContain("Lifecycle checkpoints3");
    expect(document.querySelector("#admin-snapshots")?.textContent).toContain("Terminal checkpoints1");
    expect(document.querySelector("#admin-snapshots")?.textContent).toContain("Cleanup statussuccess");
    expect(document.querySelector("#admin-snapshots")?.textContent).toContain("Storage healthhealthy");
  });

  it("separates global worker health from selected server runtime evidence", () => {
    const server = hostedServer({
      serverInstanceId: "server:A",
      status: "running",
      provisioningState: "ready",
      currentSnapshotId: "snapshot:lifecycle-marker"
    });
    document.body.innerHTML = renderDashboard({
      session: { ...session, role: "owner" },
      overview: overview(),
      selectedInstanceId: "server:A",
      detail: detail("server:A"),
      controlPlane: controlPlane(server),
      wizardOpen: false,
      wizardStep: 1,
      frontendBuildSha: BUILD_SHA
    });

    expect(document.querySelector("#admin-control-plane")?.textContent).toContain("Global workerONLINE");
    expect(document.querySelector("#admin-control-plane")?.textContent)
      .toContain("Lifecycle snapshot markersnapshot:lifecycle-marker");
    expect(document.querySelector('[data-admin-runtime-check="runtime-active"]')?.textContent)
      .toContain("Server runtime activePASS");
    expect(document.querySelector('[data-admin-runtime-check="tick-advancing"]')?.textContent)
      .toContain("Server tick advancingPASS");
    expect(document.querySelector('[data-admin-runtime-check="snapshot-current"]')?.textContent)
      .toContain("Server snapshot currentPASS");
    expect(document.querySelector('[data-admin-runtime-check="commands-accepted"]')?.textContent)
      .toContain("Recent server command acceptedPASS");
  });

  it.each(["lobby", "paused", "stopped", "archived"])(
    "does not raise runtime or storage alerts for an inactive %s server",
    (status) => {
      const inactiveSummary: AdminInstanceSummaryView = {
        ...summary("server:A"),
        status,
        workerStatus: "offline",
        snapshotStale: true,
        freshness: {
          ...summary("server:A").freshness,
          stale: true,
          staleReason: "historical-snapshot"
        }
      };
      const inactiveDetail: AdminInstanceDetailView = {
        ...detail("server:A"),
        summary: inactiveSummary,
        freshness: inactiveSummary.freshness,
        snapshot: {
          ...detail("server:A").snapshot,
          stale: true,
          storageHealth: "attention"
        }
      };
      const inactiveOverview: AdminOverviewView = {
        ...overview(),
        instances: [inactiveSummary],
        runtimeWorkers: { expected: 0, live: 0, stale: 0, offline: 0, noWorker: 0 },
        counts: {
          known: 1,
          live: 0,
          stale: 0,
          offline: 1,
          noWorker: 0,
          failed: 0,
          running: 0,
          lobby: status === "lobby" ? 1 : 0,
          paused: status === "paused" ? 1 : 0,
          players: inactiveSummary.playerCount
        }
      };
      document.body.innerHTML = renderDashboard({
        session: { ...session, role: "owner" },
        overview: inactiveOverview,
        selectedInstanceId: inactiveSummary.serverInstanceId,
        detail: inactiveDetail,
        controlPlane: controlPlane(hostedServer()),
        wizardOpen: false,
        wizardStep: 1,
        frontendBuildSha: BUILD_SHA
      });

      const operations = document.querySelector("#admin-alerts")?.textContent ?? "";
      expect(operations).not.toContain("Instance bez čerstvého workeru");
      expect(operations).not.toContain("Vybraný detail je stale");
      expect(operations).not.toContain("Snapshot storage není healthy");
      expect(document.querySelector(".admin-command-metrics")?.textContent).toMatch(/Stav serverů\s*0/u);
    }
  );

  it("keeps worker, freshness, and storage alerts active for a running server", () => {
    const runningSummary: AdminInstanceSummaryView = {
      ...summary("server:A"),
      workerStatus: "offline",
      snapshotStale: true,
      freshness: {
        ...summary("server:A").freshness,
        stale: true,
        staleReason: "snapshot-stale"
      }
    };
    const runningDetail: AdminInstanceDetailView = {
      ...detail("server:A"),
      summary: runningSummary,
      freshness: runningSummary.freshness,
      snapshot: {
        ...detail("server:A").snapshot,
        stale: true,
        storageHealth: "attention"
      }
    };
    const runningOverview: AdminOverviewView = {
      ...overview(),
      instances: [runningSummary],
      runtimeWorkers: { expected: 1, live: 0, stale: 0, offline: 1, noWorker: 0 },
      counts: {
        known: 1,
        live: 0,
        stale: 0,
        offline: 1,
        noWorker: 0,
        failed: 0,
        running: 1,
        lobby: 0,
        paused: 0,
        players: runningSummary.playerCount
      }
    };
    document.body.innerHTML = renderDashboard({
      session: { ...session, role: "owner" },
      overview: runningOverview,
      selectedInstanceId: runningSummary.serverInstanceId,
      detail: runningDetail,
      controlPlane: controlPlane(hostedServer({ status: "running" })),
      wizardOpen: false,
      wizardStep: 1,
      frontendBuildSha: BUILD_SHA
    });

    const operations = document.querySelector("#admin-alerts")?.textContent ?? "";
    expect(operations).toContain("Instance bez čerstvého workeru");
    expect(operations).toContain("Vybraný detail je stale");
    expect(operations).toContain("Snapshot storage není healthy");
    expect(document.querySelector(".admin-command-metrics")?.textContent).toMatch(/Stav serverů\s*1/u);
  });

  it("does not let a late response from the previous selection overwrite the current detail", async () => {
    const pendingA = deferred<AdminInstanceDetailView>();
    const client = createClient();
    client.getInstance = vi.fn((id: string, signal?: AbortSignal) => id === "server:A"
      ? rejectOnAbort(pendingA.promise, signal)
      : Promise.resolve(detail(id)));
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

  it("escapes unavailable diagnostics instead of rendering injected markup", () => {
    document.body.innerHTML = renderUnavailable('<img src=x onerror="throw new Error(1)">');
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).toContain("<img src=x");
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
        buildCompatibility: "current",
        unavailableCode: null,
        apiBuildSha: BUILD_SHA,
        workerBuildSha: BUILD_SHA,
        servers: [],
        generatedAt: "2026-07-16T10:00:00.000Z"
      },
      wizardOpen: true,
      wizardStep: 3,
      frontendBuildSha: BUILD_SHA
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
    expect(document.querySelector<HTMLInputElement>('[name="startingCleanCash"]')?.value).toBe("1500");
    expect(document.querySelector<HTMLInputElement>('[name="startingDirtyCash"]')?.value).toBe("300");
    expect(document.querySelector<HTMLInputElement>('[name="startingPopulation"]')?.value).toBe("0");
    expect(document.querySelector<HTMLInputElement>('[name="startingInfluence"]')?.value).toBe("0");
    expect(document.querySelector<HTMLInputElement>('[name="startingMaterial:chemicals"]')?.value).toBe("10");
    expect(document.querySelector<HTMLInputElement>('[name="startingMaterial:pistol"]')?.value).toBe("2");
    expect(document.body.textContent).toContain("Každý hráč má vždy přesně 2 špionážní sloty.");
    expect(document.querySelector<HTMLInputElement>('[name="capacity"]')?.value)
      .toBe(String(FREE_HOSTED_SERVER_LIFECYCLE_POLICY.minimumReadyPlayersToStart));
  });

  it("distinguishes a ready account platform from undeployed game hosting", () => {
    document.body.innerHTML = renderDashboard({
      session: { ...session, role: "owner" },
      overview: overview(),
      selectedInstanceId: null,
      detail: null,
      controlPlane: {
        writesEnabled: false,
        provisioningEnabled: false,
        databaseAvailable: true,
        migrationsCurrent: true,
        workerStatus: "offline",
        buildCompatibility: "current",
        sessionSecurity: "current",
        originPolicy: "current",
        registrationEnabled: false,
        unavailableCode: "ADMIN_WRITES_DISABLED",
        apiBuildSha: BUILD_SHA,
        workerBuildSha: null,
        schemaVersion: "015_account_age_requirement.sql",
        servers: [],
        generatedAt: "2026-07-16T10:00:00.000Z"
      },
      wizardOpen: false,
      wizardStep: 1,
      frontendBuildSha: BUILD_SHA
    });

    expect(document.body.textContent).toContain("Account platformREADY");
    expect(document.body.textContent).toContain("Game hostingDISABLED");
    expect(document.body.textContent).toContain("Herní worker není nasazený.");
    expect(document.querySelector("[data-admin-create-open]")).toBeNull();
  });

  it("allows placeholder frontend SHA only on explicit loopback development", () => {
    const server = hostedServer({ serverInstanceId: "server:local", status: "lobby", provisioningState: "ready" });
    const input = {
      session: { ...session, role: "owner" as const },
      overview: overview(),
      selectedInstanceId: "server:local",
      detail: null,
      controlPlane: controlPlane(server),
      wizardOpen: false,
      wizardStep: 1,
      frontendBuildSha: null
    };
    document.body.innerHTML = renderDashboard({ ...input, localDevelopment: false });
    expect(document.querySelector("[data-admin-create-open]")).toBeNull();
    expect(document.querySelector(".admin-lifecycle")).toBeNull();

    document.body.innerHTML = renderDashboard({ ...input, localDevelopment: true });
    expect(document.querySelector("[data-admin-create-open]")).not.toBeNull();
    expect(document.querySelector(".admin-lifecycle")).not.toBeNull();
    expect(document.body.textContent).toContain("LOCAL DEV");
  });

  it("locks full template capacity without exposing raw elimination balance", async () => {
    const owner = { ...session, role: "owner" as const };
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue(owner);
    client.getControlPlane = vi.fn().mockResolvedValue({ ...controlPlane(hostedServer()), servers: [] });
    client.createServer = vi.fn().mockResolvedValue({ replayed: false, server: hostedServer({ serverInstanceId: "server:full" }), provisioningJobId: "job:full" });
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();
    document.querySelector<HTMLButtonElement>("[data-admin-create-open]")!.click();
    await vi.waitFor(() => expect(document.activeElement)
      .toBe(document.querySelector<HTMLInputElement>('[name="displayName"]')));
    expect(document.querySelector("[role=dialog]")?.getAttribute("aria-modal")).toBe("true");

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
    expect(payload.startingPlayerState).toMatchObject({
      cleanCash: 1_500,
      dirtyCash: 300,
      population: 0,
      influence: 0,
      spySlots: 2,
      materials: {
        chemicals: 10,
        biomass: 6,
        "metal-parts": 8,
        "tech-core": 2,
        pistol: 2,
        smg: 1
      }
    });
    expect(payload).not.toHaveProperty("eliminationInterval");
    expect(payload).not.toHaveProperty("finalLockdownTrigger");
  });

  it("submits zero and every canonical starting material as exact numbers", async () => {
    const owner = { ...session, role: "owner" as const };
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue(owner);
    client.getControlPlane = vi.fn().mockResolvedValue({ ...controlPlane(hostedServer()), servers: [] });
    client.createServer = vi.fn().mockResolvedValue({
      replayed: false,
      server: hostedServer({ serverInstanceId: "server:distinctive-start" }),
      provisioningJobId: "job:distinctive-start"
    });
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();
    document.querySelector<HTMLButtonElement>("[data-admin-create-open]")!.click();

    document.querySelector<HTMLInputElement>('[name="displayName"]')!.value = "Distinctive starting state";
    document.querySelector<HTMLInputElement>('[name="startingCleanCash"]')!.value = "0";
    document.querySelector<HTMLInputElement>('[name="startingDirtyCash"]')!.value = "23456";
    document.querySelector<HTMLInputElement>('[name="startingPopulation"]')!.value = "345";
    document.querySelector<HTMLInputElement>('[name="startingInfluence"]')!.value = "456";
    const expectedMaterials = Object.fromEntries(
      FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId, index) => [materialId, index * 137])
    );
    for (const [materialId, amount] of Object.entries(expectedMaterials)) {
      document.querySelector<HTMLInputElement>(`[name="startingMaterial:${materialId}"]`)!.value = String(amount);
    }

    document.querySelector<HTMLFormElement>("[data-admin-create-form]")!.requestSubmit();
    await vi.waitFor(() => expect(client.createServer).toHaveBeenCalledTimes(1));
    const startingPlayerState = vi.mocked(client.createServer).mock.calls[0]![0].startingPlayerState!;

    expect(startingPlayerState).toEqual({
      cleanCash: 0,
      dirtyCash: 23_456,
      population: 345,
      influence: 456,
      spySlots: 2,
      materials: expectedMaterials
    });
    expect(Object.keys(startingPlayerState.materials)).toEqual(FREE_HOSTED_STARTING_MATERIAL_IDS);
    expect([
      startingPlayerState.cleanCash,
      startingPlayerState.dirtyCash,
      startingPlayerState.population,
      startingPlayerState.influence,
      ...Object.values(startingPlayerState.materials)
    ].every((value) => typeof value === "number" && Number.isSafeInteger(value))).toBe(true);
  });

  it("does not turn a missing starting material input into zero", async () => {
    const owner = { ...session, role: "owner" as const };
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue(owner);
    client.getControlPlane = vi.fn().mockResolvedValue({ ...controlPlane(hostedServer()), servers: [] });
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();
    document.querySelector<HTMLButtonElement>("[data-admin-create-open]")!.click();

    document.querySelector<HTMLInputElement>('[name="displayName"]')!.value = "Missing material input";
    document.querySelector<HTMLInputElement>('[name="startingMaterial:chemicals"]')!.remove();
    document.querySelector<HTMLFormElement>("[data-admin-create-form]")!.requestSubmit();
    await Promise.resolve();

    expect(client.createServer).not.toHaveBeenCalled();
    expect(document.querySelector("[data-admin-create-error]")?.textContent)
      .toBe("Počáteční stav hráče není kompletní nebo obsahuje neplatné číslo.");
  });

  it("closes the server wizard with Escape and restores trigger focus", async () => {
    const owner = { ...session, role: "owner" as const };
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue(owner);
    client.getControlPlane = vi.fn().mockResolvedValue({ ...controlPlane(hostedServer()), servers: [] });
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();

    document.querySelector<HTMLButtonElement>("[data-admin-create-open]")!.click();
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")!;
    const close = dialog.querySelector<HTMLButtonElement>("[data-admin-create-cancel]")!;
    const last = [...dialog.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])"
    )].filter((element) => !element.closest("[hidden]")).at(-1)!;
    close.focus();
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(close);
    const form = document.querySelector<HTMLFormElement>("[data-admin-create-form]")!;
    form.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector("[role=dialog]")).toBeNull());
    expect(document.activeElement).toBe(document.querySelector("[data-admin-create-open]"));
  });

  it("disables lifecycle controls until provisioning is ready", () => {
    document.body.innerHTML = renderDashboard({
      session: { ...session, role: "owner" }, overview: overview(), selectedInstanceId: "server:requested", detail: null,
      controlPlane: {
        writesEnabled: true, provisioningEnabled: true, databaseAvailable: true, migrationsCurrent: true,
        workerStatus: "online", buildCompatibility: "current", unavailableCode: null,
        apiBuildSha: BUILD_SHA, workerBuildSha: BUILD_SHA, generatedAt: "2026-07-16T10:00:00.000Z",
        servers: [hostedServer({ serverInstanceId: "server:requested", displayName: "Requested",
          status: "requested", provisioningState: "requested", currentSnapshotId: null,
          lastWorkerHeartbeatAt: null, runtimeLeaseOwnerId: null, runtimeLeaseExpiresAt: null })]
      }, wizardOpen: false, wizardStep: 1, frontendBuildSha: BUILD_SHA
    });

    const actions = [...document.querySelectorAll<HTMLButtonElement>("[data-admin-lifecycle]")];
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.filter((button) => button.dataset.adminLifecycle !== "delete")
      .every((button) => button.disabled && button.getAttribute("aria-disabled") === "true")).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-admin-lifecycle="delete"]')?.disabled).toBe(false);
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

  it("renders the persisted starting state from the selected server projection", () => {
    document.body.innerHTML = renderHosted(hostedServer({
      startingPlayerState: {
        cleanCash: 123_456,
        dirtyCash: 23_456,
        population: 345,
        influence: 456,
        spySlots: 2,
        materials: Object.fromEntries(
          Object.keys(FREE_HOSTED_STARTING_PLAYER_STATE.materials)
            .map((materialId, index) => [materialId, index * 11])
        ) as typeof FREE_HOSTED_STARTING_PLAYER_STATE.materials
      }
    }));

    const startingState = document.querySelector("[data-admin-starting-state]");
    expect(startingState?.textContent).toContain("Starting state uložený na serveru");
    expect(startingState?.textContent).toContain("Clean cash123456");
    expect(startingState?.textContent).toContain("Dirty cash23456");
    expect(startingState?.textContent).toContain("Populace345");
    expect(startingState?.textContent).toContain("Vliv456");
    expect(startingState?.textContent).toContain("Špehové2");
    expect(startingState?.textContent).toContain("Chemicals: 0");
    expect(startingState?.textContent).toContain("Alarm: 220");
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
    document.querySelector<HTMLButtonElement>('[data-admin-registration-action="schedule-registration"]')!.click();
    const dialog = document.querySelector<HTMLElement>("[data-admin-registration-dialog]")!;
    const reason = dialog.querySelector<HTMLTextAreaElement>("[data-admin-registration-reason]")!;
    dialog.querySelector<HTMLButtonElement>("[data-admin-registration-confirm]")!.click();
    expect(document.activeElement).toBe(reason);
    expect(client.requestLifecycleAction).not.toHaveBeenCalled();
    reason.value = "První closed alpha test";
    reason.dispatchEvent(new Event("input", { bubbles: true }));
    dialog.querySelector<HTMLButtonElement>("[data-admin-registration-confirm]")!.click();

    await vi.waitFor(() => expect(client.requestLifecycleAction).toHaveBeenCalled());
    const payload = vi.mocked(client.requestLifecycleAction).mock.calls[0]![1];
    expect(payload).toMatchObject({ action: "schedule-registration", expectedVersion: server.version,
      reason: "První closed alpha test", registrationOpensAt: new Date("2026-07-18T18:00").toISOString() });
    expect(payload).not.toHaveProperty("registrationClosesAt");
  });

  it("loads owner audit once, renders it, and refreshes it only on explicit request", async () => {
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue({ ...session, role: "owner" });
    client.getAudit = vi.fn().mockResolvedValue([{
      id: "audit:1", adminSessionId: "session:viewer", actorId: "user:owner", role: "owner",
      action: "server-started", targetInstanceId: "server:A", result: "success",
      createdAt: "2026-07-16T10:00:00.000Z", correlationId: "request:audit"
    }]);
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await app.mount();

    expect(client.getAudit).toHaveBeenCalledTimes(1);
    expect(document.querySelector("#admin-audit")?.textContent).toContain("server-started");
    await app.refresh();
    expect(client.getAudit).toHaveBeenCalledTimes(1);

    document.querySelector<HTMLButtonElement>("[data-admin-audit-refresh]")!.click();
    await vi.waitFor(() => expect(client.getAudit).toHaveBeenCalledTimes(2));
    app.destroy();
  });

  it("never requests owner audit for a viewer", async () => {
    const client = createClient();
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await app.mount();

    expect(client.getAudit).not.toHaveBeenCalled();
    expect(document.querySelector("#admin-audit")).toBeNull();
    app.destroy();
  });

  it("renders alliance and operational player/district fields", () => {
    const current = detail("server:A");
    current.players = [{
      serverInstanceId: "server:A", playerId: "player:1", displayName: "Neon Boss", factionId: "faction:red",
      status: "active", homeDistrictId: "district:home", ownedDistrictCount: 3, cash: 1200, dirtyCash: 450,
      population: 900, heat: 71, wantedLevel: 4, lastActionAt: "2026-07-16T10:00:00.000Z"
    }];
    current.districts = [{
      serverInstanceId: "server:A", districtId: "district:home", name: "Neon Yard", zone: "industrial",
      status: "contested", ownerPlayerId: "player:1", influence: 88, heat: 50, buildingCount: 4
    }];
    current.alliances = [{ serverInstanceId: "server:A", allianceId: "alliance:neon", memberCount: 6 }];
    document.body.innerHTML = renderDashboard({
      session, overview: overview(), selectedInstanceId: "server:A", detail: current,
      controlPlane: null, wizardOpen: false, wizardStep: 1
    });

    expect(document.querySelector("#admin-players")?.textContent).toContain("450 dirty");
    expect(document.querySelector("#admin-players")?.textContent).toContain("wanted 4");
    expect(document.querySelector("#admin-map")?.textContent).toContain("Influence");
    expect(document.querySelector("#admin-alliances")?.textContent).toContain("alliance:neon");
  });

  it("filters all operational tables without changing the underlying read model", async () => {
    const client = createClient();
    const filteredOverview = overview();
    filteredOverview.instances[1] = { ...filteredOverview.instances[1]!, status: "paused" };
    client.getOverview = vi.fn().mockResolvedValue(filteredOverview);
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await app.mount();
    const search = document.querySelector<HTMLInputElement>("[data-admin-search]")!;
    search.value = "server b";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    const rowA = document.querySelector<HTMLTableRowElement>('[data-admin-instance="server:A"]')!.closest("tr")!;
    const rowB = document.querySelector<HTMLTableRowElement>('[data-admin-instance="server:B"]')!.closest("tr")!;
    expect(rowA.hidden).toBe(true);
    expect(rowB.hidden).toBe(false);
    expect(document.querySelector("[data-admin-server-visible-count]")?.textContent).toBe("1");

    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const status = document.querySelector<HTMLSelectElement>('[data-admin-server-filter="status"]')!;
    status.value = "paused";
    status.dispatchEvent(new Event("change", { bubbles: true }));
    expect(rowA.hidden).toBe(true);
    expect(rowB.hidden).toBe(false);

    await app.refresh();
    const refreshedStatus = document.querySelector<HTMLSelectElement>('[data-admin-server-filter="status"]')!;
    expect(refreshedStatus.value).toBe("paused");
    expect(document.querySelector<HTMLTableRowElement>('[data-admin-instance="server:A"]')!.closest("tr")!.hidden).toBe(true);

    document.querySelector<HTMLButtonElement>("[data-admin-filter-reset]")!.click();
    expect(document.querySelector<HTMLInputElement>("[data-admin-search]")!.value).toBe("");
    expect(refreshedStatus.value).toBe("all");
    expect(document.querySelector<HTMLTableRowElement>('[data-admin-instance="server:A"]')!.closest("tr")!.hidden).toBe(false);
    expect(document.querySelector<HTMLTableRowElement>('[data-admin-instance="server:B"]')!.closest("tr")!.hidden).toBe(false);
    expect(client.getOverview).toHaveBeenCalledTimes(2);
    app.destroy();
  });

  it("keeps inactive servers in a separate registry tab", async () => {
    const client = createClient();
    const filteredOverview = overview();
    filteredOverview.instances[1] = { ...filteredOverview.instances[1]!, status: "failed", workerStatus: "offline" };
    client.getOverview = vi.fn().mockResolvedValue(filteredOverview);
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await app.mount();

    const activeRow = document.querySelector<HTMLTableRowElement>('[data-admin-instance="server:A"]')!.closest("tr")!;
    const failedRow = document.querySelector<HTMLTableRowElement>('[data-admin-instance="server:B"]')!.closest("tr")!;
    expect(activeRow.hidden).toBe(false);
    expect(failedRow.hidden).toBe(true);

    document.querySelector<HTMLButtonElement>('[data-admin-server-scope="inactive"]')!.click();
    expect(activeRow.hidden).toBe(true);
    expect(failedRow.hidden).toBe(false);
    expect(document.querySelector('[data-admin-server-scope="inactive"]')?.getAttribute("aria-selected")).toBe("true");
    app.destroy();
  });

  it("preserves open disclosures and page scroll across refresh renders", async () => {
    const client = createClient();
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await app.mount();
    const systemNav = document.querySelectorAll<HTMLDetailsElement>(".admin-nav__disclosure")[1]!;
    systemNav.open = true;
    Object.defineProperty(window, "scrollX", { configurable: true, value: 12 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 420 });

    await app.refresh();

    expect(document.querySelectorAll<HTMLDetailsElement>(".admin-nav__disclosure")[1]?.open).toBe(true);
    expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 12, top: 420, behavior: "auto" });
    app.destroy();
  });

  it("renders write controls according to the authenticated role", () => {
    const server = hostedServer({ status: "running", provisioningState: "ready" });
    const common = {
      overview: overview(), selectedInstanceId: server.serverInstanceId, detail: null,
      controlPlane: controlPlane(server), wizardOpen: false, wizardStep: 1, frontendBuildSha: BUILD_SHA
    };

    document.body.innerHTML = renderDashboard({ ...common, session });
    expect(document.querySelector("[data-admin-create-open]")).toBeNull();
    expect(document.querySelector("[data-admin-lifecycle]")).toBeNull();

    document.body.innerHTML = renderDashboard({ ...common, session: { ...session, role: "operator" } });
    expect(document.querySelector("[data-admin-create-open]")).not.toBeNull();
    expect(document.querySelector('[data-admin-lifecycle="pause"]')).not.toBeNull();
    expect(document.querySelector('[data-admin-lifecycle="stop"]')).toBeNull();

    document.body.innerHTML = renderDashboard({ ...common, session: { ...session, role: "owner" } });
    expect(document.querySelector('[data-admin-lifecycle="stop"]')).not.toBeNull();
  });

  it("keeps the last confirmed dashboard visible when a refresh fails", async () => {
    const client = createClient();
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await app.mount();
    client.getOverview = vi.fn().mockRejectedValue(new Error("database temporarily unavailable"));

    await app.refresh();

    expect(document.body.textContent).toContain("Server server:A");
    expect(document.querySelector("#admin-alerts")?.textContent).toContain("Obnova dat selhala");
    expect(document.querySelector("[data-admin-refresh-state]")?.getAttribute("data-state")).toBe("backoff");
    app.destroy();
  });

  it("restores control focus after a polling render", async () => {
    const client = createClient();
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await app.mount();
    document.querySelector<HTMLButtonElement>("[data-admin-nav-toggle]")!.focus();

    await app.refresh();

    expect(document.activeElement).toBe(document.querySelector("[data-admin-nav-toggle]"));
    app.destroy();
  });

  it("does not replace a focused lifecycle draft during polling", async () => {
    history.replaceState(null, "", "/admin.html?instance=server%3Aregistration");
    const server = hostedServer({ serverInstanceId: "server:registration", status: "running", provisioningState: "ready" });
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue({ ...session, role: "owner" });
    client.getControlPlane = vi.fn().mockResolvedValue(controlPlane(server));
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await app.mount();
    document.querySelector<HTMLButtonElement>('[data-admin-lifecycle="pause"]')!.click();
    const reason = document.querySelector<HTMLTextAreaElement>("[data-admin-action-reason]")!;
    reason.focus();
    reason.value = "Bezpečný provozní důvod";
    reason.dispatchEvent(new Event("input", { bubbles: true }));

    await app.refresh();
    expect(document.activeElement).toBe(reason);
    expect(reason.value).toBe("Bezpečný provozní důvod");
    expect(document.querySelector("[data-admin-lifecycle-dialog]")).not.toBeNull();
    app.destroy();
  });

  it("requires a lifecycle reason and prevents duplicate submit", async () => {
    history.replaceState(null, "", "/admin.html?instance=server%3Arunning");
    const server = hostedServer({ serverInstanceId: "server:running", status: "running", provisioningState: "ready" });
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue({ ...session, role: "owner" });
    client.getControlPlane = vi.fn().mockResolvedValue(controlPlane(server));
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();

    document.querySelector<HTMLButtonElement>('[data-admin-lifecycle="pause"]')!.click();
    const dialog = document.querySelector<HTMLElement>("[data-admin-lifecycle-dialog]")!;
    const reason = dialog.querySelector<HTMLTextAreaElement>("[data-admin-action-reason]")!;
    const confirm = dialog.querySelector<HTMLButtonElement>("[data-admin-lifecycle-confirm]")!;
    confirm.click();
    expect(client.requestLifecycleAction).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(reason);

    reason.value = "Plánovaná provozní pauza";
    reason.dispatchEvent(new Event("input", { bubbles: true }));
    confirm.click();
    confirm.click();
    await vi.waitFor(() => expect(client.requestLifecycleAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(client.requestLifecycleAction).mock.calls[0]![1]).toMatchObject({
      action: "pause",
      expectedVersion: server.version,
      reason: "Plánovaná provozní pauza"
    });
  });

  it("requires the exact server name before archive submit", async () => {
    history.replaceState(null, "", "/admin.html?instance=server%3Arunning");
    const server = hostedServer({ serverInstanceId: "server:running", displayName: "Server ke smazání",
      status: "running", provisioningState: "ready" });
    const client = createClient();
    client.getSession = vi.fn().mockResolvedValue({ ...session, role: "owner" });
    client.getControlPlane = vi.fn().mockResolvedValue(controlPlane(server));
    client.requestLifecycleAction = vi.fn().mockResolvedValue({
      replayed: false, actionRequestId: "hosted-archive:test", serverInstanceId: server.serverInstanceId,
      action: "delete", status: "completed", expectedVersion: server.version
    });
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();

    document.querySelector<HTMLButtonElement>('[data-admin-lifecycle="delete"]')!.click();
    const dialog = document.querySelector<HTMLElement>("[data-admin-lifecycle-dialog]")!;
    const reason = dialog.querySelector<HTMLTextAreaElement>("[data-admin-action-reason]")!;
    const confirmation = dialog.querySelector<HTMLInputElement>("[data-admin-delete-confirmation]")!;
    reason.value = "Odstranění nefunkční instance";
    confirmation.value = "špatně";
    dialog.querySelector<HTMLButtonElement>("[data-admin-lifecycle-confirm]")!.click();
    expect(client.requestLifecycleAction).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(confirmation);

    confirmation.value = server.displayName;
    dialog.querySelector<HTMLButtonElement>("[data-admin-lifecycle-confirm]")!.click();
    await vi.waitFor(() => expect(client.requestLifecycleAction).toHaveBeenCalledTimes(1));
    expect(vi.mocked(client.requestLifecycleAction).mock.calls[0]![1]).toMatchObject({
      action: "delete",
      expectedVersion: server.version,
      reason: "Odstranění nefunkční instance",
      confirmationToken: "DELETE_SERVER"
    });
  });

  it("exposes a real mobile navigation toggle without placeholder sections", async () => {
    const client = createClient();
    await createAdminApp({ client, pollIntervalMs: 60_000 }).mount();

    const toggle = document.querySelector<HTMLButtonElement>("[data-admin-nav-toggle]")!;
    const nav = document.querySelector<HTMLElement>("#admin-primary-nav")!;
    expect(toggle.getAttribute("aria-controls")).toBe("admin-primary-nav");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(nav.querySelector('[href="#admin-registration"]')).toBeNull();

    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(nav.dataset.open).toBe("true");
  });

  it("mounts idempotently and destroy removes the visibility refresh path", async () => {
    const client = createClient();
    const app = createAdminApp({ client, pollIntervalMs: 60_000 });
    await Promise.all([app.mount(), app.mount()]);
    expect(client.getSession).toHaveBeenCalledTimes(1);
    const reads = vi.mocked(client.getOverview).mock.calls.length;

    app.destroy();
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();
    expect(client.getOverview).toHaveBeenCalledTimes(reads);
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
  getAudit: vi.fn().mockResolvedValue([]),
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
  runtimeWorkers: { expected: 2, live: 2, stale: 0, offline: 0, noWorker: 0 },
  counts: { known: 2, live: 2, stale: 0, offline: 0, noWorker: 0, failed: 0, running: 2, lobby: 0, paused: 0, players: 7 }
});
const detail = (id: string): AdminInstanceDetailView => ({
  serverInstanceId: id, generatedAt: "2026-07-16T10:00:00.000Z", summary: { ...summary(id), displayName: `Detail ${id}` },
  freshness: summary(id).freshness, runtimeAvailable: true,
  runtimeHealth: {
    lifecycleStatus: "running",
    expectedTickRateMs: 10_000,
    freshnessThresholdMs: 30_000,
    commandObservationWindowMs: 40_000,
    instanceLastTick: 42,
    instanceLastErrorCode: null,
    lastAppliedCommandAt: "2026-07-16T10:00:00.000Z",
    runtimeActive: { status: "pass", reasonCode: "instance-runtime-active", observedAt: "2026-07-16T10:00:00.000Z" },
    tickAdvancing: { status: "pass", reasonCode: "tick-advance-two-sample", observedAt: "2026-07-16T10:00:00.000Z" },
    snapshotCurrent: { status: "pass", reasonCode: "recovery-head-current", observedAt: "2026-07-16T10:00:00.000Z" },
    commandsAccepted: { status: "pass", reasonCode: "recent-applied-command-observed", observedAt: "2026-07-16T10:00:00.000Z" }
  },
  players: [], districts: [],
  economy: { serverInstanceId: id, totalCleanCash: 0, totalDirtyCash: 0, totalResources: {} },
  production: { serverInstanceId: id, productionBuildingCount: 0, readyToCollectCount: 0, activeCraftCount: 0, storageFullCount: 0 },
  police: { serverInstanceId: id, heatPressure: "none", maxPlayerHeat: 0, wantedPlayerCount: 0, pendingRaidCount: 0 },
  liveness: { serverInstanceId: id, activePlayers: 0, playablePlayers: 0, temporarilySealedPlayers: 0, encircledPlayers: 0,
    lastStandPlayers: 0, emergencyRecoveryEligiblePlayers: 0, invalidSoftlocks: 0 },
  alliances: [], snapshot: {
    serverInstanceId: id,
    snapshotId: "snapshot:head:42",
    createdAt: "2026-07-16T10:19:50.000Z",
    tick: 42,
    stateVersion: 77,
    schemaVersion: 3,
    stale: false,
    lastCheckpointAt: "2026-07-16T10:15:00.000Z",
    rollingCheckpointCount: 24,
    lifecycleCheckpointCount: 3,
    terminalCheckpointCount: 1,
    lastCleanupAt: "2026-07-16T10:10:00.000Z",
    lastCleanupStatus: "success",
    storageHealth: "healthy"
  },
  commands: [], events: [], diagnostics: []
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

const rejectOnAbort = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => new Promise<T>((resolve, reject) => {
  const abort = (): void => reject(new DOMException("Request aborted", "AbortError"));
  if (signal?.aborted) return abort();
  signal?.addEventListener("abort", abort, { once: true });
  void promise.then(resolve, reject).finally(() => signal?.removeEventListener("abort", abort));
});

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
  disabledReason: "SERVER_REGISTRATION_NOT_SCHEDULED",
  startingPlayerState: FREE_HOSTED_STARTING_PLAYER_STATE,
  ...overrides
});

const controlPlane = (server: AdminHostedServerView) => ({
  writesEnabled: true, provisioningEnabled: true, databaseAvailable: true, migrationsCurrent: true,
  workerStatus: "online" as const, buildCompatibility: "current" as const, unavailableCode: null,
  apiBuildSha: BUILD_SHA, workerBuildSha: BUILD_SHA, servers: [server], generatedAt: "2026-07-16T10:00:00.000Z"
});

const renderHosted = (server: AdminHostedServerView): string => renderDashboard({
  session: { ...session, role: "owner" }, overview: overview(), selectedInstanceId: server.serverInstanceId,
  detail: null, controlPlane: controlPlane(server), wizardOpen: false, wizardStep: 1, frontendBuildSha: BUILD_SHA
});
