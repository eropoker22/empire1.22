// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createServerGameplayReportController
} from "../../page-assets/js/app/ui/serverGameplayReportController.js";
import {
  createServerBattleResultView,
  createServerReportFeedEntries,
  createServerSpyResultView
} from "../../page-assets/js/app/ui/serverGameplayReportViewModel.js";

describe("server gameplay report controller", () => {
  beforeEach(() => {
    document.body.innerHTML = createFixture();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("maps authoritative battle and spy reports without gameplay mutation", () => {
    expect(createServerBattleResultView(createBattleReport())).toMatchObject({
      tone: "is-total-success",
      districtName: "district:target",
      districtStateValue: "Dobytý",
      attackerLossesLabel: "2 Pistol"
    });
    expect(createServerSpyResultView(createSpyReport())).toMatchObject({
      tone: "is-success",
      title: "Výsledek špehování"
    });
  });

  it("renders an active critical spy capture as a red ten-minute street-news countdown", () => {
    const generatedAt = "2026-07-26T10:00:00.000Z";
    const [entry] = createServerReportFeedEntries([
      createSpyReport({
        result: "critical_failed",
        tick: 120,
        blockedUntilTick: 180
      })
    ], {
      server: {
        currentTick: 120,
        generatedAt
      },
      mode: {
        tickRateMs: 10_000
      }
    });

    expect(entry).toMatchObject({
      tone: "error",
      title: "ŠPEH ZAJAT",
      summary: "",
      sourceKind: "cooldown",
      compact: true,
      countdownStyle: "words",
      countdownPrefix: "",
      expiresAt: Date.parse(generatedAt) + (10 * 60 * 1000),
      persistent: true
    });
  });

  it("renders authoritative heist and robbery reports in the street feed", () => {
    const entries = createServerReportFeedEntries([
      createHeistReport(),
      createRobReport()
    ]);

    expect(entries).toEqual([
      expect.objectContaining({
        title: "Heist · district:target",
        tone: "warning",
        summary: expect.stringContaining("útočník byl odhalen")
      }),
      expect.objectContaining({
        title: "Vykradení · district:neutral",
        tone: "warning",
        summary: expect.stringContaining("uspělo částečně")
      })
    ]);
  });

  it("contains no command, local persistence or gameplay scheduler path", () => {
    const source = readFileSync(resolve(
      process.cwd(),
      "page-assets/js/app/ui/serverGameplayReportController.js"
    ), "utf8");
    expect(source).not.toMatch(
      /submitCommand|handleSurfaceAction|localStorage|sessionStorage|setInterval|requestAnimationFrame|runtime\.js/u
    );
  });

  it("renders the initial report history without opening stale result modals", () => {
    const controller = createController();
    controller.mount();
    controller.update({ reports: [createBattleReport()] });

    expect(document.querySelector("[data-building-action-feed]").children).toHaveLength(1);
    expect(document.querySelector("#attack-result-modal").classList.contains("hidden")).toBe(true);
    expect(controller.getDiagnostics()).toMatchObject({
      feedRenders: 1,
      modalOpens: 0,
      pendingResults: 0
    });
  });

  it("opens only newly arrived results and ignores equivalent polling models", () => {
    const controller = createController();
    const initial = createBattleReport({ reportId: "battle:old" });
    const latest = createBattleReport({ reportId: "battle:new" });
    controller.mount();
    controller.update({ reports: [initial] });
    const firstFeedItem = document.querySelector("[data-building-action-feed]").firstElementChild;

    controller.update({ reports: [latest, initial] });
    expect(document.querySelector("#attack-result-modal").classList.contains("hidden")).toBe(false);
    expect(document.querySelector("#attack-result-modal-nickname").textContent).toBe("district:target");
    expect(controller.getDiagnostics().modalOpens).toBe(1);

    document.querySelector("#attack-result-modal-close").click();
    const renderedFeedItem = document.querySelector("[data-building-action-feed]").firstElementChild;
    controller.update({ reports: structuredClone([latest, initial]) });
    expect(document.querySelector("#attack-result-modal").classList.contains("hidden")).toBe(true);
    expect(controller.getDiagnostics().modalOpens).toBe(1);
    expect(document.querySelector("[data-building-action-feed]").firstElementChild).not.toBe(firstFeedItem);
    expect(document.querySelector("[data-building-action-feed]").firstElementChild).toBe(renderedFeedItem);
    expect(controller.getDiagnostics().feedRenders).toBe(2);
  });

  it("queues new spy results behind an open battle modal and cleans listeners", () => {
    const controller = createController();
    const initial = createBattleReport({ reportId: "battle:old" });
    const battle = createBattleReport({ reportId: "battle:new" });
    const spy = createSpyReport({ reportId: "spy:new" });
    controller.mount();
    controller.update({ reports: [initial] });
    controller.update({ reports: [spy, battle, initial] });

    expect(document.querySelector("#attack-result-modal").classList.contains("hidden")).toBe(false);
    expect(controller.getDiagnostics().pendingResults).toBe(1);
    document.querySelector("#attack-result-modal-backdrop").click();
    expect(document.querySelector("#spy-result-modal").classList.contains("hidden")).toBe(false);
    expect(document.querySelector("#spy-result-modal-summary").textContent).toContain("Obrana potvrzena");

    controller.destroy();
    document.querySelector("#spy-result-modal").classList.remove("hidden");
    document.querySelector("#spy-result-modal-close").click();
    expect(document.querySelector("#spy-result-modal").classList.contains("hidden")).toBe(false);
  });
});

function createController() {
  return createServerGameplayReportController({
    root: document.querySelector("#game-root"),
    documentRef: document
  });
}

function createBattleReport(overrides = {}) {
  return {
    reportId: "battle:1",
    reportType: "battle",
    actionType: "attack-district",
    playerId: "player:attacker",
    attackerPlayerId: "player:attacker",
    defenderPlayerId: "player:defender",
    sourceDistrictId: "district:source",
    targetDistrictId: "district:target",
    result: "success",
    outcomeTier: "clean_capture",
    districtCaptured: true,
    districtDestroyed: false,
    districtDamaged: false,
    trapTriggered: false,
    attackerLosses: { pistol: 2 },
    defenderLosses: { barricade: 1 },
    detectedDefense: {},
    combatPopulationLoss: 1,
    occupationPopulationLoss: 2,
    defenderPopulationLoss: 3,
    vestPopulationSaved: 0,
    survivingDefenseAbandoned: false,
    catastropheBaseChance: 0,
    bazookaCatastropheBonus: 0,
    catastropheFinalChance: 0,
    heatGained: 4,
    reportForAttacker: "District je pod tvojí kontrolou.",
    reportForDefender: "District padl.",
    attackDurationTicks: 12,
    tick: 24,
    createdAt: "2026-07-26T10:00:00.000Z",
    eventId: "event:1",
    ...overrides
  };
}

function createSpyReport(overrides = {}) {
  return {
    reportId: "spy:1",
    reportType: "spy",
    actionType: "spy-district",
    playerId: "player:attacker",
    attackerPlayerId: "player:attacker",
    sourceDistrictId: "district:source",
    targetDistrictId: "district:target",
    targetOwnerPlayerId: "player:defender",
    targetSecurityRevision: 3,
    authorizationScope: "attack_owned_district",
    issuedAtTick: 20,
    authorizationExpiresAtTick: 40,
    result: "success",
    detectedDefense: { camera: 2 },
    trapDetected: true,
    occupyUnlocked: true,
    revealedType: true,
    revealedDefense: true,
    heatGained: 1,
    blockedUntilTick: null,
    tick: 24,
    createdAt: "2026-07-26T10:00:00.000Z",
    eventId: "event:2",
    ...overrides
  };
}

function createHeistReport(overrides = {}) {
  return {
    reportId: "heist:1",
    reportType: "heist",
    actionType: "heist-district",
    playerId: "player:attacker",
    sourceDistrictId: "district:source",
    targetDistrictId: "district:target",
    targetOwnerPlayerId: "player:defender",
    style: "balanced",
    result: "detected",
    loot: { cash: 120 },
    gangLosses: 2,
    heatGained: 4,
    successChance: 0.7,
    detectionChance: 0.4,
    attackerIdentified: true,
    tick: 24,
    createdAt: "2026-07-26T10:00:00.000Z",
    eventId: null,
    ...overrides
  };
}

function createRobReport(overrides = {}) {
  return {
    reportId: "rob:1",
    reportType: "rob",
    actionType: "rob-district",
    playerId: "player:attacker",
    sourceDistrictId: "district:source",
    targetDistrictId: "district:neutral",
    result: "partial",
    loot: { "dirty-cash": 80 },
    playerHeat: 2,
    districtHeat: 1,
    cooldownTicks: 4,
    poolChangedBeforeResolution: false,
    expectedLootPoolRevision: 1,
    resolvedLootPoolRevision: 1,
    tick: 25,
    createdAt: "2026-07-26T10:00:00.000Z",
    eventId: null,
    ...overrides
  };
}

function createFixture() {
  return `<main id="game-root">
    <strong data-building-action-state></strong>
    <button data-building-action-clear></button>
    <p data-building-action-summary></p>
    <p data-building-action-meta></p>
    <p data-building-action-empty></p>
    <div data-building-action-feed></div>
    <div id="spy-result-modal" class="modal hidden">
      <button id="spy-result-modal-backdrop"></button>
      <div id="spy-result-modal-content">
        <h3 id="spy-result-modal-title"></h3>
        <button id="spy-result-modal-close"></button>
        <p id="spy-result-modal-summary"></p>
        <div id="spy-result-modal-details"></div>
      </div>
    </div>
    <div id="attack-result-modal" class="modal hidden">
      <button id="attack-result-modal-backdrop"></button>
      <div id="attack-result-modal-content">
        <h3 id="attack-result-modal-title"></h3>
        <button id="attack-result-modal-close"></button>
        <span id="attack-result-modal-badge"></span>
        <p id="attack-result-modal-summary"></p>
        <div id="attack-result-modal-stats">
          ${battleRow("attack-result-modal-label-target", "attack-result-modal-nickname")}
          ${battleRow("attack-result-modal-label-attack", "attack-result-modal-faction")}
          ${battleRow("attack-result-modal-label-defense", "attack-result-modal-alliance")}
          ${battleRow("attack-result-modal-label-attack-losses", "attack-result-modal-weapons")}
          ${battleRow("attack-result-modal-label-defense-losses", "attack-result-modal-power")}
          ${battleRow("attack-result-modal-label-state", "attack-result-modal-members")}
          ${battleRow("attack-result-modal-label-duration", "attack-result-modal-duration")}
        </div>
      </div>
    </div>
  </main>`;
}

function battleRow(labelId, valueId) {
  return `<div class="modal__row"><span id="${labelId}"></span><strong id="${valueId}"></strong></div>`;
}
