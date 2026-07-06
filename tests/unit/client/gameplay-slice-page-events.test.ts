/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  GameplaySliceResponse,
  GameplaySliceView,
  LoadGameplaySliceRequest
} from "@empire/shared-types";
import { closeOverlay, isOverlayOpen, openOverlay, resetOverlayStateForTests } from "../../../apps/client/src/modals";
import { mountGameplaySlicePage } from "../../../apps/client/src/browser/gameplay-slice-page";

const createGameplaySliceResponse = (): GameplaySliceResponse => ({
  accepted: true,
  readModel: createGameplaySliceView(),
  errors: []
} as unknown as GameplaySliceResponse);

const createGameplaySliceResponseForDistrict = (districtId: string): GameplaySliceResponse => ({
  accepted: true,
  readModel: createGameplaySliceViewWithDistrict(districtId),
  errors: []
} as unknown as GameplaySliceResponse);

const createDistrictPanelFixture = (districtId: string): GameplaySliceView["district"] =>
  ({
    districtId,
    name: `District ${districtId}`,
    zone: "downtown",
    status: "claimed",
    ownerPlayerId: null,
    isOwnedByPlayer: false,
    heat: 0,
    influence: 0,
    slotCount: 0,
    filledSlotCount: 0,
    buildings: [],
    slots: [],
    attackTargets: [],
    spyTargets: [],
    occupyTargets: [],
    trap: null
  } as unknown as GameplaySliceView["district"]);

const createGameplaySliceViewWithDistrict = (districtId: string): GameplaySliceView =>
  ({
    ...createGameplaySliceView(),
    district: createDistrictPanelFixture(districtId),
    server: {
      ...createGameplaySliceView().server,
      selectedDistrictId: districtId
    },
    commandHints: {
      ...createGameplaySliceView().commandHints,
      selectedDistrictId: districtId
    }
  } as unknown as GameplaySliceView);

const createGameplaySliceView = (): GameplaySliceView =>
  ({
    server: {
      serverInstanceId: "instance:free:eu-central:public-1",
      mode: "free",
      currentTick: 1,
      stateVersion: 1,
      selectedDistrictId: "district:spawn:1",
      generatedAt: "2025-01-01T00:00:00.000Z"
    },
    mode: {
      mode: "free",
      label: "Empire Streets Free",
      matchStyle: "short",
      tickRateMs: 5000,
      sessionKeyPrefix: "empire:free"
    },
    player: {
      playerId: "player:test",
      instanceId: "instance:free:eu-central:public-1",
      mode: "free",
      factionId: "mafian",
      homeDistrictId: "district:spawn:1",
      color: "#ff6b35",
      serverTime: "2025-01-01T00:00:00.000Z",
      resourceBalances: {},
      economy: {
        cleanCash: 0,
        dirtyCash: 0,
        influence: 0,
        population: 0,
        gangMembers: 0,
        resources: {},
        materials: {},
        drugs: {},
        weapons: {}
      },
      notifications: [],
      victoryState: null
    },
    commandHints: {
      selectedDistrictId: null,
      availableBuildingActionCount: 0,
      availableSpyTargetCount: 0,
      availableAttackTargetCount: 0,
      availableOccupyTargetCount: 0,
      cooldowns: [],
      disabledReasons: []
    },
    districts: [],
    reports: [],
    district: null,
    spawnSelection: {
      status: "awaiting_spawn_selection",
      districts: [
        {
          districtId: "district:spawn:2",
          districtName: "Neon Park",
          districtType: "downtown",
          buildingType: "pharmacy",
          neighborCount: 4,
          status: "available",
          ownerPublicName: null
        }
      ],
      selectedByPlayer: null
    },
    gamePhase: "free_day"
  } as unknown as GameplaySliceView);

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const createRoot = (): HTMLElement => {
  const root = document.createElement("div");
  root.dataset.gameplaySliceClient = "true";
  root.dataset.serverInstanceId = "instance:free:eu-central:public-1";
  root.dataset.playerId = "player:test";
  root.dataset.factionId = "mafian";
  return root;
};

describe("gameplay slice page event guard", () => {
  afterEach(() => {
    while (isOverlayOpen()) {
      closeOverlay("test:cleanup");
    }

    resetOverlayStateForTests();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("tap uvnitř mobile sheet neprojde na mapu ani sheet neuzavře", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    const sheet = document.createElement("aside");
    sheet.className = "mobile-sheet";
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:1";
    root.append(sheet, mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    openOverlay("district_sheet");
    await flushMicrotasks();

    const blankInside = document.createElement("div");
    blankInside.dataset.role = "inside-sheet";
    sheet.append(blankInside);
    blankInside.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    blankInside.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(isOverlayOpen()).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    mounted?.destroy();
  });

  it("tap v mobilním sheetu na akční tlačítko funguje", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const send = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    const sheet = document.createElement("aside");
    sheet.className = "mobile-sheet";
    const actionButton = document.createElement("button");
    actionButton.dataset.selectSpawnDistrictId = "district:spawn:2";
    actionButton.textContent = "Vybrat";
    sheet.append(actionButton);
    root.append(sheet);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send
      }
    });
    await flushMicrotasks();

    actionButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(send).toHaveBeenCalledTimes(1);
    mounted?.destroy();
  });

  it("tap uvnitř sheetu nepustí event na map button pod ním", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    const sheet = document.createElement("aside");
    sheet.className = "mobile-sheet";
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";

    root.append(sheet, mapButton);
    document.body.append(root);
    const mount = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    openOverlay("district_sheet");
    await flushMicrotasks();

    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(load).toHaveBeenCalledTimes(1);
    expect(isOverlayOpen()).toBe(true);

    mount?.destroy();
  });

  it("validní tap mapy otevře district", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(load).toHaveBeenCalledTimes(2);
    mounted?.destroy();
  });

  it("rychlý dvojitý tap otevře jen jeden district sheet", async () => {
    const load = vi.fn(async (request: LoadGameplaySliceRequest) => {
      if (typeof request.districtId === "string") {
        return createGameplaySliceResponseForDistrict(request.districtId);
      }

      return createGameplaySliceResponse();
    });
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 2, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 2, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(load).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('[data-feature="district-panel"]').length).toBe(1);
    mounted?.destroy();
  });

  it("tap na mapě během otevřeného sheetu neotevře další district", async () => {
    const load = vi.fn(async (request: LoadGameplaySliceRequest) => {
      if (typeof request.districtId === "string") {
        return createGameplaySliceResponseForDistrict(request.districtId);
      }

      return createGameplaySliceResponse();
    });
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 2, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 2, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(load).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('[data-feature="district-panel"]').length).toBe(1);
    expect(isOverlayOpen()).toBe(true);
    mounted?.destroy();
  });

  it("legacy district close event zavře slice district sheet a uvolní scroll lock", async () => {
    const load = vi.fn(async (request: LoadGameplaySliceRequest) => {
      if (typeof request.districtId === "string") {
        return createGameplaySliceResponseForDistrict(request.districtId);
      }

      return createGameplaySliceResponse();
    });
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(isOverlayOpen()).toBe(true);
    expect(document.body.dataset.overlayScrollLocked).toBe("true");

    document.dispatchEvent(new CustomEvent("empire:district-closed", {
      detail: {
        source: "legacy-district-popup"
      }
    }));
    await flushMicrotasks();

    expect(isOverlayOpen()).toBe(false);
    expect(document.body.dataset.overlayScrollLocked).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-feature="district-panel"]')).toBeNull();
    mounted?.destroy();
  });

  it("legacy district close bridge zavře slice district sheet i bez DOM eventu", async () => {
    const load = vi.fn(async (request: LoadGameplaySliceRequest) => {
      if (typeof request.districtId === "string") {
        return createGameplaySliceResponseForDistrict(request.districtId);
      }

      return createGameplaySliceResponse();
    });
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(isOverlayOpen()).toBe(true);
    expect(window.EmpireGameplaySliceClient?.closeDistrictSheet("legacy district popup closed")).toBe(true);
    await flushMicrotasks();

    expect(isOverlayOpen()).toBe(false);
    expect(document.body.dataset.overlayScrollLocked).toBeUndefined();
    expect(load).toHaveBeenCalledTimes(2);
    expect(document.querySelector('[data-feature="district-panel"]')).toBeNull();
    mounted?.destroy();
  });

  it("hidden legacy district popup mutation zavře slice district sheet", async () => {
    const load = vi.fn(async (request: LoadGameplaySliceRequest) => {
      if (typeof request.districtId === "string") {
        return createGameplaySliceResponseForDistrict(request.districtId);
      }

      return createGameplaySliceResponse();
    });
    const legacyPopup = document.createElement("div");
    legacyPopup.dataset.testid = "district-popup";
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(legacyPopup, root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(isOverlayOpen()).toBe(true);
    legacyPopup.hidden = true;
    await flushMicrotasks();

    expect(isOverlayOpen()).toBe(false);
    expect(document.body.dataset.overlayScrollLocked).toBeUndefined();
    mounted?.destroy();
  });

  it("tap na jiný district při otevřeném sheetu nepřepíše obsah přes overlay", async () => {
    const load = vi.fn(async (request: LoadGameplaySliceRequest) => {
      if (typeof request.districtId === "string") {
        return createGameplaySliceResponseForDistrict(request.districtId);
      }

      return createGameplaySliceResponse();
    });
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    mapButton.dataset.districtId = "district:map:2";
    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 2, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 2, clientX: 2, clientY: 2 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(load).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('[data-feature="district-panel"]').length).toBe(1);
    const districtPanel = document.querySelector('[data-feature="district-panel"]') as HTMLElement | null;
    expect(districtPanel?.dataset.districtId).toBe("district:map:1");
    mounted?.destroy();
  });

  it("ghost click po zavření overlaye neotevře district pod ním", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    openOverlay("district_sheet");
    closeOverlay("test close");
    const ghostClick = new MouseEvent("click", { bubbles: true, cancelable: true });
    mapButton.dispatchEvent(ghostClick);
    await flushMicrotasks();

    expect(ghostClick.defaultPrevented).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    mounted?.destroy();
  });

  it("drag mapy neotevře district", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, clientX: 30, clientY: 0 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(load).toHaveBeenCalledTimes(1);
    mounted?.destroy();
  });

  it("pointercancel po pointerdown na mapě nic neotevře", async () => {
    const load = vi.fn(async () => createGameplaySliceResponse());
    const root = createRoot();
    const mapButton = document.createElement("button");
    mapButton.dataset.districtId = "district:map:1";
    root.append(mapButton);
    document.body.append(root);

    const mounted = mountGameplaySlicePage({
      root,
      transport: {
        load,
        send: async () => createGameplaySliceResponse()
      }
    });
    await flushMicrotasks();

    mapButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 0, clientY: 0 }));
    mapButton.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, cancelable: true, pointerId: 1, clientX: 5, clientY: 5 }));
    mapButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();

    expect(load).toHaveBeenCalledTimes(1);
    mounted?.destroy();
  });
});
