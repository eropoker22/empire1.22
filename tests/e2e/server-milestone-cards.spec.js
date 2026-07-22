import { expect, test } from "@playwright/test";
import { dismissOnboardingGuide } from "./helpers/empireSmokeHelpers.js";

test("server lifecycle signals open four standalone milestone cards", async ({ page }) => {
  await page.addInitScript(() => {
    window.EmpireConfigOverrides = Object.freeze({
      ...(window.EmpireConfigOverrides || {}),
      localDemoEnabled: true
    });
    window.__EMPIRE_E2E__ = true;
  });

  await page.goto("/pages/game.html", { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector("#game-root")?.dataset?.runtimeInit === "ready");
  await dismissOnboardingGuide(page);
  await expect(page.locator("[data-onboarding-panel]")).toBeHidden();
  const modal = page.locator("[data-server-milestone-modal]");
  const confirm = page.locator("[data-server-milestone-confirm]");
  const confirmMilestone = async () => {
    await confirm.focus();
    await page.keyboard.press("Enter");
  };

  const dispatchSlice = (slice) => page.evaluate((gameplaySlice) => {
    document.dispatchEvent(new CustomEvent("empire:gameplay-slice-rendered", { detail: { gameplaySlice } }));
  }, slice);

  if (await modal.isVisible()) await confirmMilestone();
  await dispatchSlice({ server: { serverInstanceId: "e2e:milestones" }, mode: { tickRateMs: 5000 }, player: { instanceId: "e2e:milestones" } });

  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-server-milestone", "welcome");
  await expect(modal.getByRole("heading")).toHaveText("Válka o město začíná");

  await confirmMilestone();
  await expect(modal).toBeHidden();
  await dispatchSlice({
    server: { serverInstanceId: "e2e:milestones" },
    mode: { tickRateMs: 5000 },
    elimination: { enabled: true, eliminationsStopped: false, firstEliminationTick: 2880, nextEliminationTick: 2880, ticksUntilNextElimination: 2880, activePlayersRemaining: 20 },
    player: { instanceId: "e2e:milestones" }
  });
  await expect(modal).toHaveAttribute("data-server-milestone", "first-purge");
  await expect(modal).toContainText("První Očista se blíží");
  await expect(modal.locator('[data-server-milestone-stat="first-purge-countdown"] strong'))
    .toHaveText(/\d+ h \d+ min \d+ s/u);

  await confirmMilestone();
  await expect(modal).toBeHidden();
  await dispatchSlice({
    server: { serverInstanceId: "e2e:milestones", currentTick: 400 },
    mode: { tickRateMs: 5000 },
    elimination: { activePlayersRemaining: 8 },
    player: {
      instanceId: "e2e:milestones",
      finalLockdown: {
        enabled: true,
        active: true,
        status: "active",
        remainingActiveTicks: 720,
        leaderboardTop3: []
      }
    }
  });
  await expect(modal).toHaveAttribute("data-server-milestone", "lockdown");
  await expect(modal).toContainText("Final Lockdown začal");
  await expect(modal).toContainText("Zbývá hráčů8");
  await expect(modal.locator('[data-server-milestone-stat="final-lockdown-countdown"] strong'))
    .toHaveText(/\d+ h \d+ min \d+ s/u);

  await confirmMilestone();
  await expect(modal).toBeHidden();
  await dispatchSlice({
    server: { serverInstanceId: "e2e:milestones" },
    player: {
      instanceId: "e2e:milestones",
      finalLockdown: {
        enabled: true,
        active: false,
        status: "resolved",
        leaderboardTop3: [1, 2, 3].map((rank) => ({ rank, playerName: `Gang ${rank}`, score: 1000 - rank }))
      }
    }
  });
  await expect(modal).toHaveAttribute("data-server-milestone", "winners");
  await expect(modal.locator("[data-server-milestone-ranking-list] li")).toHaveCount(3);

  await confirmMilestone();
  await expect(modal).toBeHidden();

  const purgeNews = page.locator('[data-building-action-feed] [data-building-action-result-kind="server-milestone"]')
    .filter({ hasText: "První Očista se blíží" });
  await expect(purgeNews).toBeVisible();
  await purgeNews.click();
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("data-server-milestone", "first-purge");
});
