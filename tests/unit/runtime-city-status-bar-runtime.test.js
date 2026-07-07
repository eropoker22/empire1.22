import { describe, expect, it, vi } from "vitest";
import {
  buildCityStatusViewModel,
  createCityStatusBarRuntime,
  getMapPhaseFromCityMinutes,
  renderCityStatusBar
} from "../../page-assets/js/app/runtime/cityStatusBarRuntime.js";

function createElement() {
  const listeners = new Map();
  const classNames = new Set();

  return {
    classList: {
      add: vi.fn((...names) => names.forEach((name) => classNames.add(name))),
      contains: (name) => classNames.has(name),
      remove: vi.fn((...names) => names.forEach((name) => classNames.delete(name)))
    },
    dataset: {},
    tagName: "STRONG",
    textContent: "",
    addEventListener: vi.fn((type, listener) => {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    }),
    closest: vi.fn(() => null),
    dispatch(type) {
      for (const listener of listeners.get(type) || []) {
        listener({ type });
      }
    },
    dispatchEvent: vi.fn((event) => {
      for (const listener of listeners.get(event?.type) || []) {
        listener(event);
      }
      return true;
    }),
    setAttribute: vi.fn()
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
      dayPhaseLabel: "čeká se",
      gamePhaseLabel: "SAFE",
      productionLabel: "Očista",
      statusLabel: "20/20"
    });
    expect(viewModel.gamePhaseLabel).not.toBe("DEV-ONLY");
    expect(phaseState).toEqual({
      cityMinutes: 1389,
      gamePhase: "launch",
      mapPhase: "night"
    });
    expect(getMapPhaseFromCityMinutes(7 * 60)).toBe("day");
    expect(getMapPhaseFromCityMinutes(0)).toBe("night");
    expect(getMapPhaseFromCityMinutes(18 * 60)).toBe("night");
    expect(getMapPhaseFromCityMinutes(21 * 60)).toBe("night");
  });

  it("defaults the refreshed game shell clock to 05:55", () => {
    expect(buildCityStatusViewModel()).toMatchObject({
      clockLabel: "05:55",
      mapPhase: "night"
    });
  });

  it("keeps midnight as a valid night clock value", () => {
    expect(buildCityStatusViewModel({ cityMinutes: 0 })).toMatchObject({
      clockLabel: "00:00",
      mapPhase: "night"
    });
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
      dayPhaseLabel: "za 42m",
      gamePhaseLabel: "DANGER",
      statusLabel: "18/20",
      productionLabel: "Očista"
    }, elements)).toBe(true);
    expect(elements.clock.textContent).toBe("08:15");
    expect(elements.dayPhase.textContent).toBe("za 42m");
    expect(elements.gamePhase.textContent).toBe("DANGER");
    expect(elements.status.textContent).toBe("18/20");
    expect(elements.production.textContent).toBe("Očista");
    expect(renderCityStatusBar({}, { clock: elements.clock })).toBe(false);
  });

  it("maps elimination and final lockdown read models into Free BR bar labels", () => {
    expect(buildCityStatusViewModel({ cityMinutes: 22 * 60 + 37 }, {
      playerView: {
        elimination: {
          activePlayersRemaining: 18,
          currentPlayerStatus: "danger",
          ticksUntilNextElimination: 42
        }
      }
    })).toMatchObject({
      clockLabel: "22:37",
      dayPhaseTitle: "Očista",
      dayPhaseLabel: "za 42m",
      gamePhaseLabel: "DANGER",
      statusLabel: "18/20"
    });

    expect(buildCityStatusViewModel({ cityMinutes: 22 * 60 + 37 }, {
      playerView: {
        finalLockdown: {
          active: true,
          enabled: true,
          remainingActiveTicks: 462,
          currentPlayerRank: 4,
          currentPlayerFinalScore: 12000,
          leaderboardTop3: [{ score: 51000 }, { score: 50000 }, { score: 49000 }],
          topRankCount: 3
        }
      }
    })).toMatchObject({
      dayPhaseTitle: "Finále",
      dayPhaseLabel: "7h 42m zbývá",
      gamePhaseLabel: "#4",
      statusTitle: "Top 3",
      statusLabel: "+37k",
      cityStatusMode: "final"
    });
  });

  it("uses core day night read model for clock and map phase when present", () => {
    expect(buildCityStatusViewModel({ cityMinutes: 23 * 60 + 9, mapPhase: "night" }, {
      playerView: {
        dayNight: {
          phaseId: "day",
          uiThemeHint: "day",
          gameClockLabel: "09:42"
        }
      }
    })).toMatchObject({
      clockLabel: "09:42",
      mapPhase: "day"
    });
  });

  it("keeps core day/night phase authoritative without bouncing legacy phase events", () => {
    const documentListeners = new Map();
    const elements = {
      "#phase": createElement(),
      "#clock": createElement(),
      "#day": createElement(),
      "#game": createElement(),
      "#status": createElement(),
      "#production": createElement()
    };
    const ownerDocument = {
      addEventListener: vi.fn((type, listener) => {
        documentListeners.set(type, [...(documentListeners.get(type) || []), listener]);
      }),
      removeEventListener: vi.fn(),
      defaultView: {
        CustomEvent: class {
          constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail;
          }
        }
      }
    };
    for (const element of Object.values(elements)) {
      element.ownerDocument = ownerDocument;
    }

    const syncPhaseHostFromAuthority = vi.fn((phaseHost) => {
      const nextMapPhase = phaseHost.dataset.coreMapPhase === "day" || phaseHost.dataset.coreMapPhase === "night"
        ? phaseHost.dataset.coreMapPhase
        : "night";
      if (phaseHost.dataset.mapPhase !== nextMapPhase) {
        phaseHost.dataset.mapPhase = nextMapPhase;
        phaseHost.dispatchEvent({ type: "mapphasechange", detail: { phase: nextMapPhase } });
      }
      return {
        cityMinutes: 23 * 60,
        gamePhase: "live",
        mapPhase: nextMapPhase
      };
    });
    const runtime = createCityStatusBarRuntime({
      selectors: {
        clock: "#clock",
        dayPhase: "#day",
        gamePhase: "#game",
        phaseHost: "#phase",
        production: "#production",
        status: "#status"
      },
      syncPhaseHostFromAuthority,
      windowRef: {
        addEventListener: vi.fn(),
        setInterval: vi.fn()
      }
    });

    const root = {
      ...createRoot(elements),
      ownerDocument
    };

    expect(runtime.bindCityStatusBar(root)).toBe(true);
    for (const listener of documentListeners.get("empire:gameplay-slice-rendered") || []) {
      listener({
        detail: {
          gameplaySlice: {
            player: {
              dayNight: {
                phaseId: "day",
                uiThemeHint: "day",
                gameClockLabel: "09:42"
              }
            }
          }
        }
      });
    }

    expect(elements["#phase"].dataset.coreMapPhase).toBe("day");
    expect(elements["#phase"].dataset.mapPhase).toBe("day");
    expect(elements["#clock"].textContent).toBe("09:42");
    expect(syncPhaseHostFromAuthority.mock.calls.length).toBeLessThan(8);
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
    expect(elements["#day"].textContent).toBe("čeká se");
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
