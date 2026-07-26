import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getForcedDevelopmentRuntimeMode,
  isLegacyGameplayFallbackAllowed
} from "../../../apps/client/src/browser/gameplay-slice-runtime-diagnostics";
import { applyDevelopmentRuntimeOverride } from "../../../apps/client/src/browser/gameplay-slice-runtime-policy";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.document = originalDocument;
  globalThis.window = originalWindow;
});

const installBrowser = ({
  hostname,
  search,
  metaContent = "local-demo",
  localDemoEnabled = false,
  sessionDemoEnabled = false,
  storedMode = null,
  entrypointMode = null
}: {
  hostname: string;
  search: string;
  metaContent?: string;
  localDemoEnabled?: boolean;
  sessionDemoEnabled?: boolean;
  storedMode?: string | null;
  entrypointMode?: "server-authoritative" | "local-demo" | null;
}) => {
  const setMode = vi.fn();
  const meta = { getAttribute: () => metaContent };
  globalThis.document = {
    body: { dataset: {} },
    documentElement: { dataset: {} },
    querySelector: () => meta
  } as unknown as Document;
  globalThis.window = {
    document: globalThis.document,
    __EMPIRE_GAMEPLAY_EXECUTION_MODE__: entrypointMode || undefined,
    EmpireConfigOverrides: { localDemoEnabled },
    empireStreetsRuntimeDiagnostics: { setMode },
    localStorage: { getItem: () => storedMode },
    sessionStorage: {
      getItem: () => sessionDemoEnabled ? "1" : null,
      removeItem: vi.fn()
    },
    location: { hostname, protocol: hostname === "localhost" ? "http:" : "https:", search }
  } as unknown as Window & typeof globalThis;
  return { setMode };
};

describe("gameplay slice runtime policy", () => {
  it("honors the configured local-demo mode on loopback without starting a server slice", () => {
    const { setMode } = installBrowser({ hostname: "localhost", search: "", metaContent: "local-demo" });
    const root = { dataset: {}, hidden: false } as unknown as HTMLElement;

    expect(getForcedDevelopmentRuntimeMode()).toBe("demo");
    expect(applyDevelopmentRuntimeOverride(root)).toBe(true);
    expect(root.hidden).toBe(true);
    expect(root.dataset.gameplayRuntime).toBe("demo-ready");
    expect(root.dataset.gameplayServerRuntime).toBe("not-requested");
    expect(setMode).toHaveBeenCalledWith("demo", expect.objectContaining({ serverSliceActive: false }));
  });

  it("lets an explicit local development server-authoritative request override demo meta", () => {
    installBrowser({
      hostname: "localhost",
      search: "?runtimeMode=server-authoritative",
      localDemoEnabled: true,
      sessionDemoEnabled: true
    });
    const root = { dataset: {}, hidden: false } as unknown as HTMLElement;

    expect(getForcedDevelopmentRuntimeMode()).toBe("server-authoritative");
    expect(applyDevelopmentRuntimeOverride(root)).toBe(false);
    expect(root.dataset.gameplayRuntime).toBeUndefined();
  });

  it("does not enable a legacy fallback on localhost without an explicit demo mode", () => {
    installBrowser({ hostname: "localhost", search: "", metaContent: "server-authoritative" });

    expect(getForcedDevelopmentRuntimeMode()).toBe("server-authoritative");
    expect(isLegacyGameplayFallbackAllowed()).toBe(false);
  });

  it("uses the entrypoint authority instead of a stale localStorage demo preference", () => {
    installBrowser({
      hostname: "localhost",
      search: "",
      metaContent: "server-authoritative",
      storedMode: "local-demo",
      entrypointMode: "server-authoritative"
    });
    const root = { dataset: {}, hidden: false } as unknown as HTMLElement;

    expect(getForcedDevelopmentRuntimeMode()).toBe("server-authoritative");
    expect(applyDevelopmentRuntimeOverride(root)).toBe(false);
    expect(root.hidden).toBe(false);
  });

  it("uses an explicit local demo config before the module entrypoint runs", () => {
    installBrowser({
      hostname: "127.0.0.1",
      search: "",
      metaContent: "server-authoritative",
      localDemoEnabled: true
    });

    expect(getForcedDevelopmentRuntimeMode()).toBe("demo");
    expect(isLegacyGameplayFallbackAllowed()).toBe(true);
  });

  it("rejects an explicit hosted local-demo request before app-entry runs", () => {
    installBrowser({
      hostname: "empirestreets.cz",
      search: "?runtimeMode=local-demo",
      metaContent: "server-authoritative"
    });

    expect(getForcedDevelopmentRuntimeMode()).toBe("server-authoritative");
    expect(isLegacyGameplayFallbackAllowed()).toBe(false);
  });

  it("rejects the hosted local-demo session before app-entry runs", () => {
    installBrowser({
      hostname: "empirestreets.cz",
      search: "",
      metaContent: "server-authoritative",
      sessionDemoEnabled: true
    });

    expect(getForcedDevelopmentRuntimeMode()).toBe("server-authoritative");
    expect(isLegacyGameplayFallbackAllowed()).toBe(false);
  });
});
