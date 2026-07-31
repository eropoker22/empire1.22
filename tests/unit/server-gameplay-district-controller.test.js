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
    expect(document.querySelector("[data-district-popup-owner-avatar]").getAttribute("src")).toContain("/img/avatars/Hacker/");
    expect(document.querySelector("[data-district-popup-summary]").hidden).toBe(true);
    expect(document.querySelector("[data-district-popup-clean]").textContent).toBe("Bez dat");
    expect(document.querySelector("[data-district-popup-influence]").textContent).toBe("Bez dat");
    expect(document.querySelectorAll("[data-district-building-display-name]")).toHaveLength(0);
    expect(document.querySelector("[data-district-building-name]")).toBeNull();
    expect(document.querySelector("[data-district-popup-buildings-meta]").textContent).toBe("Budovy nezjištěny");
    expect(document.querySelectorAll("[data-district-action-id='spy']")).toHaveLength(1);
    expect(document.querySelector("[data-district-popup]").dataset.overviewEnabled).toBe("false");
    expect(document.querySelector("[data-district-popup-card]").dataset.overviewEnabled).toBe("false");
    expect(document.querySelector("[data-district-popup-toggle]").getAttribute("aria-pressed")).toBe("false");

    document.querySelector("[data-district-popup-toggle]").click();
    expect(document.querySelector("[data-district-popup]").dataset.overviewEnabled).toBe("true");
    expect(document.querySelector("[data-district-popup-card]").dataset.overviewEnabled).toBe("true");
    expect(document.querySelector("[data-district-popup-toggle]").getAttribute("aria-pressed")).toBe("true");

    harness.controller.destroy();
  });

  it("routes building and gameplay actions through the sole scoped surface API", async () => {
    const harness = createHarness({ ownedByCurrentPlayer: true });
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
    expect(document.querySelector("[data-district-building-detail-title]").textContent).toBe("Kasino");
    expect(document.querySelector("[data-district-building-detail-popup]").dataset).toMatchObject({
      buildingDetailLayout: "single-panel",
      executionMode: "server-authoritative",
      serverBuildingId: "building:casino:2",
      serverBuildingTypeId: "casino",
      serverDistrictId: "district:2",
      uiOwner: "legacy-shared"
    });
    expect(document.querySelector("[data-district-building-detail-popup]").textContent).not.toContain(
      "HOSTED RAW"
    );
    expect(document.querySelector("[data-district-popup-atmosphere-image]").getAttribute("src")).toContain("img/commercial/");
    expect(document.querySelector("[data-district-popup-atmosphere-label]").textContent).toBe("Komerční sektor");
    expect(document.querySelector("[data-district-popup-summary]").hidden).toBe(false);
    expect(document.querySelector("[data-district-popup-clean]").textContent).toBe("120");
    expect(document.querySelector("[data-district-popup-dirty]").textContent).toBe("45");
    expect(document.querySelector("[data-district-popup-influence]").textContent).toBe("6");
    expect(document.querySelector("[data-district-popup-population]").textContent).toBe("0 · žádný zdroj");
    expect(document.querySelector("[data-district-popup-population]").dataset.populationSourceSummary)
      .toBe("Pasivní populace: 0 / tick · žádný zdroj v districtu");

    document.querySelector("[data-district-building-detail-action-id='quiet_backroom']").click();
    await vi.waitFor(() => {
      expect(
        document.querySelector(".building-special-action-confirm:not([hidden])")
      ).not.toBeNull();
    });
    document.querySelector(".building-special-action-confirm__button--confirm").click();
    await vi.waitFor(() => expect(harness.handleSurfaceAction).toHaveBeenCalledTimes(2));
    const actionProxy = harness.handleSurfaceAction.mock.calls[1][0];
    expect(harness.scopeContainedAtCall[1]).toBe(true);
    expect(actionProxy.dataset).toMatchObject({
      buildingActionBuildingId: "building:casino:2",
      buildingActionId: "quiet_backroom"
    });

    expect(document.querySelector("[data-district-building-detail-action-id='craft:chemicals']")).toBeNull();
    expect(harness.handleSurfaceAction).toHaveBeenCalledTimes(2);
    expect(harness.scopeContainedAtCall.every(Boolean)).toBe(true);

    expect(harness.controller.destroy()).toBe(true);
    expect(harness.controller.destroy()).toBe(false);
    expect(document.querySelector("[data-district-popup]").parentElement.id).toBe("game-root");
  });

  it("renders one action for the opened foreign target and dispatches it once", async () => {
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

    const spyActions = document.querySelectorAll("[data-district-action-id='spy']");
    expect(spyActions).toHaveLength(1);
    expect(spyActions[0].dataset.districtActionTargetId).toBe("district:2");
    spyActions[0].click();
    await vi.waitFor(() => expect(harness.handleSurfaceAction).toHaveBeenCalledTimes(1));
    expect(harness.handleSurfaceAction.mock.calls[0][0].dataset.spyTargetId).toBe("district:2");
    harness.controller.destroy();
  });

  it("keeps a structurally valid rob action visible while the server temporarily disables it", () => {
    const harness = createHarness({
      targetActions: {
        spyTargets: [],
        occupyTargets: [],
        robTargets: [{
          sourceDistrictId: "district:1",
          districtId: "district:2",
          name: "Neon Quay",
          enabled: false,
          disabledReason: "K vykradení je potřeba alespoň 1 člen populace."
        }],
        heistTargets: [],
        attackTargets: []
      }
    });
    harness.controller.mount();
    harness.controller.handleDistrictSelected({
      districtId: "district:2",
      response: {
        accepted: true,
        readModel: harness.readModel,
        renderState: harness.renderState
      }
    });

    const robAction = document.querySelector("[data-district-action-id='rob']");
    expect(robAction).not.toBeNull();
    expect(robAction.disabled).toBe(true);
    expect(document.querySelector("[data-district-actions]").textContent).toContain(
      "K vykradení je potřeba alespoň 1 člen populace."
    );
    expect(document.querySelector("[data-district-action-id='trap']")).toBeNull();
    expect(document.querySelector("[data-district-action-key='remove-defense']")).toBeNull();
    harness.controller.destroy();
  });

  it("opens a requested server building type through the presentation surface", async () => {
    const harness = createHarness({ ownedByCurrentPlayer: true });
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

function createHarness({
  ownedByCurrentPlayer = false,
  intelKnown = ownedByCurrentPlayer,
  targetActions = null
} = {}) {
  const ownerPlayerId = ownedByCurrentPlayer ? "player:1" : "player:2";
  const resolvedTargetActions = targetActions ?? {
    spyTargets: ownedByCurrentPlayer ? [] : [{
      sourceDistrictId: "district:1",
      districtId: "district:2",
      name: "Neon Quay",
      enabled: true,
      disabledReason: null
    }],
    occupyTargets: [],
    robTargets: [],
    heistTargets: [],
    attackTargets: []
  };
  const readModel = {
    player: { playerId: "player:1" },
    economyRates: {
      selectedDistrict: ownedByCurrentPlayer ? {
        districtId: "district:2",
        cleanCashPerHour: 120,
        dirtyCashPerHour: 45,
        influencePerHour: 6,
        passivePopulationSources: [],
        passivePopulationSourceSummary:
          "Pasivní populace: 0 / tick · žádný zdroj v districtu"
      } : null
    },
    leaderboard: {
      currentPlayer: { playerId: "player:1", name: "Current Player" },
      entries: [{
        playerId: "player:2",
        name: "Player Two",
        factionId: "hackeri",
        avatarId: "hackeri:1",
        allianceTag: "NIGHT"
      }]
    },
    district: {
      districtId: "district:2",
      name: "Neon Quay",
      zone: "commercial",
      ownerPlayerId,
      isOwnedByPlayer: ownedByCurrentPlayer,
      status: "claimed",
      heat: 7,
      influence: 42,
      targetActions: resolvedTargetActions
    }
  };
  const building = {
    buildingId: "building:casino:2",
    buildingTypeId: "casino",
    label: "Neon Casino",
    typeLabel: "Kasino",
    zoneLabel: "Komerční",
    roleLabel: "HOSTED RAW ROLE",
    info: "HOSTED RAW INFO",
    statusLabel: "Aktivní · level 2",
    stats: [{ label: "Výnos", value: "$120" }],
    actions: [{
      actionId: "quiet_backroom",
      label: "Tichá herna",
      inputSummary: "Zdarma",
      outputSummary: "$120",
      cooldownLabel: "",
      cooldownRemainingMs: 0,
      disabled: false,
      disabledReason: null
    }],
    specialActions: [],
    productionLines: [{
      recipeId: "chemicals",
      label: "Chemikálie",
      statusLabel: "Připraveno",
      inputSummary: "360 čistých peněz",
      durationLabel: "2 min",
      canStart: true,
      disabledReason: null
    }]
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
      buildingSummary: intelKnown ? "1 pevná budova" : "Budovy nezjištěny",
      intelKnown,
      hasPendingCommand: false,
      trap: null,
      spyTargets: ownedByCurrentPlayer ? [] : [{
        districtId: "district:2",
        label: "Old Yard",
        disabled: false,
        disabledReason: null
      }],
      occupyTargets: [],
      robTargets: [],
      heistTargets: [],
      attackTargets: [{
        districtId: "district:4",
        label: "Locked Yard",
        disabled: true,
        disabledReason: "Chybí oprávnění."
      }],
      placeDefense: null,
      removeDefense: null,
      buildings: intelKnown ? [building] : [],
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
        <button data-district-popup-toggle aria-pressed="false">Přehled</button>
        <button data-district-popup-atmosphere aria-expanded="false">
          <img data-district-popup-atmosphere-image>
          <span data-district-popup-atmosphere-label></span>
        </button>
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
    <div data-district-atmosphere-window hidden>
      <button data-district-atmosphere-close>×</button>
      <img data-district-atmosphere-window-image>
      <span data-district-atmosphere-window-label></span>
      <p data-district-atmosphere-window-mood></p>
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
