import { expect, test } from "@playwright/test";

// Component browser coverage: real game markup/CSS and runtime, controlled server callback.
// Command authorization, debit, randomness and persistence are covered by core/transport tests.
for (const method of ["dirty", "clean", "influence"]) {
  test(`authoritative heat ${method}: pending lock, accepted refresh and rejected response`, async ({ page }, testInfo) => {
    await page.route("**/pages/heat-audit-fixture.html", route => route.fulfill({
      contentType: "text/html", body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'
    }));
    await page.route("https://**", route => route.abort());
    await page.goto("/pages/heat-audit-fixture.html");
    await page.evaluate(async () => {
      const markup = new DOMParser().parseFromString(await (await fetch("/pages/game.html")).text(), "text/html");
      for (const link of markup.querySelectorAll('link[rel="stylesheet"]')) document.head.append(link.cloneNode(true));
      document.body.className = "game-page";
      document.body.innerHTML = '<button id="heat">HEAT</button><div id="stars"><span data-star>★</span></div>';
      document.body.append(markup.querySelector("[data-wanted-popup]").cloneNode(true));
      const { createGangWantedStatusRuntime } = await import("/page-assets/js/app/runtime/gangWantedStatusRuntime.js");
      const renderers = await import("/page-assets/js/app/ui/wantedPanel.js");
      const actions = ["dirty", "clean", "influence"].map((method, i) => ({
        method, cost: [2500,5000,20][i], actualHeatReduction: [15,25,25][i], auditRiskPct: [20,5,0][i],
        auditHeatGain: method === "influence" ? 0 : 5, auditFineMax: [625,1250,0][i],
        cooldownMs: [20,30,45][i]*60000, remainingMs: 0, available: true
      }));
      window.heatFixture = { calls: [], player: { economy: { cleanCash: 9000, dirtyCash: 9000, influence: 60 }, police: { heat: 75, wantedLevel: 2, heatReductionActions: actions, heatJournal: [] } } };
      const selectors = { gangHeat: "#heat", gangStars: "#stars", gangStar: "[data-star]", popup: "[data-wanted-popup]" };
      for (const [key, suffix] of Object.entries({popupHeat:"heat",popupLevel:"level",popupTier:"tier",popupDescription:"description",popupProtection:"protection",popupAuditRisk:"audit-risk",popupLevels:"levels",popupRiseList:"rise-list",popupFallList:"fall-list",popupFeedback:"feedback",dirtyAction:"dirty",cleanAction:"clean",influenceAction:"influence",clearLog:"clear-log",popupClose:"close"})) selectors[key] = `[data-wanted-popup-${suffix}]`;
      const runtime = createGangWantedStatusRuntime({
        selectors, ...renderers, isServerAuthoritativeMode: () => true, isLocalDemoMode: () => false,
        getServerPlayerView: () => window.heatFixture.player, gangHeatTiers: [],
        resolveGangHeatTier: () => ({ id: 3, title: "Známý problém", description: "Heat neklesá samovolně." }),
        onServerAction: method => {
          window.heatFixture.calls.push(method);
          return new Promise(resolve => { window.heatFixture.respond = accepted => {
            if (accepted) {
              window.heatFixture.player.police.heat = method === "dirty" ? 60 : 50;
              window.heatFixture.player.police.heatJournal = [{ type: "fall", amount: method === "dirty" ? 15 : 25, reason: "Potvrzeno serverem." }];
              for (const action of actions) { action.available = false; action.remainingMs = 600000; }
            }
            resolve({ accepted, errors: accepted ? [] : [{ message: "Nedostatek prostředků." }] });
          }; });
        }
      });
      if (!runtime.bindGangWantedStatus(document)) throw new Error("Heat panel failed to bind");
    });
    await page.locator("#heat").click();
    const button = page.locator(`[data-wanted-popup-${method}]`);
    await expect(button).toBeEnabled();
    await button.click();
    await expect(button).toBeDisabled();
    await button.evaluate(el => el.dispatchEvent(new Event("click")));
    expect(await page.evaluate(() => window.heatFixture.calls)).toEqual([method]);
    await expect(page.locator("[data-wanted-popup-heat]")).toHaveText("75");
    await page.evaluate(() => window.heatFixture.respond(false));
    await expect(page.locator("[data-wanted-popup-feedback]")).toContainText("Nedostatek prostředků");
    await expect(button).toBeEnabled();
    await button.click();
    await page.evaluate(() => window.heatFixture.respond(true));
    await expect(page.locator("[data-wanted-popup-heat]")).toHaveText(method === "dirty" ? "60" : "50");
    await expect(button).toBeDisabled();
    await expect(page.locator("[data-wanted-popup-feedback]")).toContainText("Potvrzeno serverem");
    const overflows = await page.locator("[data-wanted-popup] .wanted-popup-card").evaluate(el => el.scrollWidth > el.clientWidth + 2);
    expect(overflows).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`heat-${method}.png`) });
  });
}
