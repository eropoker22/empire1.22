import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, actionTimeout: 10000 });

const factionIds = ["mafian", "kartel", "kult", "tajna-organizace", "hackeri", "motorkarsky-gang", "soukroma-armada", "korporace"];
const member = (counts) => ({ membershipId: "membership:capacity", serverInstanceId: "instance:capacity",
  serverDisplayName: "Test server", reservedSpawnDistrictId: "district:1", status: "setup_required",
  factionAvailability: factionIds.map((factionId) => ({ factionId, players: counts[factionId] || 0,
    capacity: 4, available: (counts[factionId] || 0) < 4 })) });
async function openFaction(page, counts) {
  page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
  await page.route("https://**", (route) => route.abort());
  const respond = (route, data) => route.fulfill({ json: { accepted: true, data, errors: [] } });
  await page.route("**/api/lobby/overview", (route) => respond(route, {
    account: { username: "Capacity Player" }, memberships: [member(counts)], activeBlockingMembership: member(counts)
  }));
  await page.route("**/api/lobby/memberships/*", (route) => respond(route, member(counts)));
  await page.goto("/pages/faction.html?runtimeMode=server-authoritative&membership=membership%3Acapacity", { waitUntil: "commit" });
  await expect(page.locator('[data-faction-id="hackeri"] .structure-card__capacity')).toContainText("/4", { timeout: 45000 });
}
async function selectIdentity(page, factionId) {
  await page.locator(`[data-faction-id="${factionId}"]`).click();
  await page.locator("[data-live-avatar]").first().click();
  await page.locator("[data-live-color]").first().click();
  await expect(page.locator("#go-game")).toHaveAttribute("aria-disabled", "false");
}

test("full faction is visibly unavailable and live occupancy clears a newly full selection", async ({ page }, testInfo) => {
  const counts = { mafian: 4, hackeri: 1 };
  await openFaction(page, counts);
  const full = page.locator('[data-faction-id="mafian"]');
  await expect(full).toBeDisabled();
  await expect(full).toContainText("4/4 · OBSAZENO");
  await expect(full).toContainText("Server je už touto frakcí zaplněn.");
  await expect(full).toHaveClass(/is-full/);
  await page.locator("#structure-grid").screenshot({ path: testInfo.outputPath("factions-phone.png") });
  await selectIdentity(page, "hackeri");
  counts.hackeri = 4;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator('[data-faction-id="hackeri"]')).toBeDisabled();
  await expect(page.locator('[data-faction-id="hackeri"]')).not.toHaveClass(/is-active/);
  await expect(page.locator("#go-game")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#avatar-grid")).toContainText("Nejdřív vyber frakci");
});

test("a server rejection of the last faction seat refreshes the cards and allows another choice", async ({ page }) => {
  const counts = { mafian: 3 };
  await openFaction(page, counts);
  await page.route("**/api/lobby/setup/finalize", async (route) => {
    counts.mafian = 4;
    await route.fulfill({ status: 409, json: { accepted: false, data: null,
      errors: [{ code: "FACTION_FULL", message: "Server je už touto frakcí zaplněn. Vyber jinou frakci." }] } });
  });
  await selectIdentity(page, "mafian");
  await page.locator("#go-game").click();
  await expect(page.locator('[data-faction-id="mafian"]')).toBeDisabled();
  await expect(page.locator("#go-game")).toHaveAttribute("aria-disabled", "true");
  await selectIdentity(page, "kult");
});

test("rejoining the same district rotates only the ended spawn attempt's idempotency key", async ({ page }) => {
  await openFaction(page, {});
  const keys = [];
  await page.route("**/api/lobby/spawn-confirm", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]);
    await route.fulfill({ json: { accepted: true, errors: [], data: {
      membershipId: keys.length === 1 ? "membership:old" : "membership:new",
      status: keys.length === 1 ? "left_early" : "setup_required"
    } } });
  });
  const memberships = await page.evaluate(async () => {
    const { confirmSpawnDistrict } = await import("/page-assets/js/app/player-entry-client.js");
    const body = { serverInstanceId: "instance:capacity", districtId: "district:1", expectedAvailabilityRevision: "same" };
    return [await confirmSpawnDistrict(body), await confirmSpawnDistrict(body)];
  });
  expect(memberships.map((entry) => entry.membershipId)).toEqual(["membership:new", "membership:new"]);
  expect(keys).toHaveLength(3);
  expect(keys[0]).not.toBe(keys[1]);
  expect(keys[1]).toBe(keys[2]);
});
