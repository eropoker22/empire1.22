import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createDistrictGeometry } from "../../page-assets/js/app/district-geometry.js";

const liveEnabled = process.env.EMPIRE_PLAYER_ENTRY_LIVE_E2E === "1";
const canvasWidth = 1600;
const canvasHeight = 980;
const geometry = createDistrictGeometry(canvasWidth, canvasHeight, 0, 48, 0);

test.skip(!liveEnabled, "Set EMPIRE_PLAYER_ENTRY_LIVE_E2E=1 and run against local PostgreSQL/API/worker.");
test.use({ trace: "off", video: "off" });
test.setTimeout(240_000);

test("new player completes authoritative lobby entry and returns without leaving", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const suffix = randomBytes(6).toString("hex");
  const username = `Live${suffix}`;
  const gangName = `Live Crew ${suffix}`;
  const password = randomBytes(24).toString("base64url");

  await page.goto("/pages/login.html");
  await page.locator("[data-login-registration-open]").click();
  await page.locator("#register-username").fill(username);
  await page.locator("#register-gang").fill(gangName);
  await page.locator("#register-birth-date").fill("1990-01-01");
  await page.locator("#register-password").fill(password);
  await page.locator("#register-password-confirmation").fill(password);
  await page.getByTestId("register-form").getByRole("button", { name: "ZALOŽIT GANG" }).click();

  await expect(page).toHaveURL(/\/pages\/lobby\.html/u);
  await expect(page.locator("[data-live-gang-user]")).toHaveText(username, { timeout: 30_000 });
  const openServer = page.locator("[data-open-live-server]:not([disabled])").first();
  await expect(openServer).toBeVisible({ timeout: 30_000 });
  const serverInstanceId = await openServer.getAttribute("data-open-live-server");
  expect(serverInstanceId).toBeTruthy();
  await openServer.click();
  await expect(page.getByTestId("server-detail-modal")).toHaveAttribute("aria-hidden", "false");

  const selection = await page.evaluate(async (id) => {
    const response = await fetch(`/api/lobby/servers/${encodeURIComponent(id)}/spawn-districts`, {
      credentials: "same-origin",
      cache: "no-store"
    });
    return response.json();
  }, serverInstanceId);
  expect(selection.accepted).toBe(true);
  const option = selection.data.districts.find((district) => district.available);
  expect(option).toBeTruthy();
  const renderedDistrict = geometry.districts.find((district) => `district:${district.id}` === option.districtId);
  expect(renderedDistrict).toBeTruthy();
  const target = { x: renderedDistrict.centerX, y: renderedDistrict.centerY };
  const canvas = page.getByTestId("server-detail-map");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box.x + (target.x / canvasWidth) * box.width, box.y + (target.y / canvasHeight) * box.height);
  await expect(page.getByTestId("confirm-server-district")).toBeEnabled();
  await page.getByTestId("confirm-server-district").click();

  await expect(page).toHaveURL(/\/pages\/faction\.html\?membership=/u, { timeout: 30_000 });
  await expect(page.locator("[data-live-color]").first()).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-faction-id="mafian"]').click();
  await page.locator("[data-live-color]").first().click();
  await page.locator("[data-live-avatar]").first().click();
  await page.getByTestId("continue-to-game").click();
  await expect(page).toHaveURL(/\/pages\/game\.html/u, { timeout: 120_000 });
  await expect(page.locator("#game-root")).toHaveAttribute("data-runtime-init", "ready", { timeout: 60_000 });

  const activeBeforeReturn = await loadOverview(page);
  expect(activeBeforeReturn.activeBlockingMembership.status).toBe("active");
  expect(activeBeforeReturn.activeBlockingMembership.reservedSpawnDistrictId).toBe(option.districtId);
  const membershipId = activeBeforeReturn.activeBlockingMembership.membershipId;
  const playerId = activeBeforeReturn.activeBlockingMembership.playerId;
  const gameplay = await loadGameplay(page, serverInstanceId, option.districtId);
  expect(gameplay.accepted).toBe(true);
  expect(gameplay.readModel.player).toMatchObject({ playerId, homeDistrictId: option.districtId });
  expect(gameplay.readModel.spawnSelection?.status).not.toBe("awaiting_spawn_selection");

  await page.locator("[data-nav-logout]").first().click();
  if (await page.locator("[data-game-lobby-modal]").isHidden()) {
    throw new Error(`Game Lobby modal did not open. Browser errors: ${pageErrors.join(" | ") || "none"}`);
  }
  await expect(page.locator("[data-game-lobby-modal]")).toBeVisible();
  await page.locator('[data-game-lobby-action="lobby"]').click();
  await expect(page).toHaveURL(/\/pages\/lobby\.html/u);
  await expect(page.locator("[data-live-gang-membership]")).toHaveText("AKTIVNÍ", { timeout: 30_000 });
  const activeAfterReturn = await loadOverview(page);
  expect(activeAfterReturn.activeBlockingMembership).toMatchObject({ membershipId, playerId, status: "active" });

  await page.locator("[data-lobby-continue-active]").click();
  await expect(page).toHaveURL(/\/pages\/game\.html/u, { timeout: 60_000 });
  const activeAfterReconnect = await loadOverview(page);
  expect(activeAfterReconnect.activeBlockingMembership).toMatchObject({ membershipId, playerId, status: "active" });
});

async function loadOverview(page) {
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/lobby/overview", { credentials: "same-origin", cache: "no-store" });
    return result.json();
  });
  expect(response.accepted).toBe(true);
  return response.data;
}

async function loadGameplay(page, serverInstanceId, districtId) {
  return page.evaluate(async ({ serverInstanceId: id, districtId: district }) => {
    const response = await fetch("/api/gameplay-slice/load", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serverInstanceId: id, districtId: district })
    });
    return response.json();
  }, { serverInstanceId, districtId });
}
