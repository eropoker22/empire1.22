import { expect, test } from "@playwright/test";
import {
  SESSION_STORAGE_KEY,
  attachE2eDiagnostics,
  assertNoRuntimeErrors,
  createRuntimeErrorMonitor,
  openFactionPage,
  openLobbyPage,
  resolveJoinableFreeServerId,
  selectLobbyDistrict
} from "./helpers/empireSmokeHelpers.js";

const CANONICAL_WAR_SERVER_ID = "instance:war:eu-central:public-1";
const SCOPED_SESSION_STORAGE_KEY = "empireStreets.session.free.instance-free-eu-central-public-1.v1";

async function openLocalOnboardingGame(page) {
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

  await page.goto("/pages/game.html", { waitUntil: "load" });
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

async function expectGuideTargetVisible(page, selector) {
  const panel = page.locator("[data-onboarding-panel]");
  const target = page.locator(`${selector}:visible`).first();
  await expect(target).toBeVisible();
  await expect(target).toHaveClass(/is-onboarding-focus-target/u);
  const [panelBox, targetBox] = await Promise.all([panel.boundingBox(), target.boundingBox()]);
  expect(panelBox).toBeTruthy();
  expect(targetBox).toBeTruthy();
  const overlapWidth = Math.max(0, Math.min(panelBox.x + panelBox.width, targetBox.x + targetBox.width) - Math.max(panelBox.x, targetBox.x));
  const overlapHeight = Math.max(0, Math.min(panelBox.y + panelBox.height, targetBox.y + targetBox.height) - Math.max(panelBox.y, targetBox.y));
  expect(overlapWidth * overlapHeight).toBeLessThan(targetBox.width * targetBox.height * 0.95);
}

async function advanceToStep(page, expectedStepId) {
  const panel = page.locator("[data-onboarding-panel]");
  await panel.locator("[data-onboarding-primary-action]").click();
  await expect(panel).toHaveAttribute("data-onboarding-step", expectedStepId);
}

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

test.describe("onboarding flow smoke", () => {
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 1280, height: 720 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 }
  ]) {
    test(`shows all three new onboarding focus steps at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const errors = createRuntimeErrorMonitor(page);
      await page.setViewportSize(viewport);
      await openLocalOnboardingGame(page);

      const panel = page.locator("[data-onboarding-panel]");
      await expect(panel).toHaveAttribute("data-onboarding-step", "welcome");
      for (const stepId of ["your-district", "building-action", "heat-police", "production-choice"]) {
        await advanceToStep(page, stepId);
      }

      await expect(panel).toContainText("Krok 5 / 10");
      await expect(panel).toContainText("Vyber výrobu");
      await expectGuideTargetVisible(page, "#building-shortcut-grid");
      await expect(page.locator("#building-shortcut-grid .building-shortcut-button.is-onboarding-focus-target")).toHaveCount(4);

      await advanceToStep(page, "alliance-guide");
      await expect(panel).toContainText("Krok 6 / 10");
      await expectGuideTargetVisible(page, "#alliance-btn");

      await advanceToStep(page, "bounty-boost-guide");
      await expect(panel).toContainText("Krok 7 / 10");
      await expectGuideTargetVisible(page, "[data-bounty-open-trigger]");
      await expectGuideTargetVisible(page, "[data-boost-open-trigger]");
      const bountyShadow = await page.locator("[data-bounty-open-trigger]:visible").first().evaluate((element) => getComputedStyle(element).boxShadow);
      const boostShadow = await page.locator("[data-boost-open-trigger]:visible").first().evaluate((element) => getComputedStyle(element).boxShadow);
      expect(bountyShadow).toContain("rgba(255, 52, 75, 0.52)");
      expect(boostShadow).toContain("rgba(84, 223, 245, 0.5)");

      const panelBox = await panel.boundingBox();
      expect(panelBox.x).toBeGreaterThanOrEqual(-1);
      expect(panelBox.y).toBeGreaterThanOrEqual(-1);
      expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await assertNoRuntimeErrors(errors);
    });
  }

  test("selects a lobby server and persists selectedServer data", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openLobbyPage(page);
    const serverId = await resolveJoinableFreeServerId(page);
    await expect(page.getByTestId(`server-card-${serverId}`)).toBeVisible();
    await expect(page.locator("[data-recommended-server='true']")).toHaveAttribute("data-server-mode", "free");
    await expect(page.locator("[data-recommended-server='true']")).not.toHaveAttribute("data-server-card", CANONICAL_WAR_SERVER_ID);
    await expect(page.getByTestId(`server-card-${serverId}`)).not.toHaveClass(/is-locked|is-full|is-offline/);
    await page.getByTestId(`server-card-${serverId}`).click();
    await selectLobbyDistrict(page);
    await expect(page.getByTestId("enter-selected-server")).toBeEnabled();
    await page.getByTestId("enter-selected-server").click();
    await expect(page).toHaveURL(/\/pages\/faction\.html$/);

    const session = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), SESSION_STORAGE_KEY);
    expect(session.registration.activeServerId).toBe(serverId);
    expect(session.registration.activeServerInstanceId).toBe(serverId);
    expect(session.registration.serverId).toBe(serverId);
    expect(session.registration.serverInstanceId).toBe(serverId);
    expect(session.registration.serverRegistrationStatus).toBe("server_selected");
    expect(session.registration.preferredStartDistrictId).toBeGreaterThan(0);
    expect(session.registration.startDistrictId).toBe(session.registration.preferredStartDistrictId);
    expect(session.world.ownedDistrictIds).toEqual([]);

    await assertNoRuntimeErrors(errors);
  });

  test("keeps War closed while Free remains joinable", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openLobbyPage(page, {
      registration: {
        identity: "War Guard Host",
        gangName: "War Guard Crew"
      }
    });

    const serverId = await resolveJoinableFreeServerId(page);
    await expect(page.getByTestId(`server-card-${serverId}`)).not.toHaveClass(/is-locked|is-full|is-offline/);

    await page.locator("[data-server-mode-tab='war']").click();
    const warCard = page.getByTestId(`server-card-${CANONICAL_WAR_SERVER_ID}`);
    await expect(warCard).toBeVisible();
    await expect(warCard).toHaveClass(/is-locked|is-offline/);

    const reserveResponse = await page.evaluate(async () => {
      const send = async (preferredServerInstanceId) => {
        const response = await fetch("/api/matchmaking/reserve", {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/json"
          },
          body: JSON.stringify({
            accountId: "war-guard",
            playerId: "war-guard",
            mode: "war",
            preferredServerInstanceId
          })
        });
        return {
          ok: response.ok,
          status: response.status,
          json: await response.json()
        };
      };

      return {
        canonical: await send("instance:war:eu-central:public-1"),
        legacyAlias: await send("war-eu-01")
      };
    });

    expect(reserveResponse.canonical.ok).toBe(true);
    expect(reserveResponse.legacyAlias.ok).toBe(true);
    expect(reserveResponse.canonical.json.accepted).toBe(false);
    expect(reserveResponse.legacyAlias.json.accepted).toBe(false);
    expect(reserveResponse.canonical.json.reservation).toBeNull();
    expect(reserveResponse.legacyAlias.json.reservation).toBeNull();

    await assertNoRuntimeErrors(errors);
  });

  test("selects faction, color and avatar before entering game", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openFactionPage(page);
    await expect(page.getByTestId("faction-card-list")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vyber frakci pro tento server" })).toBeVisible();
    await expect(page.getByText("Vyber frakci pro tuto válku")).toHaveCount(0);
    await expect(page.getByTestId("continue-to-game")).toHaveAttribute("aria-disabled", "true");
    await page.evaluate(() => document.querySelector("[data-faction-id='mafian']")?.click());
    await expect(page.locator("#faction-bonus")).toContainText("Styl");
    await expect(page.locator("#faction-bonus")).toContainText("Aktivní");
    await expect(page.locator("#faction-bonus")).toContainText("Slabina");
    await expect(page.locator("#faction-bonus")).not.toContainText(/core-backed/i);
    await page.locator("[data-gang-color]").first().click({ force: true });
    await expect(page.getByTestId("continue-to-game")).toHaveAttribute("aria-disabled", "true");
    await page.locator("[data-avatar]").first().click({ force: true });
    await expect(page.getByTestId("avatar-lightbox")).toBeVisible();
    await page.getByRole("button", { name: "Potvrdit výběr avatara" }).click();
    await expect(page.getByTestId("continue-to-game")).toHaveAttribute("aria-disabled", "false");
    await expect(page.getByTestId("continue-to-game")).toBeEnabled();
    await page.getByTestId("continue-to-game").click();

    await expect(page).toHaveURL(/\/pages\/game\.html$/);
    await page.waitForFunction(() => (
      document.documentElement.dataset.runtimeMode === "local-demo"
      && document.querySelector("#game-root")?.dataset?.runtimeInit === "ready"
    ), null, { timeout: 60_000 });
    await expect(page.getByTestId("game-page")).toBeVisible({ timeout: 10_000 });

    const session = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), SESSION_STORAGE_KEY);
    expect(session.registration).toMatchObject({
      factionId: "mafian",
      selectedFaction: "mafian",
      structure: "mafián",
      selectedStructure: "mafián",
      factionLocked: true,
      hasCompletedServerEntry: true,
      serverRegistrationStatus: "faction_locked",
      gangColor: "#ef4444"
    });
    expect(session.registration.avatar).toContain("../img/avatars/Mafia/");

    await assertNoRuntimeErrors(errors);
  });
});
