/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  GameCommand,
  GameplaySliceResponse,
  GameplaySliceView,
  LoadGameplaySliceRequest
} from "@empire/shared-types";
import { mountGameplaySlicePage } from "../../../apps/client/src/browser/gameplay-slice-page";

const SERVER_INSTANCE_ID = "instance:free:eu-central:public-1";
const PLAYER_ID = "player:test";
const HOME_DISTRICT_ID = "district:spawn:1";

const createGameplaySliceView = (districtId = HOME_DISTRICT_ID): GameplaySliceView => ({
  server: {
    serverInstanceId: SERVER_INSTANCE_ID,
    mode: "free",
    status: "running",
    currentTick: 1,
    stateVersion: 1,
    selectedDistrictId: districtId,
    generatedAt: "2025-01-01T00:00:00.000Z"
  },
  mode: {
    mode: "free",
    label: "Empire Streets Free",
    matchStyle: "short",
    tickRateMs: 10_000,
    sessionKeyPrefix: "empire:free"
  },
  player: {
    playerId: PLAYER_ID,
    instanceId: SERVER_INSTANCE_ID,
    mode: "free",
    factionId: "mafian",
    homeDistrictId: HOME_DISTRICT_ID,
    color: "#ff6b35",
    serverTime: "2025-01-01T00:00:00.000Z",
    resourceBalances: {},
    economy: {
      cleanCash: 100,
      dirtyCash: 20,
      influence: 3,
      population: 4,
      resources: {},
      materials: {},
      drugs: {},
      weapons: {}
    },
    notifications: [],
    victoryState: null
  },
  commandHints: {
    selectedDistrictId: districtId,
    availableBuildingActionCount: 0,
    availableSpyTargetCount: 0,
    availableAttackTargetCount: 0,
    availableOccupyTargetCount: 0,
    cooldowns: [],
    disabledReasons: []
  },
  districts: [],
  reports: [{
    reportId: "report:1",
    reportType: "building-action",
    result: "success",
    tick: 1,
    districtId,
    buildingId: "building:1",
    buildingActionId: "test-action",
    outputGain: {},
    inputCost: {},
    heatGain: 0,
    influenceChange: 0
  }],
  district: {
    districtId,
    name: `District ${districtId}`,
    zone: "downtown",
    status: "claimed",
    ownerPlayerId: PLAYER_ID,
    isOwnedByPlayer: true,
    intelKnown: true,
    heat: 0,
    influence: 0,
    slotCount: 0,
    filledSlotCount: 0,
    buildings: [],
    slots: [],
    attackTargets: [],
    robTargets: [],
    heistTargets: [],
    spyTargets: [],
    occupyTargets: [],
    trap: null
  },
  spawnSelection: null,
  gamePhase: "free_day"
} as unknown as GameplaySliceView);

const createGameplaySliceResponse = (districtId = HOME_DISTRICT_ID): GameplaySliceResponse => ({
  accepted: true,
  readModel: createGameplaySliceView(districtId),
  errors: []
} as unknown as GameplaySliceResponse);

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createRoot = (): HTMLElement => {
  const root = document.createElement("section");
  root.dataset.gameplaySliceClient = "true";
  root.dataset.serverInstanceId = SERVER_INSTANCE_ID;
  root.dataset.playerId = PLAYER_ID;
  root.dataset.districtId = HOME_DISTRICT_ID;
  root.dataset.factionId = "mafian";
  root.append(document.createElement("div"));
  return root;
};

describe("headless gameplay slice page", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
    delete document.body.dataset.cityPhase;
    vi.restoreAllMocks();
  });

  it("reuses one hidden controller and publishes structured authoritative state", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    document.body.append(root);
    const rendered = vi.fn();
    document.addEventListener("empire:gameplay-slice-rendered", rendered);

    const first = mountGameplaySlicePage({
      root,
      presentationMode: "full",
      transport: { load, send: async () => createGameplaySliceResponse() }
    });
    const second = mountGameplaySlicePage({
      root,
      transport: { load, send: async () => createGameplaySliceResponse() }
    });
    await flushMicrotasks();

    const state = window.EmpireGameplaySliceClient?.getCurrentRenderState();
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    expect(root.hidden).toBe(true);
    expect(root.childElementCount).toBe(0);
    expect(root.dataset.gameplaySlicePresentationMode).toBe("controller-only");
    expect(state).toMatchObject({
      topBarHtml: "",
      mapHtml: "",
      sidePanelHtml: "",
      player: { playerId: PLAYER_ID },
      districtPanel: { districtId: HOME_DISTRICT_ID },
      connection: { status: "ready" }
    });
    expect(state?.reports).toHaveLength(1);
    expect(rendered).toHaveBeenCalledTimes(1);

    document.removeEventListener("empire:gameplay-slice-rendered", rendered);
    first?.destroy();
  });

  it("routes a shared visible district control through the headless selector", async () => {
    const load = vi.fn(async (request: LoadGameplaySliceRequest) =>
      createGameplaySliceResponse(request.districtId || HOME_DISTRICT_ID));
    const root = createRoot();
    const sharedButton = document.createElement("button");
    sharedButton.dataset.districtId = "district:map:2";
    document.body.append(root, sharedButton);
    const mounted = mountGameplaySlicePage({
      root,
      transport: { load, send: async () => createGameplaySliceResponse() }
    });
    await flushMicrotasks();

    const state = await window.EmpireGameplaySliceClient?.handleSurfaceAction(sharedButton);

    expect(load).toHaveBeenCalledTimes(2);
    expect(state?.districtPanel?.districtId).toBe("district:map:2");
    expect(window.EmpireGameplaySliceClient?.getCurrentReadModel()?.district?.districtId)
      .toBe("district:map:2");
    mounted?.destroy();
  });

  it("submits typed commands and returns server-confirmed state", async () => {
    const send = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    document.body.append(root);
    const mounted = mountGameplaySlicePage({
      root,
      transport: { load: async () => createGameplaySliceResponse(), send }
    });
    await flushMicrotasks();
    const command = {
      id: "command:trap:1",
      type: "place-trap",
      mode: "free",
      playerId: PLAYER_ID,
      serverInstanceId: SERVER_INSTANCE_ID,
      issuedAt: "2025-01-01T00:00:00.000Z",
      clientRequestId: null,
      payload: { districtId: HOME_DISTRICT_ID }
    } as GameCommand;

    const result = await window.EmpireGameplaySliceClient?.submitCommand(command);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      command,
      focusDistrictId: HOME_DISTRICT_ID
    }));
    expect(result).toMatchObject({
      accepted: true,
      transportFailure: false,
      readModel: { player: { playerId: PLAYER_ID } }
    });
    mounted?.destroy();
  });

  it("keeps polling from hiding an in-flight command response", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => createGameplaySliceResponse());
    let resolveSend!: (response: GameplaySliceResponse) => void;
    const send = vi.fn(() => new Promise<GameplaySliceResponse>((resolve) => {
      resolveSend = resolve;
    }));
    const root = createRoot();
    root.dataset.gameplaySlicePolling = "true";
    root.dataset.gameplaySlicePollingIntervalMs = "10";
    document.body.append(root);
    const mounted = mountGameplaySlicePage({ root, transport: { load, send } });
    await flushMicrotasks();
    const command = {
      id: "command:trap:poll-race",
      type: "place-trap",
      mode: "free",
      playerId: PLAYER_ID,
      serverInstanceId: SERVER_INSTANCE_ID,
      issuedAt: "2025-01-01T00:00:00.000Z",
      clientRequestId: null,
      payload: { districtId: HOME_DISTRICT_ID }
    } as GameCommand;

    const resultPromise = window.EmpireGameplaySliceClient?.submitCommand(command);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(10);
    await flushMicrotasks();

    expect(send).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);

    resolveSend({
      accepted: false,
      readModel: createGameplaySliceView(),
      errors: [{
        code: "server.state_version_conflict",
        message: "Command expectedStateVersion does not match the current server state version."
      }]
    });
    const result = await resultPromise;

    expect(result).toMatchObject({
      accepted: false,
      transportFailure: false,
      errors: [{ code: "server.state_version_conflict" }]
    });

    await vi.advanceTimersByTimeAsync(10);
    await flushMicrotasks();
    expect(load).toHaveBeenCalledTimes(2);
    mounted?.destroy();
  });

  it("publishes recovery after a failed poll and an unchanged successful response", async () => {
    vi.useFakeTimers();
    let loadCalls = 0;
    const load = vi.fn(async () => {
      loadCalls += 1;
      if (loadCalls === 2) throw new Error("temporary poll failure");
      return createGameplaySliceResponse();
    });
    const connectionStatuses: string[] = [];
    const handleConnectionState = (event: Event) => {
      connectionStatuses.push(String((event as CustomEvent).detail?.status || ""));
    };
    document.addEventListener("empire:gameplay-connection-state", handleConnectionState);
    const root = createRoot();
    root.dataset.gameplaySlicePolling = "true";
    root.dataset.gameplaySlicePollingIntervalMs = "10";
    document.body.append(root);
    const mounted = mountGameplaySlicePage({
      root,
      transport: { load, send: async () => createGameplaySliceResponse() }
    });
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(10);
    await flushMicrotasks();
    expect(connectionStatuses).toEqual(["ready", "stale"]);

    await vi.advanceTimersByTimeAsync(20);
    await flushMicrotasks();
    expect(connectionStatuses).toEqual(["ready", "stale", "ready"]);

    document.removeEventListener("empire:gameplay-connection-state", handleConnectionState);
    mounted?.destroy();
  });

  it("polls the requested district while its selection response is pending", async () => {
    vi.useFakeTimers();
    const requests: LoadGameplaySliceRequest[] = [];
    let resolveSelection!: (response: GameplaySliceResponse) => void;
    const load = vi.fn(async (request: LoadGameplaySliceRequest) => {
      requests.push({ ...request });
      if (requests.length === 1) return createGameplaySliceResponse();
      if (requests.length === 2) {
        return new Promise<GameplaySliceResponse>((resolve) => {
          resolveSelection = resolve;
        });
      }
      return createGameplaySliceResponse(request.districtId || HOME_DISTRICT_ID);
    });
    const root = createRoot();
    root.dataset.gameplaySlicePolling = "true";
    root.dataset.gameplaySlicePollingIntervalMs = "10";
    document.body.append(root);
    const mounted = mountGameplaySlicePage({
      root,
      transport: { load, send: async () => createGameplaySliceResponse() }
    });
    await flushMicrotasks();

    const selection = window.EmpireGameplaySliceClient?.selectDistrict("district:map:2");
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(10);
    await flushMicrotasks();

    expect(requests.slice(1).map((request) => request.districtId)).toEqual([
      "district:map:2",
      "district:map:2"
    ]);
    resolveSelection(createGameplaySliceResponse("district:map:2"));
    await selection;
    mounted?.destroy();
  });

  it("pagehide destroys the controller before a later remount", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const transport = { load, send: async () => createGameplaySliceResponse() };
    const root = createRoot();
    document.body.append(root);
    const first = mountGameplaySlicePage({ root, transport });
    await flushMicrotasks();

    window.dispatchEvent(new Event("pagehide"));
    const second = mountGameplaySlicePage({ root, transport });
    await flushMicrotasks();

    expect(second).not.toBe(first);
    expect(load).toHaveBeenCalledTimes(2);
    second?.destroy();
  });
});
