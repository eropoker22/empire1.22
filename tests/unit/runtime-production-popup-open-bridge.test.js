import { describe, expect, it, vi } from "vitest";
import {
  observeProductionPopupOpening
} from "../../page-assets/js/app/runtime/productionPopupOpenBridge.js";

describe("production popup open bridge", () => {
  it("observes declined and rejected openings without leaking a rejection", async () => {
    const onOpened = vi.fn();
    const onDeclined = vi.fn();
    const onRejected = vi.fn();
    const rejection = new Error("prepare failed");

    expect(observeProductionPopupOpening(Promise.resolve(false), {
      onOpened,
      onDeclined,
      onRejected
    })).toBe(true);
    expect(observeProductionPopupOpening(Promise.reject(rejection), {
      onOpened,
      onDeclined,
      onRejected
    })).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(onDeclined).toHaveBeenCalledTimes(1);
    expect(onOpened).not.toHaveBeenCalled();
    expect(onRejected).toHaveBeenCalledTimes(1);
    expect(onRejected).toHaveBeenCalledWith(rejection);
    expect(observeProductionPopupOpening(null, { onDeclined })).toBe(false);

    expect(observeProductionPopupOpening(Promise.resolve(true), { onOpened })).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(onOpened).toHaveBeenCalledWith(true);
  });
});
