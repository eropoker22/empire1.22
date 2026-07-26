import { describe, expect, it, vi } from "vitest";
import {
  captureLegacyRuntimeLifecycle,
  destroyLegacyRuntimeLifecycle,
  getLegacyRuntimeLifecycleDiagnostics
} from "../../page-assets/js/app/runtime/legacyRuntimeLifecycle.js";

const createRealm = () => {
  class RealmEventTarget extends EventTarget {}
  Object.defineProperties(RealmEventTarget.prototype, {
    addEventListener: {
      configurable: true,
      writable: true,
      value(...args) {
        return EventTarget.prototype.addEventListener.call(this, ...args);
      }
    },
    removeEventListener: {
      configurable: true,
      writable: true,
      value(...args) {
        return EventTarget.prototype.removeEventListener.call(this, ...args);
      }
    }
  });

  let nextTimerId = 0;
  const timeouts = new Map();
  const intervals = new Map();
  const animationFrames = new Map();
  const windowRef = {
    EventTarget: RealmEventTarget,
    setTimeout: vi.fn((callback) => {
      const timerId = ++nextTimerId;
      timeouts.set(timerId, callback);
      return timerId;
    }),
    clearTimeout: vi.fn((timerId) => timeouts.delete(timerId)),
    setInterval: vi.fn((callback) => {
      const timerId = ++nextTimerId;
      intervals.set(timerId, callback);
      return timerId;
    }),
    clearInterval: vi.fn((timerId) => intervals.delete(timerId)),
    requestAnimationFrame: vi.fn((callback) => {
      const frameId = ++nextTimerId;
      animationFrames.set(frameId, callback);
      return frameId;
    }),
    cancelAnimationFrame: vi.fn((frameId) => animationFrames.delete(frameId))
  };
  const documentRef = new RealmEventTarget();
  Object.defineProperty(documentRef, "defaultView", { value: windowRef });
  const root = new RealmEventTarget();
  Object.defineProperty(root, "ownerDocument", { value: documentRef });
  return {
    RealmEventTarget,
    animationFrames,
    documentRef,
    intervals,
    root,
    timeouts,
    windowRef
  };
};

describe("legacy runtime lifecycle", () => {
  it("cleans listeners, timers, and RAF created during mount or captured callbacks", () => {
    const realm = createRealm();
    const target = new realm.RealmEventTarget();
    let callCount = 0;
    const nestedListener = vi.fn();
    const listener = () => {
      callCount += 1;
      realm.windowRef.setTimeout(() => {}, 10);
      realm.windowRef.requestAnimationFrame(() => {});
      target.addEventListener("nested", nestedListener);
    };

    captureLegacyRuntimeLifecycle(realm.root, "runtime", () => {
      target.addEventListener("tick", listener);
      realm.windowRef.setInterval(() => {}, 1000);
    });

    target.dispatchEvent(new Event("tick"));
    expect(callCount).toBe(1);
    expect(getLegacyRuntimeLifecycleDiagnostics(realm.root, "runtime")).toEqual({
      mounted: true,
      listenerCount: 2,
      timeoutCount: 1,
      intervalCount: 1,
      animationFrameCount: 1
    });

    expect(destroyLegacyRuntimeLifecycle(realm.root, "runtime")).toBe(true);
    expect(destroyLegacyRuntimeLifecycle(realm.root, "runtime")).toBe(false);
    expect(realm.timeouts.size).toBe(0);
    expect(realm.intervals.size).toBe(0);
    expect(realm.animationFrames.size).toBe(0);
    target.dispatchEvent(new Event("tick"));
    target.dispatchEvent(new Event("nested"));
    expect(callCount).toBe(1);
    expect(nestedListener).not.toHaveBeenCalled();

    captureLegacyRuntimeLifecycle(realm.root, "runtime", () => {
      target.addEventListener("tick", listener);
    });
    target.dispatchEvent(new Event("tick"));
    expect(callCount).toBe(2);
    expect(destroyLegacyRuntimeLifecycle(realm.root, "runtime")).toBe(true);
  });

  it("keeps separately owned lifecycle scopes isolated", () => {
    const realm = createRealm();
    const target = new realm.RealmEventTarget();
    const runtimeListener = vi.fn();
    const allianceListener = vi.fn();

    captureLegacyRuntimeLifecycle(realm.root, "runtime", () => {
      target.addEventListener("refresh", runtimeListener);
    });
    captureLegacyRuntimeLifecycle(realm.root, "alliance", () => {
      target.addEventListener("refresh", allianceListener);
    });

    expect(destroyLegacyRuntimeLifecycle(realm.root, "runtime")).toBe(true);
    target.dispatchEvent(new Event("refresh"));
    expect(runtimeListener).not.toHaveBeenCalled();
    expect(allianceListener).toHaveBeenCalledTimes(1);
    expect(getLegacyRuntimeLifecycleDiagnostics(realm.root, "alliance").mounted).toBe(true);
    expect(destroyLegacyRuntimeLifecycle(realm.root, "alliance")).toBe(true);
  });
});
