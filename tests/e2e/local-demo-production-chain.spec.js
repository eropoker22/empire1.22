import { expect, test } from "@playwright/test";
import { dismissBlockingGameOverlays } from "./helpers/empireSmokeHelpers.js";

const SESSION_KEY = "empireStreets.session.v1";
const SCOPED_SESSION_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";

async function seedLocalDemo(page) {
  await page.addInitScript(({ sessionKey, scopedSessionKey }) => {
    window.EmpireConfigOverrides = Object.freeze({
      ...(window.EmpireConfigOverrides || {}),
      localDemoEnabled: true
    });
    window.__EMPIRE_E2E__ = true;
    const now = new Date().toISOString();
    const serverId = "instance:free:eu-central:public-1";
    const session = {
      registration: {
        identity: "Production QA",
        gangName: "Production QA Crew",
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
        startDistrictId: 1,
        preferredStartDistrictId: 1,
        factionLocked: true,
        hasCompletedServerEntry: true,
        serverRegistrationStatus: "faction_locked",
        lastLoginAt: now
      },
      world: {
        ownedDistrictIds: [1],
        phaseState: { gamePhase: "live", mapPhase: "night", cityMinutes: 1_334 },
        destroyedDistrictIds: [],
        districtDefenseById: {},
        districtDefenseLoadoutById: {},
        districtDefenseResidentsById: {},
        districtTrapById: {},
        districtGossipById: {},
        districtPoliceActionById: {}
      },
      inventory: {
        weapons: {},
        materials: { chemicals: 59, biomass: 20, "stim-pack": 0 },
        drugs: { "neon-dust": 0, "pulse-shot": 20, "velvet-smoke": 20, "ghost-serum": 0, "overdrive-x": 0 },
        factorySupplies: { metalParts: 40, techCore: 20, combatModule: 8 }
      },
      economy: { cleanMoney: 100_000, dirtyMoney: 10_000 },
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
        spyIntel: { occupiableDistrictIds: [], revealedTypeDistrictIds: [], revealedDefenseDistrictIds: [] }
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
    localStorage.setItem("empire:onboarding:v2:onboarding:Production%20QA", JSON.stringify({
      completed: true,
      skipped: true,
      currentStepId: "completed",
      dismissedAt: now,
      version: "demo-v1-clean"
    }));
  }, { sessionKey: SESSION_KEY, scopedSessionKey: SCOPED_SESSION_KEY });
}

async function openLocalGame(page) {
  await seedLocalDemo(page);
  await page.goto("/pages/game.html?runtimeMode=local-demo&autoStartLocalDemo=1", { waitUntil: "load" });
  await page.waitForFunction(() => (
    window.EmpireRuntime
    && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"
    && document.documentElement?.dataset?.runtimeMode === "local-demo"
  ));
  await dismissBlockingGameOverlays(page);
}

async function readSession(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), SESSION_KEY);
}

function metric(card, label) {
  return card.locator(".pharmacy-slot__metric,.drug-production-slot__metric")
    .filter({ hasText: label })
    .locator(".pharmacy-slot__metric-value,.drug-production-slot__metric-value,.drug-production-slot__metric-inline-value")
    .first();
}

function cardByHeading(page, scope, selector, label) {
  const exactLabel = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  return scope.locator(selector).filter({
    has: page.locator(".pharmacy-slot__title,.drug-production-slot__title").filter({ hasText: exactLabel })
  });
}

async function closePopup(page, popupSelector, closeSelector) {
  await page.locator(popupSelector).locator(closeSelector).last().click();
  await expect(page.locator(popupSelector)).toBeHidden();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
}

test("local-demo production chain credits inventory atomically without queues or collect", async ({ page }) => {
  test.setTimeout(90_000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  await openLocalGame(page);

  await page.locator("[data-pharmacy-popup-open]").click();
  const pharmacy = page.locator("[data-pharmacy-popup]");
  const chemicals = cardByHeading(page, pharmacy, ".pharmacy-slot", "Chemicals");
  await expect(pharmacy.locator(".pharmacy-slot")).toHaveCount(3);
  await expect(metric(chemicals, "Čas")).toHaveText("Okamžitě");
  await expect(metric(chemicals, "Fronta")).toHaveText("Bez fronty");
  await expect(metric(chemicals, "Ve skladu")).toHaveText("59/60 ks");
  await expect(chemicals.locator(".pharmacy-slot__quantity-btn").last()).toBeDisabled();
  await expect(chemicals.locator(".pharmacy-slot__btn--stop")).toHaveCount(0);
  const beforeChemicals = await readSession(page);
  await chemicals.getByRole("button", { name: "Vyrobit" }).click();
  await expect.poll(async () => (await readSession(page)).inventory.materials.chemicals).toBe(60);
  await expect.poll(async () => (await readSession(page)).economy.cleanMoney).toBe(beforeChemicals.economy.cleanMoney - 360);
  await expect(metric(chemicals, "Ve skladu")).toHaveText("60/60 ks");

  const biomass = cardByHeading(page, pharmacy, ".pharmacy-slot", "Biomass");
  await biomass.locator(".pharmacy-slot__quantity-btn").last().click();
  const beforeBiomass = await readSession(page);
  await biomass.getByRole("button", { name: "Vyrobit" }).click();
  await expect.poll(async () => (await readSession(page)).inventory.materials.biomass).toBe(22);
  await expect.poll(async () => (await readSession(page)).economy.cleanMoney).toBe(beforeBiomass.economy.cleanMoney - 840);
  await expect(metric(biomass, "Ve skladu")).toHaveText("22/60 ks");
  await expect(pharmacy.locator("[data-production-building-collect]")).toBeHidden();
  await closePopup(page, "[data-pharmacy-popup]", "[data-pharmacy-popup-close]");

  await page.locator("[data-druglab-popup-open]").click();
  const lab = page.locator("[data-druglab-popup]");
  const neonDust = cardByHeading(page, lab, ".drug-production-slot", "Neon Dust");
  await expect(lab.locator(".drug-production-slot")).toHaveCount(5);
  const beforeNeonDust = await readSession(page);
  await neonDust.getByRole("button", { name: "Vyrobit" }).click();
  await expect.poll(async () => (await readSession(page)).inventory.materials.chemicals).toBe(58);
  await expect.poll(async () => (await readSession(page)).inventory.drugs["neon-dust"]).toBe(1);
  await expect.poll(async () => (await readSession(page)).economy.cleanMoney).toBe(beforeNeonDust.economy.cleanMoney - 500);
  await expect(metric(neonDust, "Ve skladu")).toHaveText("1/60 ks");
  await expect(metric(neonDust, "Fronta")).toHaveText("Bez fronty");
  await expect(lab.locator("[data-production-building-collect]")).toBeHidden();
  await closePopup(page, "[data-druglab-popup]", "[data-druglab-popup-close]");

  await page.locator("[data-pharmacy-popup-open]").click();
  const chemicalsAfterLab = cardByHeading(page, pharmacy, ".pharmacy-slot", "Chemicals");
  await chemicalsAfterLab.locator(".pharmacy-slot__quantity-btn").last().click();
  const beforeSecondChemicals = await readSession(page);
  await chemicalsAfterLab.getByRole("button", { name: "Vyrobit" }).click();
  await expect.poll(async () => (await readSession(page)).inventory.materials.chemicals).toBe(60);
  await expect.poll(async () => (await readSession(page)).economy.cleanMoney).toBe(beforeSecondChemicals.economy.cleanMoney - 720);
  await expect(metric(chemicalsAfterLab, "Ve skladu")).toHaveText("60/60 ks");
  await closePopup(page, "[data-pharmacy-popup]", "[data-pharmacy-popup-close]");

  await page.locator("[data-factory-popup-open]").click();
  const factory = page.locator("[data-factory-popup]");
  await expect(factory.locator(".factory-slot")).toHaveCount(3);
  const metalParts = cardByHeading(page, factory, ".factory-slot", "Metal Parts");
  const beforeMetalParts = await readSession(page);
  await metalParts.getByRole("button", { name: "Vyrobit" }).click();
  await expect.poll(async () => (await readSession(page)).inventory.materials["metal-parts"]).toBe(41);
  await expect.poll(async () => (await readSession(page)).economy.cleanMoney).toBe(beforeMetalParts.economy.cleanMoney - 300);
  await expect(metric(metalParts, "Ve skladu")).toHaveText("41/60 ks");
  await expect(metric(metalParts, "Fronta")).toHaveText("Bez fronty");
  await expect(factory.locator("[data-factory-collect]")).toBeHidden();
  await closePopup(page, "[data-factory-popup]", "[data-factory-popup-close]");

  await page.locator("[data-armory-popup-open]").click();
  const armory = page.locator("[data-armory-popup]");
  await expect(armory.locator(".armory-slot")).toHaveCount(10);
  const smg = cardByHeading(page, armory, ".armory-slot", "SMG");
  await expect(smg.locator(".armory-slot__material-value")).toHaveText([/2\/\d+/, /1\/\d+/]);
  const beforeSmg = await readSession(page);
  await smg.getByRole("button", { name: "Vyrobit" }).click();
  await expect.poll(async () => (await readSession(page)).inventory.materials["metal-parts"]).toBe(beforeSmg.inventory.materials["metal-parts"] - 2);
  await expect.poll(async () => (await readSession(page)).inventory.materials["combat-module"]).toBe(beforeSmg.inventory.materials["combat-module"] - 1);
  await expect.poll(async () => (await readSession(page)).inventory.weapons.smg).toBe(1);
  await expect(metric(smg, "Ve skladu")).toHaveText("1/8 ks");

  const pistol = cardByHeading(page, armory, ".armory-slot", "Pistole");
  const beforePistol = await readSession(page);
  await pistol.getByRole("button", { name: "Vyrobit" }).click();
  await expect.poll(async () => (await readSession(page)).inventory.weapons.pistol).toBe(1);
  await expect.poll(async () => (await readSession(page)).inventory.materials["metal-parts"]).toBe(beforePistol.inventory.materials["metal-parts"] - 3);
  await expect.poll(async () => (await readSession(page)).inventory.materials["tech-core"]).toBe(beforePistol.inventory.materials["tech-core"] - 1);
  await expect(metric(pistol, "Ve skladu")).toHaveText("1/24 ks");
  await expect(armory.locator("[data-production-building-collect]")).toBeHidden();
  await closePopup(page, "[data-armory-popup]", "[data-armory-popup-close]");

  await page.locator("[data-storage-popup-open]").click();
  await expect(page.locator('[data-storage-resource="chemicals"] [data-storage-value]')).toHaveText("60 / 60");
  await expect(page.locator('[data-storage-resource="smg"] [data-storage-value]')).toHaveText("1 / 8");
  await expect(page.locator('[data-storage-resource="pistol"] [data-storage-value]')).toHaveText("1 / 24");
  await closePopup(page, "[data-storage-popup]", "[data-storage-popup-close]");

  expect(await page.evaluate(() => window.EmpireRuntime.openAttackPanel(2))).toBe(true);
  const attackSetup = page.locator("[data-attack-setup-popup]");
  await expect(attackSetup).toBeVisible();
  await expect(attackSetup).toContainText("SMG");
  await expect(attackSetup).toContainText(/1/);
  expect((await readSession(page)).production.jobs).toEqual({});
  expect(runtimeErrors).toEqual([]);
});
