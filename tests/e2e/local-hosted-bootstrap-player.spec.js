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

test.skip(
  !hostedEnabled || !serverInstanceId,
  "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for local hosted bootstrap."
);
test.setTimeout(360_000);

test("prepares one canonical ready player for server start", async ({ page }) => {
  const entry = await registerAndEnterHostedUiParityGame(page, {
    serverInstanceId,
    identityPrefix: "LocalHostedBootstrap",
    identity: suppliedIdentity
  });
  expect(entry.spawnDistrictId).toMatch(/^district:/u);
  await expectHostedUiParityClean(page, entry.diagnostics);
});
