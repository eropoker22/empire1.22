import { afterEach, describe, expect, it } from "vitest";
import {
  getLocalDemoGameplayBridgeForMode
} from "../../page-assets/js/app/runtime/localDemoGameplayBridge.js";

afterEach(() => {
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
});
