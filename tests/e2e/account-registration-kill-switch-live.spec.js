import { expect, test } from "@playwright/test";

const liveEnabled = process.env.EMPIRE_ACCOUNT_REGISTRATION_KILL_SWITCH_E2E === "1";
const username = process.env.EMPIRE_KILL_SWITCH_USERNAME;
const password = process.env.EMPIRE_KILL_SWITCH_PASSWORD;

test.skip(
  !liveEnabled || !username || !password,
  "Run through scripts/run-account-registration-kill-switch-e2e.mjs."
);
test.use({ trace: "off", video: "off" });
test.setTimeout(120_000);

test("closed registration keeps existing account login available", async ({ page }) => {
  const policyResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/account/registration-policy")
  );
  await page.goto("/pages/login.html");
  expect((await (await policyResponse).json()).data).toMatchObject({
    registrationEnabled: false,
    mode: "closed",
    termsAcceptanceRequired: true
  });

  await page.locator("[data-login-registration-open]").click();
  await expect(page.locator("#register-username")).toBeDisabled();
  await expect(page.locator("#register-terms")).toBeDisabled();
  await expect(page.getByTestId("register-form").getByRole("button", { name: "ZALOŽIT GANG" })).toBeDisabled();

  const directRegister = await page.evaluate(async () => {
    const response = await fetch("/api/account/register", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    return { status: response.status, payload: await response.json() };
  });
  expect(directRegister).toMatchObject({
    status: 403,
    payload: { accepted: false, errors: [{ code: "ACCOUNT_REGISTRATION_CLOSED" }] }
  });

  await page.keyboard.press("Escape");
  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill(password);
  await page.getByTestId("login-form").getByRole("button", { name: "VSTOUPIT DO MĚSTA" }).click();
  await expect(page).toHaveURL(/\/pages\/lobby\.html/u);
  await expect(page.locator("[data-live-gang-user]")).toHaveText(username);
  await page.reload();
  await expect(page.locator("[data-live-gang-user]")).toHaveText(username);
});
