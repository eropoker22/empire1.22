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
    const renderGangMembersState = vi.fn();
    const runtime = createRegisteredPlayerStateRuntime({
      factionCatalog: {},
      getStoredRegistration: () => ({ factionId: "missing" }),
      renderGangMembersState
    });

    expect(() => runtime.bindRegisteredPlayerState({ ownerDocument: null })).not.toThrow();
    expect(renderGangMembersState).toHaveBeenCalled();
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
      renderGangMembersState: vi.fn()
    });

    runtime.bindRegisteredPlayerState(root);

    expect(profileCard.style.setProperty).toHaveBeenCalledWith("--gang-profile-player-color", "#f97316");
    expect(root.style.setProperty).toHaveBeenCalledWith("--gang-profile-player-color", "#f97316");
  });
});
