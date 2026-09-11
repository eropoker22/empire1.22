// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { clearServerGameplaySliceReadModel } from "../../page-assets/js/app/runtime/serverGameplayReadModelSource.js";

let bindDistrictCanvas;
beforeAll(async () => {
  ({ bindDistrictCanvas } = await import("../../page-assets/js/app/runtime.js"));
}, 30_000);
afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  clearServerGameplaySliceReadModel();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  delete window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__;
});

describe("game.html map rendering visibility", () => {
  it.each([false, true])("pauses actual runtime canvas work offscreen and redraws after returning (mission: %s)", (activeMission) => {
    const html = readFileSync("pages/game.html", "utf8");
    document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];
    window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = "server-authoritative";
    let now = 100_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const slice = {
      server: { status: "running", serverInstanceId: "instance:1", stateVersion: 1 },
      player: { playerId: "player:1", instanceId: "instance:1", color: "#67e1ff", dayNight: { uiThemeHint: "day" } },
      districts: [], reports: [],
      mapEffects: activeMission ? [{ type: "attack-district", districtId: "district:1", startedAt: now - 5_000, expiresAt: now + 30_000 }] : []
    };
    vi.stubGlobal("EmpireGameplaySliceClient", { getCurrentReadModel: () => slice });
    vi.stubGlobal("empireStreetsPerformanceMetrics", {});
    vi.spyOn(window, "matchMedia").mockImplementation(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const draw = vi.fn();
    const context = new Proxy({
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
      measureText: () => ({ width: 20 })
    }, { get: (target, key) => key in target ? target[key] : draw, set: (target, key, value) => { target[key] = value; return true; } });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 490, width: 800, height: 490 });
    const frames = new Map();
    let nextId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { frames.set(++nextId, callback); return nextId; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => frames.delete(id));
    let notify;
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback) { notify = callback; }
      observe() {}
      disconnect = disconnect;
    });
    bindDistrictCanvas(document.querySelector("#game-root"));
    expect(draw).toHaveBeenCalled();
    if (activeMission) expect(window.empireStreetsPerformanceMetrics.mapEffectRendersPerMinute).toBeGreaterThan(0);
    const viewport = document.querySelector("[data-map-viewport]");
    notify?.([{ target: viewport, isIntersecting: false }]);
    draw.mockClear();
    document.dispatchEvent(new CustomEvent("empire:map-invalidate", { detail: { reason: "state-change" } }));
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(100); }
    expect(draw).not.toHaveBeenCalled();
    // Returning from a background tab must not wake a still-offscreen map.
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(200); }
    expect(draw).not.toHaveBeenCalled();
    notify([{ target: viewport, isIntersecting: true }]);
    expect(draw).toHaveBeenCalled();
    draw.mockClear();
    notify([{ target: viewport, isIntersecting: true }]);
    expect(draw).not.toHaveBeenCalled();
    if (activeMission) {
      // An elapsed operation must not leave a permanent RAF loop, and the
      // original authoritative marker remains available until a fresh slice.
      now += 31_000;
      for (const [id, callback] of [...frames]) { frames.delete(id); callback(31_000); }
      for (const [id, callback] of [...frames]) { frames.delete(id); callback(31_100); }
      expect(frames.size).toBe(0);
      expect(slice.mapEffects).toHaveLength(1);
    }
    window.dispatchEvent(new Event("pagehide"));
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
