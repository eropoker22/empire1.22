import { randomBytes } from "node:crypto";
import { expect } from "@playwright/test";
import { createDistrictGeometry } from "../../../page-assets/js/app/district-geometry.js";
import { dismissOnboardingGuide } from "./empireSmokeHelpers.js";

const canvasWidth = 1600;
const canvasHeight = 980;
const geometry = createDistrictGeometry(canvasWidth, canvasHeight, 0, 48, 0);

function createIdentity(prefix = "Parity") {
  const suffix = randomBytes(6).toString("hex");
  return {
    username: `${prefix}${suffix}`,
    gangName: `${prefix} Crew ${suffix}`,
    password: randomBytes(24).toString("base64url")
  };
}

async function registerAccount(page, identity) {
  await page.goto("/pages/login.html");
  await expect(page.locator("#register-username")).toBeEnabled({ timeout: 30_000 });
  await page.locator("[data-login-registration-open]").click();
  await expect(page.locator("[data-login-registration-overlay]")).toBeVisible();
  await page.locator("#register-username").fill(identity.username);
  await page.locator("#register-gang").fill(identity.gangName);
  await page.locator("#register-birth-date").fill("1990-01-01");
  await page.locator("#register-password").fill(identity.password);
  await page.locator("#register-password-confirmation").fill(identity.password);
  await page.locator("#register-terms").check();
  await page.getByTestId("register-form").getByRole("button", { name: "ZALOŽIT GANG" }).click();
  await expect(page).toHaveURL(/\/pages\/lobby\.html/u, { timeout: 30_000 });
  await expect(page.locator("[data-live-gang-user]")).toHaveText(identity.username, { timeout: 30_000 });
}

async function openServer(page, serverInstanceId) {
  const opened = await page.locator("[data-open-live-server]").evaluateAll((buttons, expectedId) => {
    const button = buttons.find((candidate) => candidate.dataset.openLiveServer === expectedId);
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  }, serverInstanceId);
  expect(opened, `Server ${serverInstanceId} must be available in the live lobby`).toBe(true);
  await expect(page.getByTestId("server-detail-modal")).toHaveAttribute("aria-hidden", "false");
}

async function loadSpawnDistricts(page, serverInstanceId) {
  const response = await page.evaluate(async (id) => {
    const result = await fetch(`/api/lobby/servers/${encodeURIComponent(id)}/spawn-districts`, {
      credentials: "same-origin",
      cache: "no-store"
    });
    return result.json();
  }, serverInstanceId);
  expect(response.accepted).toBe(true);
  return response.data.districts;
}

async function selectSpawnDistrict(page, districts, preferredDistrictId) {
  const option = districts.find((district) => (
    district.available && district.districtId === preferredDistrictId
  ));
  expect(option, `Spawn district ${preferredDistrictId} must be available`).toBeTruthy();
  const renderedDistrict = geometry.districts.find(
    (district) => `district:${district.id}` === option.districtId
  );
  expect(renderedDistrict).toBeTruthy();
  const canvas = page.getByTestId("server-detail-map");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(
    box.x + (renderedDistrict.centerX / canvasWidth) * box.width,
    box.y + (renderedDistrict.centerY / canvasHeight) * box.height
  );
  await expect(page.getByTestId("confirm-server-district")).toBeEnabled();
  await page.getByTestId("confirm-server-district").click();
}

async function completeFactionSelection(page) {
  await expect(page).toHaveURL(/\/pages\/faction\.html\?membership=/u, { timeout: 30_000 });
  await expect(page.locator("[data-live-color]").first()).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-faction-id="mafian"]').click();
  await page.locator("[data-live-color]").first().click();
  await page.locator("[data-live-avatar]").first().click();
  await page.getByTestId("continue-to-game").click();
}

async function waitForLiveGame(page) {
  await expect(page).toHaveURL(/\/pages\/game\.html/u, { timeout: 120_000 });
  await expect(page.locator("html")).toHaveAttribute(
    "data-runtime-mode",
    "server-authoritative",
    { timeout: 60_000 }
  );
  await expect(page.locator("#game-root")).toHaveAttribute(
    "data-runtime-init",
    "ready",
    { timeout: 60_000 }
  );
  const milestoneModal = page.locator("[data-server-milestone-modal]:visible").last();
  if (await milestoneModal.count()) {
    await milestoneModal.locator("[data-server-milestone-confirm]").click({ force: true });
    await expect(milestoneModal).toBeHidden();
  }
  await dismissOnboardingGuide(page);
}

export async function registerAndEnterHostedUiParityGame(page, {
  serverInstanceId,
  spawnDistrictId,
  identityPrefix = "Parity"
} = {}) {
  expect(serverInstanceId, "EMPIRE_UI_PARITY_SERVER_ID is required").toBeTruthy();
  expect(spawnDistrictId, "A canonical spawn district is required").toBeTruthy();
  const identity = createIdentity(identityPrefix);
  await registerAccount(page, identity);
  await openServer(page, serverInstanceId);
  const districts = await loadSpawnDistricts(page, serverInstanceId);
  await selectSpawnDistrict(page, districts, spawnDistrictId);
  await completeFactionSelection(page);
  await waitForLiveGame(page);
  return { identity, serverInstanceId, spawnDistrictId };
}
