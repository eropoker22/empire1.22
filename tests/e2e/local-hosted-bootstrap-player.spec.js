import { expect, test } from "@playwright/test";
import {
  expectHostedUiParityClean,
  registerAndEnterHostedUiParityGame
} from "./helpers/hostedUiParityEntry.js";

const hostedEnabled = process.env.EMPIRE_HOSTED_UI_PARITY_E2E === "1";
const serverInstanceId = process.env.EMPIRE_UI_PARITY_SERVER_ID || "";

test.skip(
  !hostedEnabled || !serverInstanceId,
  "Set EMPIRE_HOSTED_UI_PARITY_E2E=1 and EMPIRE_UI_PARITY_SERVER_ID for local hosted bootstrap."
);
test.setTimeout(360_000);

test("prepares one canonical ready player for server start", async ({ page }) => {
  const entry = await registerAndEnterHostedUiParityGame(page, {
    serverInstanceId,
    identityPrefix: "LocalHostedBootstrap"
  });
  expect(entry.spawnDistrictId).toMatch(/^district:/u);
  await expectHostedUiParityClean(page, entry.diagnostics);
});
