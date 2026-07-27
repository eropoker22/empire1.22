import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

const liveEnabled = process.env.EMPIRE_ACCOUNT_REGISTRATION_LIVE_E2E === "1";

test.skip(!liveEnabled, "Set EMPIRE_ACCOUNT_REGISTRATION_LIVE_E2E=1 and run against the isolated staging API.");
test.use({ trace: "off", video: "off" });
test.setTimeout(180_000);

test("registration survives reload, new tab, logout and login while invalid attempts fail closed", async ({ page, context }) => {
  const suffix = randomBytes(6).toString("hex");
  const username = `Cutover${suffix}`;
  const gangName = `Cutover Crew ${suffix}`;
  const password = randomBytes(24).toString("base64url");

  await page.setViewportSize({ width: 390, height: 844 });
  const policyResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/account/registration-policy")
  );
  await page.goto("/pages/login.html");
  const policy = await policyResponse;
  expect(policy.status()).toBe(200);
  expect((await policy.json()).data).toMatchObject({
    registrationEnabled: true,
    mode: "open",
    minimumAgeYears: 16,
    passwordMinimumLength: 12,
    termsAcceptanceRequired: true
  });

  await page.locator("[data-login-registration-open]").click();
  await expect(page.getByTestId("register-form")).toBeVisible();
  await expect(page.locator("#register-username")).toBeFocused();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await fillRegistration(page, { username, gangName, password, dateOfBirth: "1990-01-01" });
  const registerResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/account/register")
  );
  await page.getByTestId("register-form").getByRole("button", { name: "ZALOŽIT GANG" }).click();
  const registerResponse = await registerResponsePromise;
  expect(registerResponse.status()).toBe(201);
  const setCookie = String((await registerResponse.allHeaders())["set-cookie"] ?? "");
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("Secure");
  expect(setCookie).toContain("SameSite=Strict");
  expect(setCookie).toContain("Path=/");
  expect(setCookie).not.toContain("Domain=");

  await expect(page).toHaveURL(/\/pages\/lobby\.html/u);
  await expect(page.locator("[data-live-gang-user]")).toHaveText(username);
  await page.reload();
  await expect(page.locator("[data-live-gang-user]")).toHaveText(username);

  const secondPage = await context.newPage();
  await secondPage.goto("/pages/lobby.html");
  await expect(secondPage.locator("[data-live-gang-user]")).toHaveText(username);
  await secondPage.close();

  await page.locator("[data-lobby-nav-target='settings']").click();
  await page.locator("[data-live-account-logout]").click();
  await expect(page).toHaveURL(/\/pages\/login\.html/u);
  await expect(page.getByTestId("login-form")).toBeVisible();

  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill(`${password}-wrong`);
  await page.getByTestId("login-form").getByRole("button", { name: "VSTOUPIT DO MĚSTA" }).click();
  await expect(page.locator("#auth-error")).toContainText("Přihlášení se nezdařilo.");

  await page.locator("#login-password").fill(password);
  await page.getByTestId("login-form").getByRole("button", { name: "VSTOUPIT DO MĚSTA" }).click();
  await expect(page).toHaveURL(/\/pages\/lobby\.html/u);
  await expect(page.locator("[data-live-gang-user]")).toHaveText(username);

  await page.locator("[data-lobby-nav-target='settings']").click();
  await page.locator("[data-live-account-logout]").click();
  await expect(page).toHaveURL(/\/pages\/login\.html/u);
  await page.locator("[data-login-registration-open]").click();
  await fillRegistration(page, { username, gangName, password, dateOfBirth: "1990-01-01" });
  await page.getByTestId("register-form").getByRole("button", { name: "ZALOŽIT GANG" }).click();
  await expect(page.locator("#register-error")).toContainText("Uživatelské jméno už existuje.");

  await page.locator("#register-username").fill(`Young${suffix}`);
  await page.locator("#register-gang").fill(`Young Crew ${suffix}`);
  await page.locator("#register-birth-date").evaluate((input) => input.removeAttribute("max"));
  await page.locator("#register-birth-date").fill(new Date().getUTCFullYear() + "-01-01");
  await page.getByTestId("register-form").getByRole("button", { name: "ZALOŽIT GANG" }).click();
  await expect(page.locator("#register-error")).toContainText("kterému už bylo 16 let");
});

const fillRegistration = async (page, { username, gangName, password, dateOfBirth }) => {
  await page.locator("#register-username").fill(username);
  await page.locator("#register-gang").fill(gangName);
  await page.locator("#register-birth-date").fill(dateOfBirth);
  await page.locator("#register-password").fill(password);
  await page.locator("#register-password-confirmation").fill(password);
  await page.locator("#register-terms").check();
};
