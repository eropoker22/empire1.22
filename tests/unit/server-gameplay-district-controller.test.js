// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerGameplayDistrictController } from "../../page-assets/js/app/ui/serverGameplayDistrictController.js";

describe("server gameplay district controller", () => {
  beforeEach(() => {
    resetOverlayCoordinator();
    document.body.innerHTML = fixture();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens only after a matching targeted selection response", () => {
    const harness = createHarness();
    harness.controller.mount();
    harness.controller.update(harness.readModel);

    expect(document.querySelector("[data-district-popup]").hidden).toBe(true);
    expect(harness.controller.handleDistrictSelected({
      districtId: "district:9",
      response: {
        accepted: true,
        readModel: harness.readModel,
        renderState: harness.renderState
      }
    })).toBe(false);
    expect(document.querySelector("[data-district-popup]").hidden).toBe(true);

    expect(harness.controller.handleDistrictSelected({
      districtId: "district:2",
      response: {
        accepted: true,
        readModel: harness.readModel,
        renderState: harness.renderState
      }
    })).toBe(true);
    expect(document.querySelector("[data-district-popup]").hidden).toBe(false);
    expect(document.querySelector("[data-district-popup]").parentElement).toBe(document.body);
    expect(document.querySelector("[data-district-popup-title]").textContent).toBe("Neon Quay");
    expect(document.querySelector("[data-district-popup-owner]").textContent).toBe("Player Two");
    expect(document.querySelector("[data-district-popup-clean]").textContent).toBe("7");
    expect(document.querySelector("[data-district-popup-influence]").textContent).toBe("Obsazený");
    expect(document.querySelectorAll("[data-district-building-name]")).toHaveLength(1);

    harness.controller.destroy();
  });

  it("routes building and gameplay actions through the sole scoped surface API", async () => {
    const harness = createHarness();
    harness.controller.mount();
    harness.controller.handleDistrictSelected({
      districtId: "district:2",
      response: {
        accepted: true,
        readModel: harness.readModel,
        renderState: harness.renderState
      }
    });

    document.querySelector("[data-district-building-name]").click();
    await vi.waitFor(() => expect(harness.handleSurfaceAction).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      expect(document.querySelector("[data-district-building-detail-popup]")).not.toBeNull();
    });
    const buildingProxy = harness.handleSurfaceAction.mock.calls[0][0];
    expect(harness.scopeContainedAtCall[0]).toBe(true);
    expect(buildingProxy.tagName).toBe("ARTICLE");
    expect(buildingProxy.dataset).toMatchObject({
      buildingId: "building:casino:2",
      buildingType: "casino"
    });
    expect(document.querySelector("[data-district-building-detail-popup]").hidden).toBe(false);
    expect(document.querySelector("[data-district-building-detail-title]").textContent).toBe("Neon Casino");

    document.querySelector("[data-district-building-detail-action-id='cashout']").click();
    await vi.waitFor(() => expect(harness.handleSurfaceAction).toHaveBeenCalledTimes(2));
    const actionProxy = harness.handleSurfaceAction.mock.calls[1][0];
    expect(harness.scopeContainedAtCall[1]).toBe(true);
    expect(actionProxy.dataset).toMatchObject({
      buildingActionBuildingId: "building:casino:2",
      buildingActionId: "cashout"
    });

    await Promise.resolve();
    document.querySelector("[data-district-building-detail-close]").click();
    resetOverlayCoordinator();
    document.querySelector("[data-district-action-id='spy:district:3']").click();
    await vi.waitFor(() => expect(harness.handleSurfaceAction).toHaveBeenCalledTimes(3));
    expect(harness.handleSurfaceAction.mock.calls[2][0].dataset.spyTargetId).toBe("district:3");
    expect(harness.scopeContainedAtCall.every(Boolean)).toBe(true);

    expect(harness.controller.destroy()).toBe(true);
    expect(harness.controller.destroy()).toBe(false);
    expect(document.querySelector("[data-district-popup]").parentElement.id).toBe("game-root");
  });

  it("opens a requested server building type through the presentation surface", async () => {
    const harness = createHarness();
    harness.controller.mount();
    harness.controller.handleDistrictSelected({
      districtId: "district:2",
      response: {
        accepted: true,
        readModel: harness.readModel,
        renderState: harness.renderState
      }
    });

    await expect(harness.controller.openBuildingByType("casino")).resolves.toBe(true);
    expect(harness.handleSurfaceAction).toHaveBeenCalledTimes(1);
    expect(harness.handleSurfaceAction.mock.calls[0][0].dataset).toMatchObject({
      buildingId: "building:casino:2",
      buildingType: "casino"
    });
    expect(document.querySelector("[data-district-building-detail-popup]").hidden).toBe(false);

    harness.controller.destroy();
  });
});

function createHarness() {
  const readModel = {
    player: { playerId: "player:1" },
    leaderboard: {
      currentPlayer: { playerId: "player:1", name: "Current Player" },
      entries: [{ playerId: "player:2", name: "Player Two", allianceTag: "NIGHT" }]
    },
    district: {
      districtId: "district:2",
      name: "Neon Quay",
      zone: "commercial",
      ownerPlayerId: "player:2",
      isOwnedByPlayer: false,
      status: "claimed",
      heat: 7,
      influence: 42
    }
  };
  const building = {
    buildingId: "building:casino:2",
    buildingTypeId: "casino",
    label: "Neon Casino",
    typeLabel: "Kasino",
    zoneLabel: "Komerční",
    roleLabel: "Ekonomika",
    info: "Serverem potvrzený detail.",
    statusLabel: "Aktivní · level 2",
    stats: [{ label: "Výnos", value: "$120" }],
    actions: [{
      actionId: "cashout",
      label: "Vybrat zisk",
      inputSummary: "Zdarma",
      outputSummary: "$120",
      cooldownLabel: "",
      cooldownRemainingMs: 0,
      disabled: false,
      disabledReason: null
    }],
    specialActions: []
  };
  const renderState = {
    districtPanel: {
      districtId: "district:2",
      title: "Neon Quay",
      ownershipLabel: "Vlastní player:2",
      zoneLabel: "Komerční",
      statusLabel: "obsazený",
      heatLabel: "7",
      influenceLabel: "42",
      buildingSummary: "1 pevná budova",
      hasPendingCommand: false,
      trap: null,
      spyTargets: [{
        districtId: "district:3",
        label: "Old Yard",
        disabled: false,
        disabledReason: null
      }],
      occupyTargets: [],
      robTargets: [],
      heistTargets: [],
      attackTargets: [],
      placeDefense: null,
      removeDefense: null,
      buildings: [building],
      slots: []
    }
  };
  const scope = document.querySelector("[data-gameplay-slice-client]");
  const scopeContainedAtCall = [];
  const handleSurfaceAction = vi.fn(async (target) => {
    scopeContainedAtCall.push(scope.contains(target));
    return { readModel, renderState };
  });
  const source = {
    getCurrentReadModel: () => readModel,
    getCurrentRenderState: () => renderState,
    handleSurfaceAction
  };
  return {
    controller: createServerGameplayDistrictController({
      root: document.querySelector("#game-root"),
      source,
      documentRef: document
    }),
    handleSurfaceAction,
    readModel,
    renderState,
    scopeContainedAtCall
  };
}

function fixture() {
  const metric = (label, selector) => `<article class="district-popup-summary-card">
    <span class="district-popup-summary-card__label">${label}</span>
    <strong class="district-popup-summary-card__value" ${selector}>0</strong>
  </article>`;
  return `<main id="game-root">
    <div data-gameplay-slice-client></div>
    <div data-district-popup hidden>
      <div data-district-popup-close></div>
      <div data-district-popup-card>
        <button data-district-popup-close>×</button>
        <span data-district-popup-atmosphere-label></span>
        <h3 data-district-popup-title></h3>
        <p data-district-popup-atmosphere-mood></p>
        <span data-district-popup-alliance></span>
        <img data-district-popup-owner-avatar>
        <span data-district-popup-owner-avatar-fallback></span>
        <div data-district-popup-owner></div>
        <div data-district-popup-owner-meta></div>
        <span data-district-popup-type></span>
        <div data-district-popup-flags></div>
        <section data-district-popup-summary>
          ${metric("Clean", "data-district-popup-clean")}
          ${metric("Dirty", "data-district-popup-dirty")}
          ${metric("Vliv", "data-district-popup-influence")}
          ${metric("Populace", "data-district-popup-population")}
        </section>
        <section data-district-popup-buildings>
          <div data-district-popup-buildings-meta></div>
          <div data-district-popup-buildings-list></div>
        </section>
        <section data-district-action-section>
          <div class="district-popup-action-section__head"></div>
          <div data-district-actions></div>
        </section>
      </div>
    </div>
  </main>`;
}

function resetOverlayCoordinator() {
  const state = globalThis[Symbol.for("empire.legacyOverlayCoordinator.state")];
  if (!state) return;
  state.overlayStack.splice(0);
  state.suppressionStartedAt = 0;
  state.suppressMapInputUntil = 0;
}
