import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  loginAndEnterHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";

const enabled = process.env.EMPIRE_PRODUCTION_REMOTE_SMOKE === "1";
const publicOrigin = process.env.EMPIRE_PUBLIC_ORIGIN || "";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const username = process.env.PRODUCTION_SMOKE_ACCOUNT_USERNAME || "";
const password = process.env.PRODUCTION_SMOKE_ACCOUNT_PASSWORD || "";

test.skip(
  !enabled || publicOrigin !== "https://empirestreets.cz" || !serverInstanceId || !username || !password,
  "Run only through the guarded production release smoke runner."
);
test.use({ trace: "off", screenshot: "off", video: "off" });
test.setTimeout(360_000);

test("closed production account joins a disposable canonical server", async ({ page }) => {
  const policyResponse = await page.request.get("/api/account/registration-policy", {
    headers: { origin: publicOrigin }
  });
  expect(policyResponse.status()).toBe(200);
  expect((await policyResponse.json()).data).toMatchObject({
    registrationEnabled: false,
    mode: "closed"
  });

  const registrationResponse = await page.request.post("/api/account/register", {
    headers: { origin: publicOrigin },
    data: {}
  });
  expect(registrationResponse.status()).toBe(403);
  expect(await registrationResponse.json()).toMatchObject({
    accepted: false,
    errors: [{ code: "ACCOUNT_REGISTRATION_CLOSED" }]
  });

  const entry = await loginAndEnterHostedUiParityGame(page, {
    serverInstanceId,
    identity: { username, password },
    waitForRunning: false
  });
  expect(entry.serverInstanceId).toBe(serverInstanceId);
  expect(entry.spawnDistrictId).toMatch(/^district:/u);
  await expectHostedUiParityClean(page, entry.diagnostics);
});
