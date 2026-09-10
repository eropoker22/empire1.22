import { expect, test } from "@playwright/test";

test("an armed trap stays visible and animates on a phone map, then disappears when removed", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 393, height: 500 });
  await page.route("**/trap-map-test", (route) => route.fulfill({ contentType: "text/html", body:
    '<!doctype html><style>body{margin:0;background:#081722}canvas{width:393px;height:300px;background:url(/img/mapanoc.png) center/100% 100%}</style><canvas id="map" width="393" height="300"></canvas>' }));
  await page.goto("/trap-map-test");
  await page.evaluate(async () => {
    const { createServerMapCanvasComposition } = await import("/page-assets/js/app/map/serverMapCanvasComposition.js");
    const { createServerMapPresentationModel } = await import("/page-assets/js/app/map/serverMapPresentationModel.js");
    const { createServerMapInteractionState, syncServerMapInteractionState } = await import("/page-assets/js/app/map/serverMapPresentationState.js");
    const { createDistrictGeometry } = await import("/page-assets/js/app/map/mapGeometry.js");
    const canvas = document.querySelector("#map");
    const geometry = createDistrictGeometry(393, 300, 0, 48, 0);
    const district = geometry.districts.find((entry) => entry.centerX > 120 && entry.centerX < 220 && entry.centerY > 140 && entry.centerY < 220);
    const state = createServerMapInteractionState();
    const slice = { player: { playerId: "player:1" }, districts: [], mapEffects: [] };
    const ref = { current: null };
    const composition = createServerMapCanvasComposition({ modelRef: ref });
    window.trapMapTest = {
      render(active, tick) {
        slice.mapEffects = active ? [{ type: "trap", districtId: `district:${district.id}`, playerId: "player:1" }] : [];
        ref.current = createServerMapPresentationModel(slice);
        syncServerMapInteractionState(state, ref.current);
        state.animationTick = tick;
        composition.renderDistrictEffectsCanvas(canvas, "night", state, geometry);
        const data = canvas.getContext("2d").getImageData(0, 0, 393, 300).data;
        let visible = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 100) visible++;
        return { visible, image: canvas.toDataURL() };
      }
    };
  });
  const dim = await page.evaluate(() => window.trapMapTest.render(true, 2100));
  const bright = await page.evaluate(() => window.trapMapTest.render(true, 700));
  expect(dim.visible).toBeGreaterThan(90);
  expect(bright.visible).toBeGreaterThan(dim.visible);
  expect(bright.image).not.toBe(dim.image);
  await page.locator("#map").screenshot({ path: testInfo.outputPath("trap-phone.png") });
  expect((await page.evaluate(() => window.trapMapTest.render(false, 2800))).visible).toBe(0);
});
