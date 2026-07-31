// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminControlPlaneAvailabilityView,
  AdminInstanceDetailView,
  AdminOverviewView,
  AdminSessionView
} from "@empire/shared-types";
import { createAdminRefreshController } from "../../apps/admin/src/app/admin-refresh-controller";
import type { AdminApiClient } from "../../apps/admin/src/app/admin-monitoring-client";

const generatedAt = "2026-07-31T12:00:00.000Z";
const overview = { generatedAt } as AdminOverviewView;
const controlPlane = { generatedAt } as AdminControlPlaneAvailabilityView;
const detail = { serverInstanceId: "server:A", generatedAt } as AdminInstanceDetailView;
const session = { role: "viewer" } as AdminSessionView;

describe("admin refresh controller", () => {
  beforeEach(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("loads overview, scoped control-plane, and selected detail in sequence", async () => {
    const calls: string[] = [];
    const client = createClient({
      getOverview: vi.fn(async () => {
        calls.push("overview");
        return overview;
      }),
      getControlPlane: vi.fn(async (_signal, instanceId) => {
        calls.push(`control-plane:${instanceId}`);
        return controlPlane;
      }),
      getInstance: vi.fn(async (instanceId) => {
        calls.push(`detail:${instanceId}`);
        return detail;
      })
    });
    const controller = createController(client, () => calls.push("apply"));

    await controller.refresh();

    expect(calls).toEqual([
      "overview",
      "control-plane:server:A",
      "detail:server:A",
      "apply"
    ]);
    expect(client.getControlPlane).toHaveBeenCalledWith(
      expect.any(AbortSignal),
      "server:A"
    );
    controller.cancel();
  });

  it("coalesces refresh requests queued during an active wave", async () => {
    const firstDetail = deferred<AdminInstanceDetailView>();
    const calls: string[] = [];
    let overviewCall = 0;
    let controlPlaneCall = 0;
    let detailCall = 0;
    const client = createClient({
      getOverview: vi.fn(async () => {
        overviewCall += 1;
        calls.push(`overview:${overviewCall}`);
        return overview;
      }),
      getControlPlane: vi.fn(async (_signal, instanceId) => {
        controlPlaneCall += 1;
        calls.push(`control-plane:${controlPlaneCall}:${instanceId}`);
        return controlPlane;
      }),
      getInstance: vi.fn(async () => {
        detailCall += 1;
        const currentCall = detailCall;
        calls.push(`detail:${currentCall}:start`);
        const result = currentCall === 1 ? await firstDetail.promise : detail;
        calls.push(`detail:${currentCall}:end`);
        return result;
      })
    });
    const controller = createController(client);

    const firstRefresh = controller.refresh();
    await vi.waitFor(() => expect(client.getInstance).toHaveBeenCalledTimes(1));

    const queuedRefreshA = controller.refresh();
    const queuedRefreshB = controller.refresh();

    expect(queuedRefreshA).toBe(firstRefresh);
    expect(queuedRefreshB).toBe(firstRefresh);
    expect(client.getOverview).toHaveBeenCalledTimes(1);
    expect(client.getControlPlane).toHaveBeenCalledTimes(1);
    expect(client.getInstance).toHaveBeenCalledTimes(1);

    firstDetail.resolve(detail);
    await Promise.all([firstRefresh, queuedRefreshA, queuedRefreshB]);

    expect(client.getOverview).toHaveBeenCalledTimes(2);
    expect(client.getControlPlane).toHaveBeenCalledTimes(2);
    expect(client.getInstance).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([
      "overview:1",
      "control-plane:1:server:A",
      "detail:1:start",
      "detail:1:end",
      "overview:2",
      "control-plane:2:server:A",
      "detail:2:start",
      "detail:2:end"
    ]);
    controller.cancel();
  });

  it("cancels an obsolete selected-instance wave before loading the next selection", async () => {
    let selectedInstanceId = "server:A";
    const firstDetail = deferred<AdminInstanceDetailView>();
    const applied: string[] = [];
    const client = createClient({
      getOverview: vi.fn(async () => overview),
      getControlPlane: vi.fn(async () => controlPlane),
      getInstance: vi.fn(async (instanceId, signal) => (
        instanceId === "server:A"
          ? await rejectOnAbort(firstDetail.promise, signal)
          : { ...detail, serverInstanceId: instanceId }
      ))
    });
    const controller = createAdminRefreshController({
      client,
      pollInterval: 60_000,
      maxBackoff: 240_000,
      context: () => ({
        mounted: true,
        session,
        overview,
        selectedInstanceId,
        wizardOpen: false,
        auditEntries: [],
        auditError: null
      }),
      apply: (result) => {
        if (result.detail) applied.push(result.detail.serverInstanceId);
      },
      syncClock: () => undefined,
      render: () => undefined,
      onStatus: () => undefined,
      onError: () => undefined
    });

    const firstRefresh = controller.refresh();
    await vi.waitFor(() => expect(client.getInstance).toHaveBeenCalledWith(
      "server:A",
      expect.any(AbortSignal)
    ));
    selectedInstanceId = "server:B";
    const nextRefresh = controller.refresh();
    await Promise.all([firstRefresh, nextRefresh]);

    expect(client.getInstance).toHaveBeenCalledWith(
      "server:B",
      expect.any(AbortSignal)
    );
    expect(applied).toEqual(["server:B"]);
    controller.cancel();
  });

  it("keeps stale overview explicit while refreshing selected server reads", async () => {
    const overviewError = new Error("overview temporarily unavailable");
    const calls: string[] = [];
    const applied: Array<{ overview: AdminOverviewView; detail: AdminInstanceDetailView | null }> = [];
    const statuses: string[] = [];
    const onError = vi.fn();
    const client = createClient({
      getOverview: vi.fn(async () => {
        calls.push("overview");
        throw overviewError;
      }),
      getControlPlane: vi.fn(async (_signal, instanceId) => {
        calls.push(`control-plane:${instanceId}`);
        return controlPlane;
      }),
      getInstance: vi.fn(async (instanceId) => {
        calls.push(`detail:${instanceId}`);
        return detail;
      })
    });
    const controller = createAdminRefreshController({
      client,
      pollInterval: 60_000,
      maxBackoff: 240_000,
      context: () => ({
        mounted: true,
        session,
        overview,
        selectedInstanceId: "server:A",
        wizardOpen: false,
        auditEntries: [],
        auditError: null
      }),
      apply: (result) => {
        calls.push("apply");
        applied.push(result);
      },
      syncClock: () => undefined,
      render: () => undefined,
      onStatus: (status) => statuses.push(status),
      onError
    });

    await controller.refresh();

    expect(calls).toEqual([
      "overview",
      "control-plane:server:A",
      "detail:server:A",
      "apply"
    ]);
    expect(applied).toEqual([
      expect.objectContaining({ overview, detail })
    ]);
    expect(statuses).toEqual(["loading", "backoff"]);
    expect(onError).toHaveBeenCalledWith(overviewError);
    controller.cancel();
  });
});

const createController = (
  client: AdminApiClient,
  apply: () => void = () => undefined
) => createAdminRefreshController({
  client,
  pollInterval: 60_000,
  maxBackoff: 240_000,
  context: () => ({
    mounted: true,
    session,
    overview,
    selectedInstanceId: "server:A",
    wizardOpen: false,
    auditEntries: [],
    auditError: null
  }),
  apply,
  syncClock: () => undefined,
  render: () => undefined,
  onStatus: () => undefined,
  onError: () => undefined
});

const createClient = (overrides: Partial<AdminApiClient>): AdminApiClient => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getOverview: vi.fn(),
  getInstance: vi.fn(),
  getControlPlane: vi.fn(),
  getAudit: vi.fn(),
  createServer: vi.fn(),
  requestLifecycleAction: vi.fn(),
  ...overrides
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const rejectOnAbort = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => new Promise<T>((resolve, reject) => {
  const abort = (): void => reject(new DOMException("Request aborted", "AbortError"));
  if (signal.aborted) return abort();
  signal.addEventListener("abort", abort, { once: true });
  void promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
});
