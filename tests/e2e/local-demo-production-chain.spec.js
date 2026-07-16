import { expect, test } from "@playwright/test";

const SESSION_KEY = "empireStreets.session.v1";
const SCOPED_SESSION_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";

async function seedLocalDemo(page) {
  await page.addInitScript(({ sessionKey, scopedSessionKey }) => {
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
    localStorage.setItem("empire:onboarding:demo-v1:dev-only:Production%20QA", JSON.stringify({
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

async function readProductionJob(page, jobKey) {
  return (await readSession(page)).production?.jobs?.[jobKey] || null;
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

async function finishProductionJob(page, jobKey) {
  await page.evaluate((key) => window.EmpireRuntime.advanceLocalProductionJobForE2e(key), jobKey);
}

async function finishFactoryUnit(page, resourceKey) {
  await page.evaluate((key) => window.EmpireRuntime.advanceFactoryProductionForE2e(key), resourceKey);
}

async function closePopup(page, popupSelector, closeSelector) {
  await page.locator(popupSelector).locator(closeSelector).last().click();
  await expect(page.locator(popupSelector)).toBeHidden();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
}

test("local-demo production chain keeps queues, partial collect and inventory synchronized", async ({ page }) => {
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
  const cleanBeforeChemicals = (await readSession(page)).economy.cleanMoney;
  await chemicals.locator(".pharmacy-slot__quantity-btn").last().click();
  await chemicals.getByRole("button", { name: "Spustit" }).click();
  await expect(metric(chemicals, "Ve frontě")).toHaveText("2/8 ks");
  const chemicalsJob = await readProductionJob(page, "pharmacy:chemicals");
  expect(chemicalsJob.cleanMoneyCost).toBe(720);
  expect((await readSession(page)).economy.cleanMoney).toBeLessThan(cleanBeforeChemicals);

  await finishProductionJob(page, "pharmacy:chemicals");
  await finishProductionJob(page, "pharmacy:chemicals");
  await expect(metric(chemicals, "Vyrobeno")).toHaveText("2/12 ks");
  await expect(metric(chemicals, "Ve frontě")).toHaveText("0/8 ks");
  await pharmacy.locator("[data-production-building-collect]").click();
  await expect(metric(chemicals, "Vyrobeno")).toHaveText("1/12 ks");
  expect((await readSession(page)).inventory.materials.chemicals).toBe(60);

  const biomass = cardByHeading(page, pharmacy, ".pharmacy-slot", "Biomass");
  await biomass.locator(".pharmacy-slot__quantity-btn").last().click();
  await biomass.getByRole("button", { name: "Spustit" }).click();
  const cleanAfterBiomassStart = (await readSession(page)).economy.cleanMoney;
  const reservedBeforeCancel = (await readProductionJob(page, "pharmacy:biomass")).cleanMoneyCost;
  await biomass.getByRole("button", { name: "Zrušit" }).click();
  await expect(metric(biomass, "Ve frontě")).toHaveText("1/6 ks");
  const cleanAfterCancel = (await readSession(page)).economy.cleanMoney;
  const reservedAfterCancel = (await readProductionJob(page, "pharmacy:biomass")).cleanMoneyCost;
  expect(cleanAfterCancel - cleanAfterBiomassStart).toBeGreaterThanOrEqual(420);
  expect(reservedBeforeCancel - reservedAfterCancel).toBe(420);
  await expect(biomass.getByRole("button", { name: "Zrušit" })).toBeDisabled();
  await closePopup(page, "[data-pharmacy-popup]", "[data-pharmacy-popup-close]");

  await page.locator("[data-druglab-popup-open]").click();
  const lab = page.locator("[data-druglab-popup]");
  const neonDust = cardByHeading(page, lab, ".drug-production-slot", "Neon Dust");
  await expect(lab.locator(".drug-production-slot")).toHaveCount(5);
  await neonDust.getByRole("button", { name: "Spustit" }).click();
  expect((await readSession(page)).inventory.materials.chemicals).toBe(58);
  await finishProductionJob(page, "druglab:neon-dust");
  await expect(metric(neonDust, "Vyrobeno")).toHaveText("1/10 ks");
  await lab.locator("[data-production-building-collect]").click();
  expect((await readSession(page)).inventory.drugs["neon-dust"]).toBe(1);
  await closePopup(page, "[data-druglab-popup]", "[data-druglab-popup-close]");

  await page.locator("[data-pharmacy-popup-open]").click();
  await pharmacy.locator("[data-production-building-collect]").click();
  expect((await readSession(page)).inventory.materials.chemicals).toBe(59);
  await closePopup(page, "[data-pharmacy-popup]", "[data-pharmacy-popup-close]");

  await page.locator("[data-factory-popup-open]").click();
  const factory = page.locator("[data-factory-popup]");
  await expect(factory.locator(".factory-slot")).toHaveCount(3);
  await cardByHeading(page, factory, ".factory-slot", "Metal Parts").getByRole("button", { name: "Spustit" }).click();
  await finishFactoryUnit(page, "metalParts");
  await expect(factory.locator("[data-factory-resource-metal]")).toHaveText(/^1\s*\/\s*10$/);
  await factory.locator("[data-factory-collect]").click();
  await closePopup(page, "[data-factory-popup]", "[data-factory-popup-close]");

  await page.locator("[data-armory-popup-open]").click();
  const armory = page.locator("[data-armory-popup]");
  await expect(armory.locator(".armory-slot")).toHaveCount(10);
  const smg = cardByHeading(page, armory, ".armory-slot", "SMG");
  await expect(smg.locator(".armory-slot__material-value")).toHaveText([/2\/\d+/, /1\/\d+/]);
  const beforeSmg = await readSession(page);
  await smg.getByRole("button", { name: "Spustit" }).click();
  const afterSmg = await readSession(page);
  expect(afterSmg.inventory.materials["metal-parts"]).toBe(beforeSmg.inventory.materials["metal-parts"] - 2);
  expect(afterSmg.inventory.materials["combat-module"]).toBe(beforeSmg.inventory.materials["combat-module"] - 1);
  await finishProductionJob(page, "armory:smg");
  await expect(metric(smg, "Vyrobeno")).toHaveText("1/3 ks");
  await armory.locator("[data-production-building-collect]").click();
  expect((await readSession(page)).inventory.weapons.smg).toBe(1);

  const pistol = cardByHeading(page, armory, ".armory-slot", "Pistole");
  for (let index = 1; index < 4; index += 1) await pistol.locator(".armory-slot__quantity-btn").last().click();
  await pistol.getByRole("button", { name: "Spustit" }).click();
  await expect(metric(pistol, "Ve frontě")).toHaveText("4/4 ks");
  await expect(pistol.locator(".armory-slot__quantity-btn").last()).toBeDisabled();
  await expect(pistol.getByRole("button", { name: "Spustit" })).toBeDisabled();
  await closePopup(page, "[data-armory-popup]", "[data-armory-popup-close]");

  await page.locator("[data-storage-popup-open]").click();
  await expect(page.locator('[data-storage-resource="chemicals"] [data-storage-value]')).toHaveText("59 / 60");
  await expect(page.locator('[data-storage-resource="smg"] [data-storage-value]')).toHaveText("1 / 8");
  await closePopup(page, "[data-storage-popup]", "[data-storage-popup-close]");

  expect(await page.evaluate(() => window.EmpireRuntime.openAttackPanel(2))).toBe(true);
  const attackSetup = page.locator("[data-attack-setup-popup]");
  await expect(attackSetup).toBeVisible();
  await expect(attackSetup).toContainText("SMG");
  await expect(attackSetup).toContainText(/1/);
  expect(runtimeErrors).toEqual([]);
});
