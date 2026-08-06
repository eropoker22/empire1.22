import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndResumeHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const identities = parseJsonArray(process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON);
const startingPlayerState = parseJsonObject(process.env.EMPIRE_HOSTED_STARTING_PLAYER_STATE_JSON);

test.skip(
  !hostedEnabled || !serverInstanceId,
  "Set the public hosted E2E environment and target server for the canonical 20-player gate."
);
test.setTimeout(1_800_000);

test("loads the running full server for all twenty registered players", async ({ browser }) => {
  expect(identities).toHaveLength(20);
  expect(startingPlayerState).toMatchObject({
    cleanCash: expect.any(Number),
    dirtyCash: expect.any(Number),
    population: expect.any(Number)
  });
  const playerIds = new Set();

  for (const identity of identities) {
    const context = await browser.newContext({
      baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL
    });
    const page = await context.newPage();
    try {
      const entry = await loginAndResumeHostedUiParityGame(page, identity);
      await expect.poll(() => page.evaluate(() => (
        window.EmpireGameplaySliceClient?.getCurrentReadModel?.()?.server?.serverInstanceId ?? null
      )), { timeout: 30_000 }).toBe(serverInstanceId);
      const live = await page.evaluate(() => {
        const slice = window.EmpireGameplaySliceClient?.getCurrentReadModel?.() ?? null;
        return slice ? {
          serverInstanceId: slice.server?.serverInstanceId ?? null,
          mode: slice.mode?.mode ?? null,
          playerId: slice.player?.playerId ?? null,
          playerInstanceId: slice.player?.instanceId ?? null,
          resourceBalances: slice.player?.resourceBalances ?? null,
          hasMarket: Boolean(slice.market),
          hasBounty: Boolean(slice.bounty),
          hasPolice: Boolean(slice.police),
          hasCityEvents: Boolean(slice.player?.cityEvents),
          targetActionKeys: Object.keys(slice.district?.targetActions ?? {})
        } : null;
      });

      expect(live).toMatchObject({
        serverInstanceId,
        mode: "free",
        playerId: expect.stringMatching(/^player:/u),
        playerInstanceId: serverInstanceId,
        resourceBalances: expect.any(Object),
        hasMarket: true,
        hasBounty: true,
        hasPolice: true,
        hasCityEvents: true,
        targetActionKeys: expect.arrayContaining([
          "attackTargets",
          "spyTargets",
          "occupyTargets",
          "robTargets",
          "heistTargets"
        ])
      });
      expect(live.resourceBalances.cash).toBeGreaterThanOrEqual(startingPlayerState.cleanCash);
      expect(live.resourceBalances["dirty-cash"]).toBeGreaterThanOrEqual(startingPlayerState.dirtyCash);
      expect(live.resourceBalances.population).toBeGreaterThanOrEqual(startingPlayerState.population);
      expect(playerIds.has(live.playerId)).toBe(false);
      playerIds.add(live.playerId);
      await expectHostedUiParityClean(page, entry.diagnostics);
    } finally {
      await context.close();
    }
  }

  expect(playerIds.size).toBe(20);
});

function parseJsonArray(value) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : [];
}

function parseJsonObject(value) {
  if (!value) return null;
  const parsed = JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
}
