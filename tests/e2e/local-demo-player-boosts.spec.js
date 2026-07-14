import { expect, test } from "@playwright/test";
import {
  CURRENT_PLAYER_ID,
  START_PHASE_OWNER_COORDINATES
} from "../../page-assets/js/app/onboarding/demoScenarios.js";
import {
  createDistrictGeometry,
  createLaunchOwnerMap
} from "../../page-assets/js/app/map/mapGeometry.js";

const SESSION_KEY = "empireStreets.session.v1";
const SCOPED_SESSION_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";
const START_TIME = new Date("2026-07-14T18:00:00.000Z");
const launchOwners = createLaunchOwnerMap(START_PHASE_OWNER_COORDINATES);
const launchGeometry = createDistrictGeometry(1_200, 800);
const pvpTarget = Array.from(launchOwners.entries())
  .map(([districtId, ownerId]) => ({
    districtId,
    ownerId,
    district: launchGeometry.districts.find((candidate) => candidate.id === districtId)
  }))
  .find((candidate) => (
    candidate.ownerId !== CURRENT_PLAYER_ID
    && candidate.district?.legacyNeighborIds?.length > 0
  ));
const PVP_TARGET_DISTRICT_ID = pvpTarget?.districtId ?? 5;
const PVP_SOURCE_DISTRICT_ID = pvpTarget?.district?.legacyNeighborIds?.[0] ?? 4;

async function seedBoostSession(page) {
  await page.addInitScript(({ sessionKey, scopedSessionKey, sourceDistrictId, targetDistrictId }) => {
    window.__EMPIRE_E2E__ = true;
    const now = new Date().toISOString();
    const serverId = "instance:free:eu-central:public-1";
    const session = {
      registration: {
        identity: "Boost QA",
        gangName: "Protocol QA Crew",
        isGuest: true,
        loginKind: "guest",
        serverId,
        serverInstanceId: serverId,
        activeServerId: serverId,
        activeServerInstanceId: serverId,
        serverMode: "free",
        activeServerMode: "free",
        factionId: "mafian",
        selectedFaction: "mafian",
        startDistrictId: sourceDistrictId,
        preferredStartDistrictId: sourceDistrictId,
        factionLocked: true,
        hasCompletedServerEntry: true,
        serverRegistrationStatus: "faction_locked",
        lastLoginAt: now
      },
      world: {
        ownedDistrictIds: [sourceDistrictId],
        phaseState: { gamePhase: "live", mapPhase: "night", cityMinutes: 1_334 },
        destroyedDistrictIds: [],
        districtDefenseById: { [targetDistrictId]: 4 },
        districtDefenseLoadoutById: {},
        districtDefenseResidentsById: {},
        districtTrapById: {},
        districtGossipById: {},
        districtPoliceActionById: {}
      },
      inventory: {
        weapons: { pistol: 8 },
        materials: { chemicals: 0, biomass: 0, "stim-pack": 0 },
        drugs: {
          "neon-dust": 0,
          "pulse-shot": 8,
          "velvet-smoke": 0,
          "ghost-serum": 8,
          "overdrive-x": 8
        },
        factorySupplies: { metalParts: 0, techCore: 0, combatModule: 8 }
      },
      economy: { cleanMoney: 50_000, dirtyMoney: 0 },
      gang: {
        members: 30,
        population: 30,
        heat: 0,
        influence: 0,
        policeRaidProtectionUntil: 0,
        autoPoliceNextActionAt: 0,
        heatJournal: [],
        dirtyHeatReductionTimestamps: [],
        lastHeatDecayAt: now
      },
      missions: {
        attackOrders: [],
        occupyOrders: [],
        robberyOrders: [],
        spy: { available: 3, missions: [] },
        spyIntel: {
          occupiableDistrictIds: [],
          revealedTypeDistrictIds: [targetDistrictId],
          revealedDefenseDistrictIds: [targetDistrictId]
        }
      },
      production: {
        jobs: {},
        streetDealers: { slots: [] },
        factory: { level: 1, resources: {}, slots: [], updatedAt: Date.now() },
        buildings: { pharmacy: { level: 1 }, druglab: { level: 1 }, armory: { level: 1 } }
      }
    };
    localStorage.clear();
    localStorage.setItem("empire:active_guest_mode", "free");
    localStorage.setItem("empire:active_mode", "free");
    localStorage.setItem(sessionKey, JSON.stringify(session));
    localStorage.setItem(scopedSessionKey, JSON.stringify(session));
    localStorage.setItem("empire:onboarding:demo-v1:dev-only:Boost%20QA", JSON.stringify({
      completed: true,
      skipped: true,
      currentStepId: "completed",
      dismissedAt: now,
      version: "demo-v1-clean"
    }));
  }, {
    sessionKey: SESSION_KEY,
    scopedSessionKey: SCOPED_SESSION_KEY,
    sourceDistrictId: PVP_SOURCE_DISTRICT_ID,
    targetDistrictId: PVP_TARGET_DISTRICT_ID
  });
}

async function openBoostGame(page) {
  await page.clock.install({ time: START_TIME });
  await seedBoostSession(page);
  await page.goto("/pages/game.html", { waitUntil: "load" });
  await page.waitForFunction(() => (
    window.EmpireRuntime
    && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"
    && document.documentElement?.dataset?.runtimeMode === "local-demo"
  ));
}

async function readSession(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), SESSION_KEY);
}

async function activateBoost(page, boostId) {
  const card = page.locator(`[data-boost-card="${boostId}"]`);
  await card.locator(`[data-boost-activate="${boostId}"]`).click();
  await expect(page.locator("#boost-modal-confirmation")).toBeVisible();
  await page.locator("[data-boost-confirm-submit]").click();
  await expect(page.locator("#boost-modal-confirmation")).toBeHidden();
  return card;
}

test("strategic boosts debit once, expire, and Tactical Grid is consumed by valid PvP", async ({ page }) => {
  test.setTimeout(90_000);
  const runtimeErrors = [];
  const boostNetworkErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      runtimeErrors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (
      response.status() >= 400
      && /boost-runtime|styles-boost|gameplay-config\.generated/u.test(response.url())
    ) {
      boostNetworkErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await openBoostGame(page);
  const mapBoostTrigger = page.locator("[data-boost-open-trigger]").first();
  await mapBoostTrigger.click();
  await expect(page.locator("#boost-modal")).toBeVisible();
  await expect(page.locator("[data-boost-card]")).toHaveCount(3);
  await expect(page.locator("#boost-modal-content")).not.toContainText(/Assault|Rapid|Breach/);
  const mobileLayout = await page.evaluate(() => {
    const body = document.querySelector(".boost-modal__body");
    const content = document.querySelector("#boost-modal-content");
    const cards = [...document.querySelectorAll("[data-boost-card]")];
    const bounds = content?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      contentLeft: bounds?.left ?? -1,
      contentRight: bounds?.right ?? Number.POSITIVE_INFINITY,
      cardColumns: new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size,
      scrollHeight: body?.scrollHeight ?? 0,
      clientHeight: body?.clientHeight ?? 0,
      rootLocked: document.documentElement.classList.contains("game-modal-scroll-locked"),
      bodyLocked: document.body.classList.contains("game-modal-scroll-locked")
    };
  });
  expect(mobileLayout.documentWidth).toBeLessThanOrEqual(mobileLayout.viewportWidth + 1);
  expect(mobileLayout.contentLeft).toBeGreaterThanOrEqual(0);
  expect(mobileLayout.contentRight).toBeLessThanOrEqual(390);
  expect(mobileLayout.cardColumns).toBe(1);
  expect(mobileLayout.scrollHeight).toBeGreaterThan(mobileLayout.clientHeight);
  expect(mobileLayout.rootLocked || mobileLayout.bodyLocked).toBe(true);
  await page.locator('[data-boost-card="tactical-grid"]').scrollIntoViewIfNeeded();
  expect(await page.locator(".boost-modal__body").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await page.locator("#boost-modal-close").click();
  await expect(page.locator("#boost-modal")).toBeHidden();
  await expect(mapBoostTrigger).toBeFocused();
  expect(await page.evaluate(() => (
    document.documentElement.classList.contains("game-modal-scroll-locked")
    || document.body.classList.contains("game-modal-scroll-locked")
  ))).toBe(false);

  await page.setViewportSize({ width: 1366, height: 768 });
  await mapBoostTrigger.click();
  await expect(page.locator("#boost-modal")).toBeVisible();
  const desktopLayout = await page.locator("[data-boost-card]").evaluateAll((cards) => ({
    columns: new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size,
    tops: cards.map((card) => Math.round(card.getBoundingClientRect().top)),
    heights: cards.map((card) => Math.round(card.getBoundingClientRect().height))
  }));
  expect(desktopLayout.columns).toBe(3);
  expect(Math.max(...desktopLayout.tops) - Math.min(...desktopLayout.tops)).toBeLessThanOrEqual(2);
  expect(Math.max(...desktopLayout.heights) - Math.min(...desktopLayout.heights)).toBeLessThanOrEqual(2);

  const beforeGhost = await readSession(page);
  const ghostCard = await activateBoost(page, "ghost-network");
  await expect(ghostCard.locator("[data-boost-button-label]")).toContainText("AKTIVNÍ");
  await expect(page.locator("[data-boost-open-trigger]").first()).toContainText("BOOST");
  await expect(page.locator("[data-player-boost-pinned]")).toBeVisible();
  await expect(page.locator("[data-player-boost-pinned]")).toContainText("GHOST NETWORK");
  await expect(page.locator('[data-boost-card="industrial-overdrive"] [data-boost-button-label]')).toContainText("BLOKOVÁNO");

  const afterGhost = await readSession(page);
  expect(afterGhost.economy.cleanMoney).toBe(beforeGhost.economy.cleanMoney - 5_000);
  expect(afterGhost.inventory.drugs["ghost-serum"]).toBe(beforeGhost.inventory.drugs["ghost-serum"] - 2);
  expect(afterGhost.inventory.drugs["pulse-shot"]).toBe(beforeGhost.inventory.drugs["pulse-shot"] - 2);

  await page.clock.fastForward(12 * 60_000 + 1_000);
  await expect(page.locator("[data-player-boost-pinned]")).toBeHidden();
  await expect(page.locator('[data-boost-card="tactical-grid"] [data-boost-button-label]')).toHaveText("AKTIVOVAT");

  const tacticalCard = await activateBoost(page, "tactical-grid");
  await expect(tacticalCard.locator("[data-boost-button-label]")).toContainText("NABITO");
  await expect(page.locator("[data-player-boost-pinned]")).toContainText("TACTICAL GRID");

  await page.locator("#boost-modal-close").click();
  await expect(page.locator("#boost-modal")).toBeHidden();
  expect(await page.evaluate((districtId) => window.EmpireRuntime.openAttackPanel(districtId), PVP_TARGET_DISTRICT_ID)).toBe(true);
  const attackSetup = page.locator("[data-attack-setup-popup]");
  await expect(attackSetup).toBeVisible();
  await attackSetup.locator('[data-attack-weapon-input="pistol"]').fill("1");
  await expect(attackSetup.locator("[data-attack-confirm]")).toBeEnabled();
  await attackSetup.locator("[data-attack-confirm]").click();
  await expect(page.locator("[data-attack-confirm-popup]")).toBeVisible();
  await page.locator("[data-attack-confirm-button]").click();

  const afterAttackAccepted = await readSession(page);
  expect(afterAttackAccepted.playerBoosts.active).toBeNull();
  expect(afterAttackAccepted.playerBoosts.cooldownUntilMsByBoostId["tactical-grid"]).toBeGreaterThan(Date.now());
  expect(afterAttackAccepted.missions.attackOrders).toHaveLength(1);
  expect(afterAttackAccepted.missions.attackOrders[0].tacticalGrid.appliedMultiplier).toBe(1.12);
  await expect(page.locator("[data-player-boost-pinned]")).toBeHidden();

  const attackDurationMs = await page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key) || "{}");
    const order = session.missions?.attackOrders?.[0];
    return new Date(order.resolveAt).getTime() - new Date(order.createdAt).getTime();
  }, SESSION_KEY);
  await page.clock.fastForward(attackDurationMs + 1_000);
  await expect(page.locator("#attack-result-modal")).toBeVisible();
  await expect(page.locator("#attack-result-modal-summary")).toContainText("Tactical Grid: +12 % bojové síly");
  await expect(page.locator("#attack-result-modal-stats")).toContainText("Tactical Grid: +12 % bojové síly");
  expect((await readSession(page)).playerBoosts.active).toBeNull();
  expect(runtimeErrors).toEqual([]);
  expect(boostNetworkErrors).toEqual([]);
});
