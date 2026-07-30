import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";
const suppliedIdentity = process.env.EMPIRE_HOSTED_BOOTSTRAP_USERNAME
  ? {
      username: process.env.EMPIRE_HOSTED_BOOTSTRAP_USERNAME,
      gangName: process.env.EMPIRE_HOSTED_BOOTSTRAP_GANG_NAME,
      password: process.env.EMPIRE_HOSTED_BOOTSTRAP_PASSWORD,
      networkIdentifier: process.env.EMPIRE_HOSTED_BOOTSTRAP_NETWORK_IDENTIFIER
    }
  : null;
const suppliedIdentities = parseSuppliedIdentities(
  process.env.EMPIRE_HOSTED_BOOTSTRAP_IDENTITIES_JSON
);

test.skip(
  !hostedEnabled || !serverInstanceId,
  "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for local hosted bootstrap."
);
test.setTimeout(360_000);

test("prepares canonical ready players for server start", async ({ browser, page }) => {
  const identities = suppliedIdentities.length
    ? suppliedIdentities
    : [suppliedIdentity];
  const spawnDistrictIds = new Set();

  for (let index = 0; index < identities.length; index += 1) {
    const context = index === 0
      ? null
      : await browser.newContext({
          baseURL: process.env.PLAYWRIGHT_E2E_BASE_URL
        });
    const targetPage = context ? await context.newPage() : page;
    try {
      const entry = await registerAndEnterHostedUiParityGame(targetPage, {
        serverInstanceId,
        identityPrefix: `LocalHostedBootstrap${index + 1}`,
        identity: identities[index]
      });
      expect(entry.spawnDistrictId).toMatch(/^district:/u);
      expect(spawnDistrictIds.has(entry.spawnDistrictId)).toBe(false);
      spawnDistrictIds.add(entry.spawnDistrictId);
      await expectHostedUiParityClean(targetPage, entry.diagnostics);
    } finally {
      await context?.close();
    }
  }
});

function parseSuppliedIdentities(value) {
  if (!value) return [];
  const parsed = JSON.parse(value);
  expect(Array.isArray(parsed)).toBe(true);
  for (const identity of parsed) {
    expect(identity).toMatchObject({
      username: expect.any(String),
      gangName: expect.any(String),
      password: expect.any(String),
      networkIdentifier: expect.any(String)
    });
  }
  return parsed;
}
