import { describe, expect, it, vi } from "vitest";
import { createServerAuthoritativePageLifecycle } from "../../page-assets/js/app/presentation/serverAuthoritativePageLifecycle.js";

const createWindowScope = () => {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.(event);
    },
    listenerCount(type) {
      return Number(listeners.has(type));
    }
  };
};

describe("server authoritative page lifecycle", () => {
  it("resumes exactly once after each BFCache cycle without duplicating listeners", () => {
    const windowRef = createWindowScope();
    const onPageHide = vi.fn();
    const onResume = vi.fn();
    const lifecycle = createServerAuthoritativePageLifecycle({
      windowRef,
      onPageHide,
      onResume
    });
    const context = { kind: "membership", membership: { membershipId: "membership:test" } };

    expect(lifecycle.track(context)).toBe(true);
    expect(lifecycle.track(context)).toBe(true);
    expect(windowRef.listenerCount("pagehide")).toBe(1);
    expect(windowRef.listenerCount("pageshow")).toBe(1);

    windowRef.dispatch("pagehide", { persisted: true });
    windowRef.dispatch("pageshow", { persisted: true });
    windowRef.dispatch("pageshow", { persisted: true });

    expect(onPageHide).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledWith(context);
    expect(lifecycle.isResumePending()).toBe(false);

    windowRef.dispatch("pagehide", { persisted: true });
    windowRef.dispatch("pageshow", { persisted: true });

    expect(onResume).toHaveBeenCalledTimes(2);
    expect(windowRef.listenerCount("pagehide")).toBe(1);
    expect(windowRef.listenerCount("pageshow")).toBe(1);
  });

  it("does not resume a normal unload and removes lifecycle listeners on destroy", () => {
    const windowRef = createWindowScope();
    const onResume = vi.fn();
    const lifecycle = createServerAuthoritativePageLifecycle({ windowRef, onResume });

    lifecycle.track({ kind: "membership" });
    windowRef.dispatch("pagehide", { persisted: false });
    windowRef.dispatch("pageshow", { persisted: true });

    expect(onResume).not.toHaveBeenCalled();
    expect(lifecycle.destroy()).toBe(true);
    expect(lifecycle.destroy()).toBe(false);
    expect(windowRef.listenerCount("pagehide")).toBe(0);
    expect(windowRef.listenerCount("pageshow")).toBe(0);
  });
});
