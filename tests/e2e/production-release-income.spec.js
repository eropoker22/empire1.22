import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";

const enabled = process.env.EMPIRE_PRODUCTION_REMOTE_SMOKE === "1";
const publicOrigin = process.env.EMPIRE_PUBLIC_ORIGIN || "";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const username = process.env.PRODUCTION_SMOKE_ACCOUNT_USERNAME || "";
const password = process.env.PRODUCTION_SMOKE_ACCOUNT_PASSWORD || "";

test.skip(
  !enabled || publicOrigin !== "https://empirestreets.cz" || !serverInstanceId || !username || !password,
  "Run only through the guarded production release smoke runner."
);
test.use({ trace: "off", screenshot: "off", video: "off" });
test.setTimeout(360_000);

test("production worker credits canonical income and persists it through reload", async ({ page }) => {
  const entry = await loginAndResumeHostedUiParityGame(page, { username, password });
  const before = await readIncomeState(page);
  expect(before.serverInstanceId).toBe(serverInstanceId);
  expect(before.districtId).toBe(before.homeDistrictId);
  expect(before.buildingCount).toBeGreaterThan(0);

  await expect.poll(
    async () => {
      const current = await readIncomeState(page);
      return current.currentTick > before.currentTick
        && current.stateVersion > before.stateVersion
        && current.cash > before.cash;
    },
    {
      message: "A production worker tick must increase canonical clean cash and state version.",
      timeout: 90_000
    }
  ).toBe(true);
  const credited = await readIncomeState(page);

  await page.reload();
  await waitForLiveGame(page, serverInstanceId);
  const restored = await readIncomeState(page);
  expect(restored.currentTick).toBeGreaterThanOrEqual(credited.currentTick);
  expect(restored.stateVersion).toBeGreaterThanOrEqual(credited.stateVersion);
  expect(restored.cash).toBeGreaterThanOrEqual(credited.cash);
  await expectHostedUiParityClean(page, entry.diagnostics);
});

const readIncomeState = (page) => page.evaluate(() => {
  const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.() || null;
  return {
    buildingCount: readModel?.district?.buildings?.length || 0,
    cash: Number(readModel?.player?.resourceBalances?.cash || 0),
    currentTick: Number(readModel?.server?.currentTick || 0),
    districtId: readModel?.district?.districtId || null,
    homeDistrictId: readModel?.player?.homeDistrictId || null,
    serverInstanceId: readModel?.server?.serverInstanceId || null,
    stateVersion: Number(readModel?.server?.stateVersion || 0)
  };
});
