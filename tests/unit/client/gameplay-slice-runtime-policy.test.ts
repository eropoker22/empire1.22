import { afterEach, describe, expect, it, vi } from "vitest";
import { getForcedDevelopmentRuntimeMode } from "../../../apps/client/src/browser/gameplay-slice-runtime-diagnostics";
import { applyDevelopmentRuntimeOverride } from "../../../apps/client/src/browser/gameplay-slice-runtime-policy";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
});

const installBrowser = ({ hostname, search }: { hostname: string; search: string }) => {
  const setMode = vi.fn();
  const meta = { getAttribute: () => "local-demo" };
  globalThis.document = {
    body: { dataset: {} },
    documentElement: { dataset: {} },
    querySelector: () => meta
  } as unknown as Document;
  globalThis.window = {
    document: globalThis.document,
    empireStreetsRuntimeDiagnostics: { setMode },
    localStorage: { getItem: () => null },
    location: { hostname, protocol: hostname === "localhost" ? "http:" : "https:", search }
  } as unknown as Window & typeof globalThis;
  return { setMode };
};

describe("gameplay slice runtime policy", () => {
  it("honors the configured local-demo mode without starting a server slice", () => {
    const { setMode } = installBrowser({ hostname: "empire.example", search: "" });
    const root = { dataset: {}, hidden: false } as unknown as HTMLElement;

    expect(getForcedDevelopmentRuntimeMode()).toBe("demo");
    expect(applyDevelopmentRuntimeOverride(root)).toBe(true);
    expect(root.hidden).toBe(true);
    expect(root.dataset.gameplayRuntime).toBe("demo-ready");
    expect(root.dataset.gameplayServerRuntime).toBe("not-requested");
    expect(setMode).toHaveBeenCalledWith("demo", expect.objectContaining({ serverSliceActive: false }));
  });

  it("lets an explicit local development server-authoritative request override demo meta", () => {
    installBrowser({ hostname: "localhost", search: "?runtimeMode=server-authoritative" });
    const root = { dataset: {}, hidden: false } as unknown as HTMLElement;

    expect(getForcedDevelopmentRuntimeMode()).toBe("server-authoritative");
    expect(applyDevelopmentRuntimeOverride(root)).toBe(false);
    expect(root.dataset.gameplayRuntime).toBeUndefined();
  });
});
