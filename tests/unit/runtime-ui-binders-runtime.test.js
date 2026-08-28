import { describe, expect, it, vi } from "vitest";
import { createBuildingActionStatusRuntime } from "../../page-assets/js/app/runtime/buildingActionStatusRuntime.js";
import { createRegisteredPlayerStateRuntime } from "../../page-assets/js/app/runtime/registeredPlayerStateRuntime.js";

function eventElement() {
  const listeners = new Map();
  return {
    dataset: {},
    addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    closest: vi.fn(),
    dispatch(name, event = {}) {
      listeners.get(name)?.(event);
    }
  };
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    dispatch(name) {
      listeners.get(name)?.();
    }
  };
}

describe("runtime UI binder factories", () => {
  it("binds building action status as UI-only shell", () => {
    const clearButton = eventElement();
    const feedElement = eventElement();
    const panel = {
      clearButton,
      entries: [{ id: "a", resultKind: "attack", resultPayload: { ok: true } }],
      feedElement,
      lastFingerprint: "x",
      metaElement: eventElement(),
      observer: { disconnect: vi.fn() },
      skipFingerprint: "y",
      stateElement: eventElement(),
      summaryElement: eventElement()
    };
    const renderBuildingActionFeed = vi.fn();
    const runtime = createBuildingActionStatusRuntime({
      MutationObserver: null,
      buildingActionEmptySnapshot: { empty: true },
      buildingActionRemoveSelector: "[data-building-action-remove]",
      createBuildingActionFingerprint: () => "next",
      openCurrentBuildingActionResultModal: vi.fn(),
      queueOrOpenResultModal: vi.fn(),
      renderBuildingActionFeed,
      resolveBuildingActionPanel: () => panel,
      scheduleBuildingActionMutationCapture: vi.fn()
    });

    runtime.bindBuildingActionStatus({});
    clearButton.dispatch("click");

    expect(panel.entries).toEqual([]);
    expect(panel.observer.disconnect).toHaveBeenCalled();
    expect(renderBuildingActionFeed).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      previewSnapshot: { empty: true }
    }));
  });

  it("keeps registered player state binding no-crash with missing faction", () => {
    const renderPopulationState = vi.fn();
    const runtime = createRegisteredPlayerStateRuntime({
      factionCatalog: {},
      getStoredRegistration: () => ({ factionId: "missing" }),
      renderPopulationState
    });

    expect(() => runtime.bindRegisteredPlayerState({ ownerDocument: null })).not.toThrow();
    expect(renderPopulationState).toHaveBeenCalled();
  });

  it("applies stored gang color to the profile card", () => {
    const profileCard = {
      style: { setProperty: vi.fn() }
    };
    const root = {
      ownerDocument: null,
      querySelector: vi.fn((selector) => selector === "#profile-gang-card" ? profileCard : null),
      style: { setProperty: vi.fn() }
    };
    const runtime = createRegisteredPlayerStateRuntime({
      factionCatalog: {},
      getStoredRegistration: () => ({ factionId: "missing", gangColor: "#F97316" }),
      normalizeRuntimeHexColor: (value) => String(value || "").trim().toLowerCase(),
      renderPopulationState: vi.fn()
    });

    runtime.bindRegisteredPlayerState(root);

    expect(profileCard.style.setProperty).toHaveBeenCalledWith("--gang-profile-player-color", "#f97316");
    expect(root.style.setProperty).toHaveBeenCalledWith("--gang-profile-player-color", "#f97316");
  });

  it("clamps and formats fractional authoritative heat before rendering the gang card", () => {
    const gangHeat = { textContent: "—" };
    const root = {
      ownerDocument: null,
      querySelector: vi.fn((selector) => selector === "[data-gang-heat]" ? gangHeat : null),
      style: { setProperty: vi.fn() }
    };
    const runtime = createRegisteredPlayerStateRuntime({
      factionCatalog: {},
      gangHeatSelector: "[data-gang-heat]",
      getResolvedGangState: () => ({ heat: -0.06466666666666665 }),
      renderPopulationState: vi.fn()
    });

    runtime.bindRegisteredPlayerState(root);

    expect(gangHeat.textContent).toBe("0");
  });

  it("hydrates faction and authoritative district count when the server player arrives later", () => {
    const documentTarget = eventTarget();
    const windowTarget = eventTarget();
    const gangFaction = { textContent: "—" };
    const playerAvatar = {
      classList: { remove: vi.fn() },
      src: "local-avatar.png"
    };
    const playerFaction = { textContent: "—" };
    const playerName = { textContent: "Host" };
    const topbarInfluence = { dataset: {} };
    const scopeElements = new Map([
      ["[data-player-popup-name]", playerName],
      ["[data-player-popup-avatar]", playerAvatar],
      ["[data-player-popup-faction]", playerFaction],
      ["[data-topbar-influence]", topbarInfluence]
    ]);
    const scope = {
      ...documentTarget,
      defaultView: windowTarget,
      querySelector: vi.fn((selector) => scopeElements.get(selector) || null)
    };
    const root = {
      ownerDocument: scope,
      querySelector: vi.fn((selector) => selector === "[data-gang-faction]" ? gangFaction : null),
      style: { setProperty: vi.fn() }
    };
    let serverPlayer = null;
    const getCurrentPlayerDistrictSourceSnapshot = vi.fn(() => ({ districtCount: 0 }));
    const syncCurrentPlayerDistrictCountDisplays = vi.fn();
    const runtime = createRegisteredPlayerStateRuntime({
      applyTopbarEconomy: vi.fn(),
      factionCatalog: {
        hackeri: { name: "Hackeři" },
        mafian: { name: "Mafián" }
      },
      gangHeatSelector: "[data-gang-heat]",
      getCurrentPlayerDistrictSourceSnapshot,
      getDisplayedResourceSnapshot: () => ({ influence: 1 }),
      getRegistrationAccentColor: () => "#67e8f9",
      getResolvedGangState: () => ({ heat: 0 }),
      getServerPlayerView: () => serverPlayer,
      getStoredRegistration: () => ({
        avatar: "local-avatar.png",
        factionId: "hackeri",
        gangColor: "#f97316",
        identity: "Local hráč"
      }),
      normalizeRuntimeHexColor: (value) => String(value || "").trim().toLowerCase(),
      playerPopupAvatarSelector: "[data-player-popup-avatar]",
      playerPopupFactionSelector: "[data-player-popup-faction]",
      playerPopupGangSelector: "[data-player-popup-gang]",
      playerPopupIdentitySelector: "[data-player-popup-identity]",
      playerPopupServerSelector: "[data-player-popup-server]",
      renderPopulationState: vi.fn(),
      renderSpyResourceState: vi.fn(),
      resolveServerPlayerAvatarSrc: () => "server-avatar.jpg",
      syncCurrentPlayerDistrictCountDisplays,
      topbarInfluenceSelector: "[data-topbar-influence]"
    });

    runtime.bindRegisteredPlayerState(root);

    expect(scope.addEventListener).toHaveBeenCalledWith("empire:runtime-refresh", expect.any(Function));
    getCurrentPlayerDistrictSourceSnapshot.mockClear();
    syncCurrentPlayerDistrictCountDisplays.mockClear();
    serverPlayer = {
      factionId: "mafian",
      instanceId: "instance:free:1",
      color: "#22d3ee",
      profile: { avatarId: "mafian:1", displayName: "Hosted hráč", gangName: "Hosted crew" },
      operationalLiveness: { ownedDistrictCount: 1 }
    };

    scope.dispatch("empire:runtime-refresh");

    expect(gangFaction.textContent).toBe("Mafián");
    expect(playerFaction.textContent).toBe("Mafián");
    expect(playerName.textContent).toBe("Hosted hráč");
    expect(playerAvatar.src).toBe("server-avatar.jpg");
    expect(root.style.setProperty).toHaveBeenLastCalledWith("--gang-profile-player-color", "#22d3ee");
    expect(syncCurrentPlayerDistrictCountDisplays).toHaveBeenCalledWith(root, 1);
    expect(getCurrentPlayerDistrictSourceSnapshot).not.toHaveBeenCalled();
  });
});
