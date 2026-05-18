import { expect, test } from "@playwright/test";
import {
  SESSION_STORAGE_KEY,
  assertNoRuntimeErrors,
  createRuntimeErrorMonitor,
  openFactionPage,
  openLobbyPage,
  selectLobbyDistrict
} from "./helpers/empireSmokeHelpers.js";

test.describe("onboarding flow smoke", () => {
  test("selects a lobby server and persists selectedServer data", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openLobbyPage(page);
    await expect(page.getByTestId("server-card-war-eu-01")).toBeVisible();
    await page.getByTestId("server-card-war-eu-01").click();
    await selectLobbyDistrict(page);
    await expect(page.getByTestId("enter-selected-server")).toBeEnabled();
    await page.getByTestId("enter-selected-server").click();
    await expect(page).toHaveURL(/\/pages\/faction\.html$/);

    const session = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), SESSION_STORAGE_KEY);
    expect(session.registration.activeServerId).toBe("war-eu-01");
    expect(session.registration.serverId).toBe("war-eu-01");
    expect(session.registration.serverRegistrationStatus).toBe("server_selected");
    expect(session.registration.preferredStartDistrictId).toBeGreaterThan(0);
    expect(session.registration.startDistrictId).toBe(session.registration.preferredStartDistrictId);
    expect(session.world.ownedDistrictIds).toEqual([]);

    await assertNoRuntimeErrors(errors);
  });

  test("selects faction, color and avatar before entering game", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);

    await openFactionPage(page);
    await expect(page.getByTestId("faction-card-list")).toBeVisible();
    await page.getByRole("button", { name: "Mafián" }).click();
    await page.locator("[data-gang-color]").first().click();
    await page.locator("[data-avatar]").first().click();
    await expect(page.getByTestId("avatar-lightbox")).toBeVisible();
    await page.getByRole("button", { name: "Potvrdit výběr avatara" }).click();
    await expect(page.getByTestId("continue-to-game")).toBeEnabled();
    await page.getByTestId("continue-to-game").click();

    await expect(page).toHaveURL(/\/pages\/game\.html$/);
    await expect(page.getByTestId("game-page")).toBeVisible();

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
