import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GAMEPLAY_EXECUTION_MODES } from "../../page-assets/js/app/runtime/gameplayExecutionMode.js";
import { resolveOnboardingRuntimePolicy } from "../../page-assets/js/app/runtime/onboardingRuntimePolicy.js";

const root = process.cwd();

describe("runtime onboarding policy", () => {
  it("binds the shared onboarding renderer in local demo with the isolated sandbox", () => {
    expect(resolveOnboardingRuntimePolicy(GAMEPLAY_EXECUTION_MODES.localDemo)).toEqual({
      autoStart: true,
      bind: true,
      useLocalSandbox: true
    });
  });

  it("binds hosted onboarding in an isolated sandbox without auto-start fallback", () => {
    expect(resolveOnboardingRuntimePolicy(GAMEPLAY_EXECUTION_MODES.serverAuthoritative)).toEqual({
      autoStart: false,
      bind: true,
      useLocalSandbox: true
    });
  });

  it("fails closed when no gameplay presentation mode is selected", () => {
    expect(resolveOnboardingRuntimePolicy("unknown")).toEqual({
      autoStart: false,
      bind: false,
      useLocalSandbox: false
    });
  });

  it("keeps Settings presentation in shared CSS instead of inline important styles", () => {
    const binderSource = readFileSync(resolve(root, "page-assets/js/app/ui/runtimePopupBinders.js"), "utf8");
    const sharedCss = readFileSync(resolve(root, "page-assets/css/styles.css"), "utf8");

    expect(binderSource).not.toContain("setImportantStyle");
    expect(binderSource).not.toContain("applyOpaqueMobileSettingsStyles");
    expect(binderSource).not.toContain('style.setProperty(property, value, "important")');
    expect(sharedCss).toContain("html body #settings-modal:not(.hidden)");
    expect(sharedCss).toContain("html body.mobile-settings-modal-open #settings-modal");
  });
});
