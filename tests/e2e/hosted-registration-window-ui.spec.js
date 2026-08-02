import { expect, test } from "@playwright/test";
import { createDistrictGeometry } from "../../page-assets/js/app/district-geometry.js";

const SERVER_ID = "instance:free:eu-central:alpha";
const OPEN_AT = "2026-07-18T18:00:00.000Z";
const CLOSE_AT = "2026-07-18T19:00:00.000Z";

test("production lobby refreshes scheduled registration at the inclusive open boundary", async ({ page }) => {
  let phase = "scheduled";
  await routeOverview(page, () => overview({ phase }));

  await page.goto("/pages/lobby.html?runtimeMode=server-authoritative", { waitUntil: "domcontentloaded" });
  const card = page.locator(`[data-live-server="${SERVER_ID}"]`);
  await expect(card.locator("[data-live-registration-status]")).toHaveText("REGISTRACE NAPLÁNOVÁNA");
  await expect(card.locator("[data-open-live-server]")).toBeDisabled();

  const boundaryRefresh = page.waitForResponse((response) =>
    response.url().includes("/api/lobby/overview") && response.ok());
  phase = "open";
  await page.clock.fastForward(1_000);
  await boundaryRefresh;
  await expect(card.locator("[data-live-registration-status]")).toHaveText("REGISTRACE OTEVŘENA");
  await expect(card.locator("[data-open-live-server]")).toBeEnabled();
  await expect(card.locator("[data-live-registration-countdown]")).toContainText("Zbývá ");
});

test("production lobby closes CTA at the exclusive close boundary", async ({ page }) => {
  let phase = "open";
  await routeOverview(page, () => overview({ phase }));

  await page.goto("/pages/lobby.html?runtimeMode=server-authoritative", { waitUntil: "domcontentloaded" });
  const card = page.locator(`[data-live-server="${SERVER_ID}"]`);
  await expect(card.locator("[data-open-live-server]")).toBeEnabled();

  phase = "closed";
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(card.locator("[data-live-registration-status]")).toHaveText("REGISTRACE UKONČENA");
  await expect(card.locator("[data-open-live-server]")).toBeDisabled();
  await expect(card.locator("[data-open-live-server]")).toHaveText("REGISTRACE UKONČENA");
});

test("setup_required membership can continue after registration closes", async ({ page }) => {
  await routeOverview(page, () => overview({ phase: "closed", membership: setupMembership() }));

  await page.goto("/pages/lobby.html?runtimeMode=server-authoritative", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-lobby-continue-active]")).toBeEnabled();
  await expect(page.locator("[data-lobby-continue-active]")).toHaveText("DOKONČIT VSTUP");
  await expect(page.locator(`[data-open-live-server="${SERVER_ID}"]`)).toBeDisabled();
});

test("production spawn map renders the city image, zone legend, and occupied player districts", async ({ page }) => {
  await routeOverview(page, () => overview({ phase: "open" }));
  await page.route("**/api/lobby/servers/*/spawn-districts", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ accepted: true, data: spawnSelection(), errors: [] })
  }));
  const mapImageLoaded = page.waitForResponse((response) =>
    response.url().endsWith("/img/mapanoc.png") && response.ok());

  await page.goto("/pages/lobby.html?runtimeMode=server-authoritative", { waitUntil: "domcontentloaded" });
  await mapImageLoaded;
  await page.locator(`[data-open-live-server="${SERVER_ID}"]`).click();

  const modal = page.getByTestId("server-detail-modal");
  await expect(modal).toHaveAttribute("aria-hidden", "false");
  await expect(modal.locator("[data-server-detail-type-counts]")).toContainText("COMMERCIAL");
  await expect(modal.locator("[data-server-detail-type-counts]")).toContainText("PARK");
  await expect(modal.locator("[data-server-detail-subtitle]")).toContainText("Obsazeno: 1");
  const canvas = page.getByTestId("server-detail-map");
  await expect(canvas).toHaveAttribute("aria-label", /161 districtů, území hráčů: 1/u);

  const district = createDistrictGeometry(1600, 980, 0, 48, 0).districts
    .find((entry) => entry.id === 7);
  expect(district).toBeTruthy();
  const ownerMarkerPixel = await canvas.evaluate((node, point) => {
    const data = node.getContext("2d").getImageData(point.x, point.y, 1, 1).data;
    return Array.from(data);
  }, { x: Math.round(district.centerX), y: Math.round(district.centerY) });
  expect(ownerMarkerPixel[1]).toBeGreaterThan(ownerMarkerPixel[0]);
  expect(ownerMarkerPixel[1]).toBeGreaterThan(ownerMarkerPixel[2]);
});

test("production lobby opens the spawn modal while a cold spawn response is still loading", async ({ page }) => {
  await routeOverview(page, () => overview({ phase: "open" }));
  let releaseSpawnResponse;
  const spawnResponseGate = new Promise((resolve) => {
    releaseSpawnResponse = resolve;
  });
  await page.route("**/api/lobby/servers/*/spawn-districts", async (route) => {
    await spawnResponseGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: true, data: spawnSelection(), errors: [] })
    });
  });

  await page.goto("/pages/lobby.html?runtimeMode=server-authoritative", { waitUntil: "domcontentloaded" });
  await page.locator(`[data-open-live-server="${SERVER_ID}"]`).click();

  const modal = page.getByTestId("server-detail-modal");
  await expect(modal).toHaveAttribute("aria-hidden", "false");
  await expect(modal).toHaveAttribute("data-load-state", "loading");
  await expect(modal.locator("[data-server-detail-hint]")).toHaveText("Načítám aktuální spawn distrikty…");
  await expect(page.getByTestId("confirm-server-district")).toBeDisabled();

  releaseSpawnResponse();
  await expect(modal).toHaveAttribute("data-load-state", "ready");
  await expect(modal.locator("[data-server-detail-type-counts]")).toContainText("COMMERCIAL");
});

const routeOverview = (page, resolveOverview) => page.route("**/api/lobby/overview", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ accepted: true, data: resolveOverview(), errors: [] })
}));

const overview = ({ phase, membership = null }) => {
  const generatedAt = phase === "scheduled"
    ? "2026-07-18T17:59:59.000Z"
    : phase === "open"
      ? "2026-07-18T18:00:00.000Z"
      : "2026-07-18T19:00:00.000Z";
  return {
    account: { accountId: "account:e2e", username: "Alpha", displayName: "Alpha", gangName: "Night Shift", expiresAt: "2026-07-19T00:00:00.000Z" },
    gangProfile: { gangName: "Night Shift", displayName: "Alpha", username: "Alpha" },
    activeBlockingMembership: membership,
    memberships: membership ? [membership] : [],
    availableServers: [serverSummary(phase, generatedAt)],
    featureAvailability: { market: "preparing", localDemo: false },
    generatedAt
  };
};

const serverSummary = (phase, generatedAt) => ({
  serverInstanceId: SERVER_ID,
  displayName: "První Free Alpha",
  mode: "free",
  region: "eu-central",
  status: phase === "open" ? "lobby" : phase === "closed" ? "running" : "lobby",
  joinPolicy: phase === "open" ? "open" : "closed",
  provisioningState: "ready",
  capacity: 20,
  committedPlayers: 2,
  reservedSlots: 0,
  readyPlayers: 2,
  minimumReadyPlayersToStart: 2,
  registrationState: phase,
  registrationOpensAt: OPEN_AT,
  registrationClosesAt: CLOSE_AT,
  registrationClosedAt: phase === "closed" ? CLOSE_AT : null,
  registrationRemainingMs: phase === "scheduled" ? 1_000 : phase === "open" ? 3_600_000 : 0,
  registrationReasonCode: phase === "scheduled" ? "SERVER_REGISTRATION_NOT_OPEN" : phase === "closed" ? "SERVER_REGISTRATION_CLOSED" : null,
  canStart: phase === "open",
  joinable: phase === "open",
  disabledReason: phase === "scheduled" ? "SERVER_REGISTRATION_NOT_OPEN" : phase === "closed" ? "SERVER_REGISTRATION_CLOSED" : null,
  startedAt: phase === "closed" ? "2026-07-18T18:10:00.000Z" : null,
  generatedAt
});

const setupMembership = () => ({
  membershipId: "membership:e2e",
  serverInstanceId: SERVER_ID,
  serverDisplayName: "První Free Alpha",
  playerId: "player:e2e",
  status: "setup_required",
  reservedSpawnDistrictId: "district:42",
  factionId: null,
  avatarId: null,
  gangColor: null,
  joinedAt: "2026-07-18T18:59:55.000Z",
  setupCompletedAt: null,
  earlyLeaveAt: null,
  completedAt: null,
  canLeaveEarly: true,
  earlyLeaveDeadline: "2026-07-18T19:10:00.000Z",
  earlyLeaveRemainingMs: 420_000,
  earlyLeaveBlockedReason: null,
  joinTicket: null
});

const spawnSelection = () => ({
  serverInstanceId: SERVER_ID,
  membershipEligibility: "eligible",
  capacity: { committedPlayers: 2, reservedSlots: 0, maximum: 20 },
  serverStatus: "lobby",
  joinPolicy: "open",
  readyPlayers: 2,
  minimumReadyPlayersToStart: 2,
  registrationState: "open",
  registrationOpensAt: OPEN_AT,
  registrationClosesAt: CLOSE_AT,
  registrationClosedAt: null,
  registrationRemainingMs: 3_600_000,
  registrationReasonCode: null,
  canStart: true,
  joinable: true,
  disabledReason: null,
  generatedAt: OPEN_AT,
  availabilityRevision: "revision:e2e",
  districts: [{
    districtId: "district:7",
    zone: "park",
    label: "Neon Park",
    available: false,
    disabledReason: "OWNED",
    buildingPreview: [],
    neighboringDistrictCount: 3,
    spawnCategory: "edge",
    version: 2
  }],
  mapDistricts: [{
    districtId: "district:7",
    zone: "park",
    label: "Neon Park",
    status: "claimed",
    owner: {
      playerId: "player:e2e-owner",
      displayName: "Owner",
      gangName: "Neon Wolves",
      color: "#12ab34"
    },
    reserved: true,
    spawnEligible: true,
    version: 2
  }]
});
