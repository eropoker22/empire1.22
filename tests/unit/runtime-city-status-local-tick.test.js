/* @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { createCityStatusBarRuntime } from "../../page-assets/js/app/runtime/cityStatusBarRuntime.js";

describe("city status local tick", () => {
  it("stops its timer when runtime switches to server-authoritative", () => {
    document.body.innerHTML = `
      <main id="root">
        <div data-phase></div>
        <span data-clock></span>
        <span data-day></span>
        <span data-game></span>
        <span data-status></span>
        <button data-production></button>
      </main>
    `;
    const root = document.getElementById("root");
    let localTickAllowed = true;
    let intervalCallback = null;
    const setInterval = vi.fn((callback) => {
      intervalCallback = callback;
      return 17;
    });
    const clearInterval = vi.fn();
    const activeChanges = [];
    const windowRef = {
      setInterval,
      clearInterval,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    const runtime = createCityStatusBarRuntime({
      windowRef,
      tickMs: 10_000,
      minuteStep: 1,
      shouldRunLocalTick: () => localTickAllowed,
      getTickIntervalMs: (value) => value * 3,
      onLocalTickActiveChange: (active) => activeChanges.push(active),
      syncPhaseHostFromAuthority: () => ({ cityMinutes: 360, mapPhase: "day", gamePhase: "live" }),
      selectors: {
        phaseHost: "[data-phase]",
        clock: "[data-clock]",
        dayPhase: "[data-day]",
        gamePhase: "[data-game]",
        status: "[data-status]",
        production: "[data-production]"
      }
    });

    expect(runtime.bindCityStatusBar(root)).toBe(true);
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30_000);
    expect(activeChanges).toEqual([true]);
    expect(intervalCallback).toBeTypeOf("function");

    localTickAllowed = false;
    document.dispatchEvent(new CustomEvent("empire:runtime-mode-changed"));

    expect(clearInterval).toHaveBeenCalledWith(17);
    expect(activeChanges).toEqual([true, false]);
  });
});

