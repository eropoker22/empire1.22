import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";

const readIncomeState = (page) => page.evaluate(() => {
  const readModel = window.EmpireGameplaySliceClient?.getCurrentReadModel?.() || null;
  return {
    buildingCount: readModel?.district?.buildings?.length || 0,
    cash: Number(readModel?.player?.resourceBalances?.cash || 0),
    currentTick: Number(readModel?.server?.currentTick || 0),
    districtId: readModel?.district?.districtId || null,
    homeDistrictId: readModel?.player?.homeDistrictId || null,
    stateVersion: Number(readModel?.server?.stateVersion || 0)
  };
});

test.describe("hosted authoritative income", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted PostgreSQL coverage."
  );
  test.setTimeout(360_000);

  test("worker ticks credit the canonical owner and persist through reload", async ({ page }) => {
    const entry = await registerAndEnterHostedUiParityGame(page, {
      serverInstanceId,
      spawnDistrictIds: [
        "district:21",
        "district:26",
        "district:42",
        "district:95",
        "district:113",
        "district:136",
        "district:138",
        "district:140"
      ],
      identityPrefix: "HostedIncome"
    });
    const before = await readIncomeState(page);
    expect(before.districtId).toBe(entry.spawnDistrictId);
    expect(before.homeDistrictId).toBe(entry.spawnDistrictId);
    expect(before.buildingCount).toBeGreaterThan(0);

    await expect.poll(
      async () => {
        const current = await readIncomeState(page);
        return current.currentTick > before.currentTick
          && current.stateVersion > before.stateVersion
          && current.cash > before.cash;
      },
      {
        message: "At least one authoritative tick must increase clean cash and state version.",
        timeout: 90_000
      }
    ).toBe(true);
    const credited = await readIncomeState(page);

    await page.reload();
    await waitForLiveGame(page);
    const restored = await readIncomeState(page);
    expect(restored.currentTick).toBeGreaterThanOrEqual(credited.currentTick);
    expect(restored.stateVersion).toBeGreaterThanOrEqual(credited.stateVersion);
    expect(restored.cash).toBeGreaterThanOrEqual(credited.cash);
    await expectHostedUiParityClean(page, entry.diagnostics);
  });
});
