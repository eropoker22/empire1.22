import { expect, test } from "@playwright/test";
import { openLocalGame } from "./helpers/mobileLocalGame.js";

for (const viewport of [{ width: 320, height: 568 }, { width: 393, height: 852 }]) {
  test(`HEAT confirmation and recruitment remain usable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openLocalGame(page, { heat: 60, influence: 100 });
    await page.locator('[data-gang-heat-open]').click();
    const heatPanel = page.locator('[data-wanted-popup]');
    await expect(heatPanel).toBeVisible();
    const meta = await heatPanel.locator('.wanted-popup-meta--mobile .wanted-popup-row').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width }; }));
    expect(meta).toHaveLength(3);
    expect(Math.max(...meta.map(r=>r.y)) - Math.min(...meta.map(r=>r.y))).toBeLessThan(2);
    expect(meta[1].x).toBeGreaterThanOrEqual(meta[0].x + meta[0].width);
    const costs = await heatPanel.locator('.wanted-popup-cost').evaluateAll(nodes => nodes.map(node => { const r=node.getBoundingClientRect(); return { x:r.x, y:r.y, text:node.textContent }; }));
    expect(costs[1].y).toBeGreaterThan(costs[0].y);
    expect(costs[2].y).toBeGreaterThan(costs[1].y);
    expect(costs.every(cost=>cost.text.includes('\nAudit risk'))).toBe(true);
    const originalHeat = await heatPanel.locator('[data-wanted-popup-heat]').first().textContent();
    for (const method of ['dirty', 'clean', 'influence']) {
      await heatPanel.locator(`[data-wanted-popup-${method}]`).click();
      const confirmation = page.getByRole('dialog', { name:'Opravdu provést akci?' });
      await expect(confirmation).toBeVisible();
      await expect(confirmation).toContainText('Rozběhnutou razii nezruší');
      const bounds = await confirmation.locator('.heat-confirm-card').boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({ path:testInfo.outputPath(`heat-${method}-${viewport.width}.png`) });
      await confirmation.getByRole('button', { name:'Zpět', exact:true }).click();
      await expect(heatPanel.locator('[data-wanted-popup-heat]').first()).toHaveText(originalHeat);
    }
    await heatPanel.locator('[data-wanted-popup-influence]').click();
    await page.getByRole('button', { name:'Potvrdit snížení' }).click();
    await expect(page.locator('.heat-confirm-shell')).toBeHidden();
    await expect(heatPanel.locator('[data-wanted-popup-heat]').first()).not.toHaveText(originalHeat);
    await heatPanel.getByRole('button', { name:'Zavřít heat panel' }).click();

    await page.evaluate(async () => {
      const { createPopulationCollectResultPayload } = await import('/page-assets/js/app/production-collect-results.js');
      const { renderPoliceActionResultPanel } = await import('/page-assets/js/app/ui/policeActionResultPanel.js');
      renderPoliceActionResultPanel(document, createPopulationCollectResultPayload({ buildingLabel:'Bytový blok', amount:5, districtLabel:'District 1' }), {
        selectors:{ modal:'#police-action-result-modal',content:'#police-action-result-modal-content',title:'#police-action-result-modal-title',badge:'#police-action-result-modal-badge',summary:'#police-action-result-modal-summary',details:'#police-action-result-modal-details' }
      });
    });
    const result = page.locator('#police-action-result-modal');
    await expect(result).toBeVisible();
    await expect(result).not.toContainText('District');
    const rows = await result.locator('.modal__row').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y};}));
    expect(rows).toHaveLength(2);
    expect(Math.abs(rows[0].y - rows[1].y)).toBeLessThan(2);
    expect(rows[1].x).toBeGreaterThan(rows[0].x);
    await page.screenshot({ path:testInfo.outputPath(`recruitment-${viewport.width}.png`) });
    await result.getByRole('button', {name:'Zavřít', exact:true}).click();
    await page.locator('[data-market-popup-open]').click();
    const market = page.locator('[data-market-popup]');
    await expect(market).toHaveAttribute('data-market-mode', 'market');
    await expect(market.locator('.market-popup-row').first()).toBeVisible();
    await page.screenshot({ path:testInfo.outputPath(`city-market-${viewport.width}.png`) });
  });
}
