import { afterEach, describe, expect, it } from "vitest";
import {
  getLocalDemoGameplayBridgeForMode,
  installLocalDemoGameplayBridge,
  uninstallLocalDemoGameplayBridge
} from "../../page-assets/js/app/runtime/localDemoGameplayBridge.js";

afterEach(() => {
  uninstallLocalDemoGameplayBridge();
  delete globalThis.empireLocalDemoGameplayBridge;
});

describe("local-demo browser event bridge authority", () => {
  it("exposes the compatibility provider only in explicit local-demo mode", () => {
    const provider = { marker: "local-demo-only" };
    globalThis.empireLocalDemoGameplayBridge = provider;

    expect(getLocalDemoGameplayBridgeForMode("local-demo")).toBe(provider);
    expect(getLocalDemoGameplayBridgeForMode("server-authoritative")).toBeNull();
    expect(getLocalDemoGameplayBridgeForMode("onboarding-sandbox")).toBeNull();
    expect(getLocalDemoGameplayBridgeForMode("unavailable")).toBeNull();
  });

  it("retains the optional E2E population fixture callback only inside the local-demo bridge", () => {
    const noop = () => {};
    const setE2eDistrictBuildingPopulationBuffer = () => ({
      capacity: 20,
      mechanicsType: "school",
      storedAmount: 1.25
    });
    const provider = installLocalDemoGameplayBridge({
      activatePlayerBoost: noop,
      addGangHeat: noop,
      appendBuildingActionResultEntry: noop,
      applyInventoryOutput: noop,
      applyTopbarEconomy: noop,
      getPlayerBoostViewModel: noop,
      getResolvedGangState: noop,
      renderSpyResourceState: noop,
      setBuildingActionFeedback: noop,
      setE2eDistrictBuildingPopulationBuffer
    });

    expect(provider.setE2eDistrictBuildingPopulationBuffer).toBe(
      setE2eDistrictBuildingPopulationBuffer
    );
    expect(getLocalDemoGameplayBridgeForMode("server-authoritative")).toBeNull();
  });
});
