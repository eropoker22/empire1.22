import { describe, expect, it, vi } from "vitest";
import {
  createPhaseToggleRuntime,
  getBorderColorToggleLabel,
  getGamePhaseToggleLabel,
  getMapPhaseToggleLabel,
  normalizeBorderColor
} from "../../page-assets/js/app/runtime/phaseToggleRuntime.js";

function createElement() {
  const listeners = new Map();

  return {
    dataset: {},
    disabled: false,
    hidden: false,
    textContent: "",
    title: "",
    addEventListener: vi.fn((type, listener) => {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    }),
    setAttribute: vi.fn(),
    dispatch(type) {
      for (const listener of listeners.get(type) || []) {
        listener({ type });
      }
    },
    dispatchEvent: vi.fn()
  };
}

function createRoot(elements) {
  return {
    querySelector: vi.fn((selector) => elements[selector] || null)
  };
}

function createRuntime(overrides = {}) {
  return createPhaseToggleRuntime({
    getResolvedPhaseState: () => ({ gamePhase: "launch" }),
    selectors: {
      borderToggle: "#border",
      gamePhaseToggle: "#game",
      mapPhaseToggle: "#map",
      phaseHost: "#phase"
    },
    syncPhaseHostFromAuthority: () => ({
      gamePhase: "launch",
      mapPhase: "night"
    }),
    ...overrides
  });
}

describe("phase toggle runtime", () => {
  it("keeps phase and border labels stable", () => {
    expect(getMapPhaseToggleLabel({ mapPhase: "day" })).toBe("Fáze: DEN");
    expect(getMapPhaseToggleLabel({ mapPhase: "night" })).toBe("Fáze: NOC");
    expect(getGamePhaseToggleLabel({ gamePhase: "launch" })).toBe("Fáze hry: ONBOARDING");
    expect(getGamePhaseToggleLabel({ gamePhase: "live" })).toBe("Fáze hry: LIVE");
    expect(normalizeBorderColor("bad")).toBe("white");
    expect(normalizeBorderColor("black")).toBe("black");
    expect(normalizeBorderColor("red")).toBe("black");
    expect(getBorderColorToggleLabel("black")).toBe("HRANY");
  });

  it("binds map phase as disabled authority-controlled UI", () => {
    const phaseHost = createElement();
    const mapToggle = createElement();
    const runtime = createRuntime();

    expect(runtime.bindMapPhaseToggle(createRoot({
      "#map": mapToggle,
      "#phase": phaseHost
    }))).toBe(true);

    expect(mapToggle.textContent).toBe("Fáze: NOC");
    expect(mapToggle.disabled).toBe(true);
    expect(mapToggle.title).toBe("Fáze se nyní řídí autoritativním backend stavem.");
  });

  it("delegates border toggle event dispatch through runtime callback", () => {
    const phaseHost = createElement();
    const borderToggle = createElement();
    const onBorderColorChange = vi.fn();
    const runtime = createRuntime({ onBorderColorChange });

    expect(runtime.bindBorderColorToggle(createRoot({
      "#border": borderToggle,
      "#phase": phaseHost
    }))).toBe(true);
    expect(borderToggle.textContent).toBe("HRANY");
    expect(borderToggle.dataset.borderColor).toBe("white");

    borderToggle.dispatch("click");

    expect(phaseHost.dataset.borderColor).toBe("black");
    expect(borderToggle.textContent).toBe("HRANY");
    expect(borderToggle.dataset.borderColor).toBe("black");
    expect(borderToggle.title).toBe("Hrany districtů jsou černé");
    expect(onBorderColorChange).toHaveBeenCalledWith({
      borderColor: "black",
      mapPhaseHost: phaseHost
    });
  });

  it("keeps game phase toggle hidden and non-interactive", () => {
    const phaseHost = createElement();
    const gameToggle = createElement();
    const onGamePhaseToggle = vi.fn(({ updateGamePhaseLabel }) => {
      updateGamePhaseLabel();
    });
    const runtime = createRuntime({ onGamePhaseToggle });

    expect(runtime.bindGamePhaseToggle(createRoot({
      "#game": gameToggle,
      "#phase": phaseHost
    }))).toBe(true);
    expect(gameToggle.textContent).toBe("Fáze hry: ONBOARDING");
    expect(gameToggle.disabled).toBe(true);
    expect(gameToggle.hidden).toBe(true);
    expect(gameToggle.setAttribute).toHaveBeenCalledWith("aria-hidden", "true");

    gameToggle.dispatch("click");

    expect(onGamePhaseToggle).not.toHaveBeenCalled();
  });

  it("handles missing toggle DOM without crashing", () => {
    const runtime = createRuntime();
    const emptyRoot = createRoot({});

    expect(runtime.bindMapPhaseToggle(emptyRoot)).toBe(false);
    expect(runtime.bindBorderColorToggle(emptyRoot)).toBe(false);
    expect(runtime.bindGamePhaseToggle(emptyRoot)).toBe(false);
    expect(runtime.bindGamePhaseToggle(null)).toBe(false);
  });
});
