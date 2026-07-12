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

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

test.describe("onboarding flow smoke", () => {
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
