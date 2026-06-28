import { expect, test } from "@playwright/test";
import {
  SESSION_STORAGE_KEY,
  attachE2eDiagnostics,
  assertNoRuntimeErrors,
  clearStorageOnBoot,
  createRuntimeErrorMonitor,
  openLoginPage,
  resolveJoinableFreeServerId,
  seedE2eSession,
  selectLobbyDistrict,
  waitForMapReady
} from "./helpers/empireSmokeHelpers.js";

const CANONICAL_WAR_SERVER_ID = "instance:war:eu-central:public-1";

test.afterEach(async ({ page }, testInfo) => {
  await attachE2eDiagnostics(page, testInfo);
});

async function loginAsGuest(page, name = "Entry Host", gang = "Entry Crew") {
  await openLoginPage(page);
  await page.locator("#guest-username").fill(name);
  await page.getByPlaceholder("Ghost Crew").fill(gang);
  await Promise.all([
    page.waitForURL(/\/pages\/lobby\.html\?mode=free$/),
    page.getByTestId("guest-login-button").click()
  ]);
  await expect(page.getByTestId("lobby-page")).toBeVisible();
}

async function chooseServerAndEnter(page) {
  await expect(page.getByTestId("server-list")).toBeVisible();
  await expect(page.locator("[data-recommended-server='true']")).toHaveAttribute("data-server-mode", "free");
  await expect(page.locator("[data-recommended-server='true']")).not.toHaveAttribute("data-server-card", CANONICAL_WAR_SERVER_ID);
  const serverId = await resolveJoinableFreeServerId(page);
  const freeCard = page.getByTestId(`server-card-${serverId}`);
  await expect(freeCard).not.toHaveClass(/is-locked|is-full|is-offline/);
  await freeCard.click();
  await selectLobbyDistrict(page);
  await expect(page.getByTestId("enter-selected-server")).toBeEnabled();
  await page.getByTestId("enter-selected-server").click();
  return serverId;
}

async function chooseFactionAndEnter(page) {
  await expect(page.getByTestId("faction-page")).toBeVisible();
  await expect(page.locator("[data-gang-color]").first()).toBeVisible();
  await page.evaluate(() => document.querySelector("[data-faction-id='mafian']")?.click());
  await page.locator("[data-gang-color]").first().click({ force: true });
  await page.locator("[data-avatar]").first().click({ force: true });
  await expect(page.getByTestId("avatar-lightbox")).toBeVisible();
  await page.getByRole("button", { name: "Potvrdit výběr avatara" }).click();
  await expect(page.getByTestId("continue-to-game")).toBeEnabled();
  await page.getByTestId("continue-to-game").click();
  await waitForMapReady(page);
}

const withoutFaction = {
  factionId: undefined,
  selectedFaction: undefined,
  factionLabel: undefined,
  structure: undefined,
  selectedStructure: undefined,
  factionLocked: false,
  hasCompletedServerEntry: false,
  serverRegistrationStatus: "server_selected",
  gangColor: undefined,
  avatar: undefined,
  lockedAt: undefined
};

const withoutServer = {
  activeServerId: undefined,
  activeServerName: undefined,
  activeServerMode: undefined,
  activeServerRegion: undefined,
  activeServerStatus: undefined,
  serverId: undefined,
  serverLabel: undefined,
  serverRegion: undefined,
  preferredStartDistrictId: undefined,
  startDistrictId: undefined,
  lobbyLockedAt: undefined,
  serverRegistrationStatus: undefined,
  factionId: undefined,
  selectedFaction: undefined,
  factionLabel: undefined,
  structure: undefined,
  selectedStructure: undefined,
  factionLocked: undefined,
  hasCompletedServerEntry: undefined,
  gangColor: undefined,
  avatar: undefined,
  lockedAt: undefined
};

test.describe("entry flow", () => {
  test("new guest selects server, locks faction and boots game", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await clearStorageOnBoot(page);

    await loginAsGuest(page, "New Entry Host", "New Entry Crew");
    const serverId = await chooseServerAndEnter(page);
    await expect(page).toHaveURL(/\/pages\/faction\.html$/);
    await chooseFactionAndEnter(page);

    const session = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)), SESSION_STORAGE_KEY);
    expect(session.registration).toMatchObject({
      activeServerId: serverId,
      activeServerInstanceId: serverId,
      selectedFaction: "mafian",
      selectedStructure: "mafián",
      factionLocked: true,
      hasCompletedServerEntry: true
    });
    await assertNoRuntimeErrors(errors);
  });

  test("returning guest continues on active server without faction select", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await seedE2eSession(page);

    await loginAsGuest(page, "Returning Host", "Returning Crew");
    await expect(page.getByTestId("active-server-card")).toBeVisible();
    await expect(page.getByTestId("server-list")).toBeHidden();
    await page.getByTestId("continue-active-server").click();

    await waitForMapReady(page);
    await expect(page).toHaveURL(/\/pages\/game\.html$/);
    await assertNoRuntimeErrors(errors);
  });

  test("active server without faction continues to faction select", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await seedE2eSession(page, { registration: withoutFaction });

    await loginAsGuest(page, "Faction Missing Host", "Faction Missing Crew");
    await expect(page.getByTestId("active-server-card")).toBeVisible();
    await page.getByTestId("continue-active-server").click();

    await expect(page).toHaveURL(/\/pages\/faction\.html$/);
    await chooseFactionAndEnter(page);
    await assertNoRuntimeErrors(errors);
  });

  test("manual faction page after faction lock redirects to game", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await seedE2eSession(page);

    await page.goto("/pages/faction.html");
    await waitForMapReady(page);
    await expect(page).toHaveURL(/\/pages\/game\.html$/);
    await assertNoRuntimeErrors(errors);
  });

  test("manual game page without active server redirects to lobby", async ({ page }) => {
    const errors = createRuntimeErrorMonitor(page);
    await seedE2eSession(page, {
      registration: {
        identity: "No Server Host",
        gangName: "No Server Crew",
        isGuest: true,
        loginKind: "guest",
        serverMode: "free",
        ...withoutServer
      },
      world: {
        ownedDistrictIds: []
      }
    });

    await page.goto("/pages/game.html");
    await expect(page).toHaveURL(/\/pages\/lobby\.html$/);
    await expect(page.getByTestId("lobby-page")).toBeVisible();
    await expect(page.getByTestId("server-list")).toBeVisible();
    await assertNoRuntimeErrors(errors);
  });
});
