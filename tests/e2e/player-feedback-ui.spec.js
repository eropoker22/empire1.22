import { expect, test } from "@playwright/test";
import { openLocalGame } from "./helpers/mobileLocalGame.js";

for (const viewport of [{width:390,height:740},{width:1440,height:900}]) {
  test(`player feedback remains clickable above open cards at ${viewport.width}px`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await openLocalGame(page);
    const numbers=page.locator('[data-map-numbers-toggle]');
    await numbers.click();await expect(numbers).toHaveAttribute('aria-pressed','true');
    await numbers.click();await expect(numbers).toHaveAttribute('aria-pressed','false');
    const heat=page.locator('[data-gang-heat-open]');
    await heat.locator('.gang-profile-row__label').click();
    await expect(page.locator('.wanted-popup-shell')).toBeVisible();
    await page.evaluate(()=>{
      const root=document.querySelector('#game-root');
      window.EmpireRuntime.queueOrOpenResultModal(root,'police',{
        title:'Příchozí útok',badge:'Oznámení',summary:'Útočící nick zahájil útok na tvůj District 2.',
        rows:[{label:'Útočník',value:'Útočící nick'},{label:'Konec boje',value:'19 min 40 s'}]
      });
      window.EmpireRuntime.queueOrOpenResultModal(root,'spy',{
        title:'Špehování dokončeno',summary:'Výsledky jsou připravené.',rows:[{label:'Výsledek',value:'Úspěch'}]
      });
    });
    const spy=page.locator('#spy-result-modal');
    await expect(spy).toBeVisible();
    await expect(page.locator('#police-action-result-modal')).toBeHidden();
    await page.screenshot({path:testInfo.outputPath(`feedback-top-${viewport.width}.png`)});
    await page.locator('#spy-result-modal-close').click();
    const incoming=page.locator('#police-action-result-modal');
    await expect(incoming).toBeVisible();await expect(incoming).toContainText('Útočící nick');
    await page.locator('#police-action-result-modal-close').click();await expect(incoming).toBeHidden();
    await expect(page.locator('.wanted-popup-shell')).toBeVisible();
    await page.screenshot({path:testInfo.outputPath(`feedback-restored-${viewport.width}.png`)});
  });
}
