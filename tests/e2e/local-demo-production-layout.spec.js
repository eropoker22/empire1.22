import { expect, test } from "@playwright/test";

const SESSION_KEY = "empireStreets.session.v1";
const SCOPED_SESSION_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";

async function openLocalGame(page) {
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
        identity: "Production Layout QA", gangName: "Production Layout QA", isGuest: true,
        loginKind: "guest", serverId, serverInstanceId: serverId, activeServerId: serverId,
        activeServerInstanceId: serverId, serverMode: "free", activeServerMode: "free",
        factionId: "mafian", selectedFaction: "mafian", startDistrictId: 1,
        preferredStartDistrictId: 1, factionLocked: true, hasCompletedServerEntry: true,
        serverRegistrationStatus: "faction_locked", lastLoginAt: now
      },
      world: { ownedDistrictIds: [1], phaseState: { gamePhase: "live", mapPhase: "night", cityMinutes: 1_334 } },
      inventory: {
        weapons: {}, materials: { chemicals: 20, biomass: 20, "stim-pack": 0 },
        drugs: { "neon-dust": 10, "pulse-shot": 10, "velvet-smoke": 10 },
        factorySupplies: { metalParts: 40, techCore: 20, combatModule: 8 }
      },
      economy: { cleanMoney: 100_000, dirtyMoney: 10_000 },
      gang: { members: 30, population: 30, heat: 0, influence: 0, lastHeatDecayAt: now },
      missions: { attackOrders: [], occupyOrders: [], robberyOrders: [], spy: { available: 3, missions: [] } },
      production: {
        jobs: {}, factory: { level: 1, resources: {}, slots: [], updatedAt: Date.now() },
        buildings: { pharmacy: { level: 1 }, druglab: { level: 1 }, armory: { level: 1 } }
      }
    };
    localStorage.clear();
    localStorage.setItem("empire:active_guest_mode", "free");
    localStorage.setItem("empire:active_mode", "free");
    localStorage.setItem(sessionKey, JSON.stringify(session));
    localStorage.setItem(scopedSessionKey, JSON.stringify(session));
    localStorage.setItem("empire:onboarding:demo-v1:dev-only:Production%20Layout%20QA", JSON.stringify({
      completed: true, skipped: true, currentStepId: "completed", dismissedAt: now, version: "demo-v1-clean"
    }));
  }, { sessionKey: SESSION_KEY, scopedSessionKey: SCOPED_SESSION_KEY });
  await page.goto("/pages/game.html", { waitUntil: "load" });
  await page.waitForFunction(() => (
    window.EmpireRuntime
    && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"
    && document.documentElement?.dataset?.runtimeMode === "local-demo"
  ));
}

async function closePopup(page, popupSelector, closeSelector) {
  await page.locator(popupSelector).locator(closeSelector).last().click();
  await expect(page.locator(popupSelector)).toBeHidden();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
}

for (const viewport of [
  { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 },
  { width: 1280, height: 720 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }
]) {
  test(`production popups fit ${viewport.width}x${viewport.height} and release scroll lock`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openLocalGame(page);
    for (const [openSelector, popupSelector, closeSelector, cardCount] of [
      ["[data-pharmacy-popup-open]", "[data-pharmacy-popup]", "[data-pharmacy-popup-close]", 3],
      ["[data-druglab-popup-open]", "[data-druglab-popup]", "[data-druglab-popup-close]", 5],
      ["[data-factory-popup-open]", "[data-factory-popup]", "[data-factory-popup-close]", 3],
      ["[data-armory-popup-open]", "[data-armory-popup]", "[data-armory-popup-close]", 10]
    ]) {
      await page.locator(openSelector).click();
      const popup = page.locator(popupSelector);
      await expect(popup).toBeVisible();
      await expect(popup.locator(".pharmacy-slot,.drug-production-slot,.factory-slot,.armory-slot")).toHaveCount(cardCount);
      const bounds = await popup.locator('[role="dialog"]').first().boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(-1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await closePopup(page, popupSelector, closeSelector);
    }
  });
}
