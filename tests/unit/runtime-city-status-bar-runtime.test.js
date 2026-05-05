import { describe, expect, it, vi } from "vitest";
import {
  buildCityStatusViewModel,
  createCityStatusBarRuntime,
  getMapPhaseFromCityMinutes,
  renderCityStatusBar
} from "../../page-assets/js/app/runtime/cityStatusBarRuntime.js";

function createElement() {
  const listeners = new Map();

  return {
    dataset: {},
    textContent: "",
    addEventListener: vi.fn((type, listener) => {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    }),
    dispatch(type) {
      for (const listener of listeners.get(type) || []) {
        listener({ type });
      }
    }
  };
}

function createRoot(elements) {
  return {
    querySelector: vi.fn((selector) => elements[selector] || null)
  };
}

describe("city status bar runtime", () => {
  it("builds read-only phase labels without mutating gameplay state", () => {
    const phaseState = {
      cityMinutes: 23 * 60 + 9,
      gamePhase: "launch",
      mapPhase: "night"
    };

    const viewModel = buildCityStatusViewModel(phaseState);

    expect(viewModel).toMatchObject({
      clockLabel: "23:09",
      dayPhaseLabel: "NOC",
      gamePhaseLabel: "DEV-ONLY",
      productionLabel: "-8 % noční směna",
      statusLabel: "Město nespí"
    });
    expect(phaseState).toEqual({
      cityMinutes: 1389,
      gamePhase: "launch",
      mapPhase: "night"
    });
    expect(getMapPhaseFromCityMinutes(7 * 60)).toBe("day");
    expect(getMapPhaseFromCityMinutes(21 * 60)).toBe("night");
  });

  it("renders labels and returns false when required DOM is missing", () => {
    const elements = {
      clock: createElement(),
      dayPhase: createElement(),
      gamePhase: createElement(),
      status: createElement(),
      production: createElement()
    };

    expect(renderCityStatusBar({
      clockLabel: "08:15",
      dayPhaseLabel: "DEN",
      gamePhaseLabel: "LIVE",
      statusLabel: "Klid před bouří",
      productionLabel: "+12 % denní směna"
    }, elements)).toBe(true);
    expect(elements.clock.textContent).toBe("08:15");
    expect(elements.dayPhase.textContent).toBe("DEN");
    expect(elements.gamePhase.textContent).toBe("LIVE");
    expect(elements.status.textContent).toBe("Klid před bouří");
    expect(elements.production.textContent).toBe("+12 % denní směna");
    expect(renderCityStatusBar({}, { clock: elements.clock })).toBe(false);
  });

  it("binds the city status shell and delegates tick/game-phase side effects to runtime callbacks", () => {
    const timers = [];
    const windowRef = {
      addEventListener: vi.fn(),
      clearInterval: vi.fn(),
      setInterval: vi.fn((listener, delay) => {
        timers.push({ listener, delay });
        return 42;
      })
    };
    const elements = {
      "#phase": createElement(),
      "#clock": createElement(),
      "#day": createElement(),
      "#game": createElement(),
      "#status": createElement(),
      "#production": createElement()
    };
    const onInitialSync = vi.fn();
    const onTick = vi.fn();
    const onGamePhaseChange = vi.fn();
    const runtime = createCityStatusBarRuntime({
      minuteStep: 3,
      onGamePhaseChange,
      onInitialSync,
      onTick,
      selectors: {
        clock: "#clock",
        dayPhase: "#day",
        gamePhase: "#game",
        phaseHost: "#phase",
        production: "#production",
        status: "#status"
      },
      syncPhaseHostFromAuthority: vi.fn(() => ({
        cityMinutes: 6 * 60 + 5,
        gamePhase: "live",
        mapPhase: "day"
      })),
      tickMs: 250,
      windowRef
    });

    expect(runtime.bindCityStatusBar(createRoot(elements))).toBe(true);
    expect(elements["#clock"].textContent).toBe("06:05");
    expect(elements["#day"].textContent).toBe("DEN");
    expect(onInitialSync).toHaveBeenCalledWith(expect.objectContaining({
      phaseHost: elements["#phase"],
      updatePhaseStatus: expect.any(Function)
    }));
    expect(windowRef.setInterval).toHaveBeenCalledWith(expect.any(Function), 250);

    timers[0].listener();
    expect(onTick).toHaveBeenCalledWith(expect.objectContaining({
      getMapPhaseFromClock: expect.any(Function),
      minuteStep: 3,
      phaseHost: elements["#phase"],
      updatePhaseStatus: expect.any(Function)
    }));

    elements["#phase"].dispatch("gamephasechange");
    expect(onGamePhaseChange).toHaveBeenCalledWith(expect.objectContaining({
      phaseHost: elements["#phase"],
      updatePhaseStatus: expect.any(Function)
    }));
  });

  it("does not crash when the city status DOM is missing", () => {
    const runtime = createCityStatusBarRuntime({
      selectors: { phaseHost: "#phase" },
      windowRef: {
        addEventListener: vi.fn(),
        setInterval: vi.fn()
      }
    });

    expect(runtime.bindCityStatusBar(createRoot({}))).toBe(false);
    expect(runtime.bindCityStatusBar(null)).toBe(false);
  });
});
