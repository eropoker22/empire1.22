import { expect } from "@playwright/test";

const SESSION_KEY = "empireStreets.session.v1";
const SCOPED_SESSION_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";

export async function openLocalGame(page, { heat = 0, influence = 0 } = {}) {
  await page.addInitScript(({ sessionKey, scopedSessionKey, heat, influence }) => {
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
      gang: { population: 30, heat, influence, lastHeatDecayAt: now },
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
    localStorage.setItem("empire:onboarding:v2:onboarding:Production%20Layout%20QA", JSON.stringify({
      completed: true, skipped: true, currentStepId: "completed", dismissedAt: now, version: "demo-v1-clean"
    }));
  }, { sessionKey: SESSION_KEY, heat, influence, scopedSessionKey: SCOPED_SESSION_KEY });
  const pending = new Set();
  page.on("request", request => pending.add(request.url()));
  page.on("requestfinished", request => pending.delete(request.url()));
  page.on("requestfailed", request => pending.delete(request.url()));
  page.on("console", message => { if (message.type() === "error") console.log(message.text()); });
  page.on("pageerror", error => console.log("PAGE ERROR:", error.message));
  await page.route("https://**", route => route.abort());
  await page.goto("/pages/game.html?runtimeMode=local-demo&autoStartLocalDemo=1", { waitUntil: "commit" });
  await page.waitForFunction(() => (
    window.EmpireRuntime
    && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"
    && document.documentElement?.dataset?.runtimeMode === "local-demo"
  ), null, { timeout: 45000 }).catch(async error => { console.log("PENDING", [...pending]); console.log("STATE", await page.evaluate(() => ({ ready: document.readyState, runtime: !!window.EmpireRuntime, mode: document.documentElement.dataset.runtimeMode }))); throw error; });
  const milestone = page.locator("[data-server-milestone-modal]");
  if (await milestone.isVisible()) {
    await milestone.locator("[data-server-milestone-confirm]").click();
    await expect(milestone).toBeHidden();
  }
}
