import { describe, expect, it, vi } from "vitest";

import {
  bindSharedCountdown,
  getSharedCountdownDiagnostics
} from "../../page-assets/js/app/ui/sharedCountdownTicker.js";

describe("shared production countdown ticker", () => {
  it("uses one interval and releases disconnected or hidden bindings", () => {
    const callbacks = new Map();
    let nextTimerId = 1;
    const timerApi = {
      document: { hidden: false },
      setInterval: vi.fn((callback) => {
        const timerId = nextTimerId++;
        callbacks.set(timerId, callback);
        return timerId;
      }),
      clearInterval: vi.fn((timerId) => callbacks.delete(timerId))
    };
    const first = {
      isConnected: true,
      ownerDocument: { defaultView: timerApi },
      closest: () => null,
      textContent: ""
    };
    const second = {
      isConnected: true,
      ownerDocument: { defaultView: timerApi },
      closest: () => null,
      textContent: ""
    };

    bindSharedCountdown(first, () => "00:10");
    bindSharedCountdown(second, () => "00:20");

    expect(timerApi.setInterval).toHaveBeenCalledTimes(1);
    expect(getSharedCountdownDiagnostics()).toEqual({ bindingCount: 2, hasActiveTicker: true });
    callbacks.values().next().value();
    expect(first.textContent).toBe("00:10");
    expect(second.textContent).toBe("00:20");

    first.isConnected = false;
    second.closest = () => ({ hidden: true });
    callbacks.values().next().value();

    expect(timerApi.clearInterval).toHaveBeenCalledTimes(1);
    expect(getSharedCountdownDiagnostics()).toEqual({ bindingCount: 0, hasActiveTicker: false });
  });

  it("replaces repeated bindings for one element without growing the ticker", () => {
    const callbacks = new Map();
    const timerApi = {
      document: { hidden: false },
      setInterval: vi.fn((callback) => {
        callbacks.set(1, callback);
        return 1;
      }),
      clearInterval: vi.fn((timerId) => callbacks.delete(timerId))
    };
    const element = {
      isConnected: true,
      ownerDocument: { defaultView: timerApi },
      closest: () => null,
      textContent: ""
    };

    const firstCleanup = bindSharedCountdown(element, () => "00:10");
    const secondCleanup = bindSharedCountdown(element, () => "00:09");

    expect(timerApi.setInterval).toHaveBeenCalledTimes(1);
    expect(getSharedCountdownDiagnostics()).toEqual({ bindingCount: 1, hasActiveTicker: true });
    expect(element.textContent).toBe("00:09");

    firstCleanup();
    expect(getSharedCountdownDiagnostics()).toEqual({ bindingCount: 1, hasActiveTicker: true });
    secondCleanup();
    expect(getSharedCountdownDiagnostics()).toEqual({ bindingCount: 0, hasActiveTicker: false });
  });
});
