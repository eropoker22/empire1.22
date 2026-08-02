import { describe, expect, it, vi } from "vitest";
import {
  observeProductionPopupOpening,
  openProductionPopupFromTrigger,
  registerProductionPopupOpener
} from "../../page-assets/js/app/runtime/productionPopupOpenBridge.js";

describe("production popup open bridge", () => {
  it("invokes the registered opener directly without dispatching a click", async () => {
    const trigger = { click: vi.fn() };
    const opener = vi.fn(async () => true);

    expect(registerProductionPopupOpener(trigger, opener)).toBe(true);
    await expect(openProductionPopupFromTrigger(trigger)).resolves.toBe(true);

    expect(opener).toHaveBeenCalledTimes(1);
    expect(trigger.click).not.toHaveBeenCalled();
  });

  it("returns null for invalid or unregistered triggers", () => {
    expect(registerProductionPopupOpener(null, vi.fn())).toBe(false);
    expect(registerProductionPopupOpener({}, null)).toBe(false);
    expect(openProductionPopupFromTrigger(null)).toBe(null);
    expect(openProductionPopupFromTrigger({})).toBe(null);
  });

  it("observes declined and rejected openings without leaking a rejection", async () => {
    const onDeclined = vi.fn();
    const onRejected = vi.fn();
    const rejection = new Error("prepare failed");

    expect(observeProductionPopupOpening(Promise.resolve(false), {
      onDeclined,
      onRejected
    })).toBe(true);
    expect(observeProductionPopupOpening(Promise.reject(rejection), {
      onDeclined,
      onRejected
    })).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(onDeclined).toHaveBeenCalledTimes(1);
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(onRejected).toHaveBeenCalledWith(rejection);
    expect(observeProductionPopupOpening(null, { onDeclined })).toBe(false);
  });
});
