import { describe, expect, it } from "vitest";
import { canSubmitServerGameplayCommand } from "../../page-assets/js/app/runtime/serverCommandAuthorityGuard.js";

describe("server command authority guard", () => {
  it("prevents onboarding sandbox actions from changing a server snapshot", () => {
    let snapshotVersion = 41;
    const submit = (options) => {
      if (canSubmitServerGameplayCommand(options)) snapshotVersion += 1;
    };

    submit({
      onboardingSandboxActive: true,
      documentAvailable: true,
      hasValidatedGameplaySlice: true,
      executionMode: "server-authoritative"
    });

    expect(snapshotVersion).toBe(41);
  });

  it("allows a validated live command outside the sandbox", () => {
    expect(canSubmitServerGameplayCommand({
      onboardingSandboxActive: false,
      documentAvailable: true,
      hasValidatedGameplaySlice: true,
      executionMode: "server-authoritative"
    })).toBe(true);
  });

  it.each([
    ["missing document", { documentAvailable: false }],
    ["missing slice", { hasValidatedGameplaySlice: false }],
    ["local demo", { executionMode: "local-demo" }]
  ])("fails closed for %s", (_label, override) => {
    expect(canSubmitServerGameplayCommand({
      onboardingSandboxActive: false,
      documentAvailable: true,
      hasValidatedGameplaySlice: true,
      executionMode: "server-authoritative",
      ...override
    })).toBe(false);
  });
});
