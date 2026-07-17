import { expect, test } from "@playwright/test";

process.loadEnvFile?.(".env.local");

const liveEnabled = process.env.EMPIRE_ADMIN_HOSTED_LIVE_E2E === "1";
const username = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "");

test.use({ trace: "off", video: "off" });
test.skip(!liveEnabled, "Set EMPIRE_ADMIN_HOSTED_LIVE_E2E=1 and run against local PostgreSQL/API/worker.");

test("dashboard renders hosted monitoring from durable postgres state", async ({ page }) => {
  if (!username || !password) throw new Error("Live admin credentials are not configured in .env.local.");
  await page.goto("/admin.html");
  await page.locator("[data-admin-username]").fill(username);
  await page.locator("[data-admin-password]").fill(password);
  await page.getByRole("button", { name: "Přihlásit" }).click();
  await expect(page.getByRole("heading", { name: "Read-only admin" })).toBeVisible();

  const response = await page.evaluate(async () => {
    const result = await fetch("/api/admin/control-plane", { credentials: "same-origin", cache: "no-store" });
    return { status: result.status, body: await result.json() };
  });
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    accepted: true,
    data: {
      databaseAvailable: true,
      migrationsCurrent: true,
      workerStatus: "online"
    }
  });
  const servers = response.body.data.servers;
  expect(servers.length).toBeGreaterThan(0);
  const target = servers.find((server) => server.displayName === "Local Free Alpha 1")
    ?? [...servers].sort((left, right) => String(right.lastWorkerHeartbeatAt ?? "").localeCompare(String(left.lastWorkerHeartbeatAt ?? "")))[0];
  expect(target).toBeTruthy();

  await page.locator("[data-admin-instance]").filter({ hasText: target.serverInstanceId }).click();
  await expect(page).toHaveURL(new RegExp(`instance=${encodeURIComponent(target.serverInstanceId).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`));

  const controlPlane = page.locator("#admin-control-plane");
  await expect(controlPlane).toContainText("AVAILABLE");
  await expect(controlPlane).toContainText("CURRENT");
  await expect(controlPlane).toContainText("ONLINE");
  const lifecycle = page.locator(".admin-lifecycle");
  await expect(lifecycle).toContainText(`Lifecycle: ${target.displayName}`);
  await expect(metric(lifecycle, "Committed players")).toContainText(String(target.committedPlayers ?? 0));
  await expect(metric(lifecycle, "Reserved slots")).toContainText(String(target.reservedSlots ?? 0));
  await expect(metric(lifecycle, "Capacity")).toContainText(String(target.capacity));
  await expect(metric(lifecycle, "Join policy")).toContainText(target.joinPolicy);
  await expect(metric(lifecycle, "Lease owner")).toContainText(target.runtimeLeaseOwnerId ?? "-");
  await expect(lifecycle).toContainText(target.status);
  await expect(lifecycle).toContainText(target.provisioningState);

  const detail = page.locator("section.admin-section-anchor").filter({ has: page.getByRole("heading", { name: target.displayName, exact: true }) });
  await expect(detail).toContainText(target.serverInstanceId);
  await expect(detail).toContainText("Snapshot");
  await expect(detail).toContainText("Heartbeat");
  await expect(detail).toContainText("Lease owner");
});

const metric = (scope, label) => scope.locator(".admin-kv-grid > span").filter({ hasText: label });
