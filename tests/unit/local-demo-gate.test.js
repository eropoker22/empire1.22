import { describe, expect, it } from "vitest";
import {
  isExplicitGamePreviewEnabled,
  isExplicitLocalDemoEnabled,
  isLocalDemoAccessAvailable
} from "../../page-assets/js/app/local-demo-gate.js";

const createSessionStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

describe("local game preview gate", () => {
  it("allows an explicit preview only on loopback hosts", () => {
    expect(isExplicitGamePreviewEnabled({ hostname: "127.0.0.1", search: "?devPreview=1" })).toBe(true);
    expect(isExplicitGamePreviewEnabled({ hostname: "localhost", search: "?devPreview=1" })).toBe(true);
    expect(isExplicitGamePreviewEnabled({ hostname: "empirestreets.cz", search: "?devPreview=1" })).toBe(false);
  });

  it("does not enable preview without the exact opt-in", () => {
    expect(isExplicitGamePreviewEnabled({ hostname: "127.0.0.1", search: "" })).toBe(false);
    expect(isExplicitGamePreviewEnabled({ hostname: "127.0.0.1", search: "?devPreview=true" })).toBe(false);
  });

  it("persists explicit local demo mode for subsequent pages in the tab", () => {
    const sessionStorageRef = createSessionStorage();
    expect(isExplicitLocalDemoEnabled({
      locationRef: { hostname: "127.0.0.1", search: "?runtimeMode=local-demo" },
      sessionStorageRef
    })).toBe(true);
    expect(isExplicitLocalDemoEnabled({
      locationRef: { hostname: "127.0.0.1", search: "" },
      sessionStorageRef
    })).toBe(true);
    expect(isExplicitLocalDemoEnabled({
      locationRef: { hostname: "127.0.0.1", search: "?runtimeMode=server-authoritative" },
      sessionStorageRef
    })).toBe(false);
  });

  it("offers the demo switch only on loopback hosts", () => {
    expect(isLocalDemoAccessAvailable({ hostname: "127.0.0.1" })).toBe(true);
    expect(isLocalDemoAccessAvailable({ hostname: "empirestreets.cz" })).toBe(false);
  });
});
