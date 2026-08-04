import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GAMEPLAY_EXECUTION_MODES } from "../../page-assets/js/app/runtime/gameplayExecutionMode.js";
import { resolveOnboardingRuntimePolicy } from "../../page-assets/js/app/runtime/onboardingRuntimePolicy.js";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("live gameplay bootstrap authority", () => {
  it("loads the gameplay client only after a live membership is prepared", () => {
    const app = read("page-assets/js/app.js");
    const bootstrap = read("page-assets/js/app/runtime/liveGameplayBootstrap.js");
    const page = read("pages/game.html");

    expect(app).toContain("prepareLiveGameplayBootstrap(context.membership)");
    expect(bootstrap).toContain('membership?.status === "active"');
    expect(bootstrap).toContain("window.EmpireGameplaySliceClient?.mount");
    expect(page).not.toContain('<script src="../page-assets/js/client-assets/gameplay-slice-client.js"></script>');
  });

  it("does not use browser storage as gameplay identity", () => {
    const bootstrapSource = read("apps/client/src/browser/gameplay-slice-bootstrap.ts");
    const entryClient = read("page-assets/js/app/player-entry-client.js");

    expect(bootstrapSource).not.toContain("readLegacySession");
    expect(bootstrapSource).not.toContain("registration?.identity");
    expect(entryClient).not.toContain('localStorage.setItem("empireStreets.session.v1"');
  });

  it("binds hosted onboarding presentation inside the isolated onboarding sandbox", () => {
    const runtime = read("page-assets/js/app/runtime.js");
    const onboardingBinder = runtime.slice(
      runtime.indexOf("function bindFreeSessionOnboarding"),
      runtime.indexOf("function getFreeSessionOnboardingProgress")
    );

    expect(resolveOnboardingRuntimePolicy(GAMEPLAY_EXECUTION_MODES.serverAuthoritative)).toEqual({
      autoStart: false,
      bind: true,
      useLocalSandbox: true
    });
    expect(onboardingBinder).toContain("resolveOnboardingRuntimePolicy(getSelectedGameplayExecutionMode())");
    expect(onboardingBinder).toContain("|| !policy.bind");
    expect(onboardingBinder).toContain("autoStart: policy.autoStart");
    expect(onboardingBinder).toContain("...(policy.useLocalSandbox");
    expect(onboardingBinder).toContain("onStepEnter: (stepId) => enterOnboardingSandboxStep(stepId, root)");
  });
});
