import { expect } from "@playwright/test";
import { SESSION_STORAGE_KEY } from "./empireSmokeHelpers.js";
const SCOPED_SESSION_STORAGE_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";

export async function openLocalOnboardingGame(page) {
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
        identity: "Onboarding QA",
        gangName: "Onboarding QA",
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
        phaseState: { gamePhase: "live", mapPhase: "night", cityMinutes: 1_334 }
      }
    };
    localStorage.clear();
    localStorage.setItem("empire:active_guest_mode", "free");
    localStorage.setItem("empire:active_mode", "free");
    localStorage.setItem(sessionKey, JSON.stringify(session));
    localStorage.setItem(scopedSessionKey, JSON.stringify(session));
  }, {
    sessionKey: SESSION_STORAGE_KEY,
    scopedSessionKey: SCOPED_SESSION_STORAGE_KEY
  });

  await page.goto("/pages/game.html?runtimeMode=local-demo&autoStartLocalDemo=1", { waitUntil: "load" });
  await page.waitForFunction(() => (
    window.EmpireRuntime
    && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"
    && document.documentElement?.dataset?.runtimeMode === "local-demo"
  ));
  const milestone = page.locator("[data-server-milestone-modal]");
  if (await milestone.isVisible()) {
    await milestone.locator("[data-server-milestone-confirm]").click();
    await expect(milestone).toBeHidden();
  }
  await expect(page.locator("[data-onboarding-panel]"), "onboarding panel should auto-start").toBeVisible();
}

