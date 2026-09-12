import { expect, test } from "@playwright/test";
import { openLocalGame } from "./helpers/mobileLocalGame.js";

// Deliver the same event consumed by the application's live read-model bridge.
// This exercises the real notification listener and modal queue, including
// reusing one result card for two different notifications.
async function publishFeedback(page, includeSale = false) {
  await page.evaluate(({ includeSale }) => {
    const now = new Date().toISOString();
    const serverInstanceId = "instance:free:eu-central:public-1";
    const notifications = [{
      id: "e2e:incoming", category: "player.feedback", title: "Příchozí útok",
      createdAt: now, readAt: null,
      payload: { kind: "incoming-attack", districtId: "district:1",
        attackerPlayerId: "e2e:attacker", attackerName: "Útočící nick", resolveAtTick: 120 }
    }];
    if (includeSale) notifications.push({
      id: "e2e:sale", category: "player.feedback", title: "Prodej dokončen",
      createdAt: now, readAt: null,
      payload: { kind: "market-sale", resourceId: "chemicals", amount: 2,
        paymentType: "cleanCash", creditedAmount: 500 }
    });
    document.dispatchEvent(new CustomEvent("empire:gameplay-slice-rendered", {
      detail: { gameplaySlice: {
        server: { serverInstanceId, currentTick: 0, stateVersion: includeSale ? 2 : 1,
          status: "running", generatedAt: now, logicalTime: now },
        mode: { tickRateMs: 10000 },
        player: { playerId: "e2e:defender", instanceId: serverInstanceId, notifications },
        districts: [], reports: [], bounty: { activeBounties: [] },
        mapEffects: [{ effectId: "e2e:attack", type: "attack", districtId: "district:1",
          playerId: "e2e:attacker", playerName: "Útočící nick", expiresAtTick: 120 }]
      } }
    }));
  }, { includeSale });
}

for (const viewport of [{ width: 390, height: 740 }, { width: 1440, height: 900 }]) {
  test(`player feedback remains clickable above open cards at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openLocalGame(page);
    const numbers = page.locator("[data-map-numbers-toggle]");
    await numbers.click();
    await expect(numbers).toHaveAttribute("aria-pressed", "true");
    await numbers.click();
    await expect(numbers).toHaveAttribute("aria-pressed", "false");
    const heat = page.locator("[data-gang-heat-open]");
    await heat.locator(".gang-profile-row__label").click();
    await expect(page.locator(".wanted-popup-shell")).toBeVisible();

    await publishFeedback(page);
    const result = page.locator("#police-action-result-modal");
    const card = page.locator("#police-action-result-modal-content");
    await expect(result).toBeVisible();
    await expect(result).toContainText("Útočící nick");
    await publishFeedback(page, true);
    await expect(result).toContainText("Prodej dokončen");
    await expect(result).not.toContainText("Útočící nick");
    await expect(card).toHaveClass(/is-success/);
    await expect(card).not.toHaveClass(/is-player-alert/);
    await page.screenshot({ path: testInfo.outputPath(`feedback-top-${viewport.width}.png`) });

    await page.locator("#police-action-result-modal-close").click();
    await expect(result).toBeVisible();
    await expect(result).toContainText("Útočící nick");
    await expect(card).toHaveClass(/is-player-alert/);
    await expect(card).not.toHaveClass(/is-success/);
    await page.locator("#police-action-result-modal-close").click();
    await expect(result).toBeHidden();
    await expect(page.locator(".wanted-popup-shell")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`feedback-restored-${viewport.width}.png`) });
  });
}
