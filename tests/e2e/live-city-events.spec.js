import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame,
  waitForLiveGame
} from "./helpers/hostedUiParityEntry.js";
import {
  captureParitySurface,
  closeSurface,
  expectNoDuplicateVisibleUi,
  openCityEvents,
  parityViewports
} from "./helpers/uiParityCapture.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";

async function openAvailableServerOffer(page) {
  const agents = page.locator(".events-agent");
  for (let index = 0; index < await agents.count(); index += 1) {
    const agent = agents.nth(index);
    if (await agent.getAttribute("aria-disabled") === "true") continue;
    await agent.click();
    const offers = page.locator("#events-tasklist [data-event-open]");
    for (let offerIndex = 0; offerIndex < await offers.count(); offerIndex += 1) {
      const offer = offers.nth(offerIndex);
      if (!(await offer.isVisible().catch(() => false))) continue;
      await offer.click();
      await expect(page.locator("#event-detail-modal")).toBeVisible();
      const accept = page.locator("#event-detail-accept");
      if (await accept.isEnabled().catch(() => false)) return true;
      await page.locator("#event-detail-modal-close").click();
      await expect(page.locator("#event-detail-modal")).toBeHidden();
    }
  }
  return false;
}

test.describe("hosted City Events parity", () => {
  test.skip(
    !hostedEnabled || !serverInstanceId,
    "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for hosted PostgreSQL coverage."
  );
  test.setTimeout(360_000);

  test("uses one shared modal stack and typed server commands", async ({ page }) => {
    const desktop = parityViewports[0];
    const mobile = parityViewports[1];
    await page.setViewportSize(desktop);
    const entry = await registerAndEnterHostedUiParityGame(page, {
      serverInstanceId,
      spawnDistrictIds: [
        "district:48",
        "district:46",
        "district:67",
        "district:92",
        "district:111",
        "district:146",
        "district:148",
        "district:152",
        "district:157"
      ],
      identityPrefix: "LiveCityEvents"
    });

    expect(await page.locator("#city-events-open").count()).toBe(1);
    expect(await page.locator("#events-modal").count()).toBe(1);
    expect(await page.locator("#event-detail-modal").count()).toBe(1);
    await openCityEvents(page);
    await expect(page.locator("#events-modal")).toHaveAttribute("data-ui-owner", "city-events-shared");
    await expect(page.locator("#events-modal")).toHaveAttribute(
      "data-execution-mode",
      "server-authoritative"
    );
    await captureParitySurface(page, {
      mode: "server-authoritative",
      phase: "after",
      viewport: desktop,
      surfaceName: "cityEvents"
    });
    expect(await openAvailableServerOffer(page), "A current server offer must be available").toBe(true);
    await expect(page.locator("#event-detail-modal")).toHaveAttribute(
      "data-ui-owner",
      "city-events-shared"
    );
    await captureParitySurface(page, {
      mode: "server-authoritative",
      phase: "after",
      viewport: desktop,
      surfaceName: "cityEventDetail"
    });
    await expectNoDuplicateVisibleUi(page);

    const accept = page.locator("#event-detail-accept");
    await expect(accept).toBeEnabled();
    const responsePromise = page.waitForResponse((response) => (
      response.url().includes("/api/gameplay-slice/submit")
      && response.request().method() === "POST"
    ));
    await accept.click();
    const response = await responsePromise;
    const request = response.request().postDataJSON();
    const body = await response.json();
    expect(request?.command?.type).toBe("start-city-event");
    expect(body?.accepted).toBe(true);
    await expect(page.locator("#event-detail-modal")).toBeHidden();
    await expect(page.locator("#events-modal")).toBeVisible();

    await page.reload({ waitUntil: "load" });
    await waitForLiveGame(page);
    await openCityEvents(page);
    await expect(page.locator("#events-modal")).toContainText(/Probíhá|zakázk/u);
    await page.setViewportSize(mobile);
    await captureParitySurface(page, {
      mode: "server-authoritative",
      phase: "after",
      viewport: mobile,
      surfaceName: "cityEvents"
    });
    const modalBox = await page.locator("#events-modal .events-modal__content").boundingBox();
    expect(modalBox).toBeTruthy();
    expect(modalBox.x).toBeGreaterThanOrEqual(-1);
    expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(391);
    await expectNoDuplicateVisibleUi(page);
    await closeSurface(page, "cityEvents");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
    await expectHostedUiParityClean(page, entry.diagnostics);
  });
});
