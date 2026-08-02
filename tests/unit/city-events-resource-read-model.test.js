import { describe, expect, it } from "vitest";
import {
  resolveCityEventNextRefreshLabel,
  resolveCityEventsPlayerInfluence,
  resolveServerCityEventSchedule
} from "../../page-assets/js/app/city-events-runtime.js";

describe("City Events resource read model", () => {
  it("uses the authoritative economy value instead of preview or DOM fallbacks", () => {
    expect(resolveCityEventsPlayerInfluence({
      executionMode: "server-authoritative",
      readModel: {
        player: {
          economy: {
            influence: 0.6
          }
        }
      },
      storedInfluence: 99,
      resolvedInfluence: 77,
      domInfluenceValues: ["55"]
    })).toBe(0);
  });

  it("fails closed when the authoritative economy projection is missing", () => {
    expect(resolveCityEventsPlayerInfluence({
      executionMode: "server-authoritative",
      readModel: null,
      storedInfluence: 99,
      domInfluenceValues: ["55"]
    })).toBe(0);
  });

  it("preserves explicit zero influence for local demo state", () => {
    expect(resolveCityEventsPlayerInfluence({
      executionMode: "local-demo",
      storedInfluence: 0,
      resolvedInfluence: 12,
      domInfluenceValues: ["15"]
    })).toBe(0);
  });

  it("uses the same compact next-refresh label for demo and hosted city time", () => {
    expect(resolveCityEventNextRefreshLabel("victor", 18 * 60)).toBe("22:00");
    expect(resolveCityEventNextRefreshLabel("victor", 22 * 60 + 14)).toBe("02:00");
    expect(resolveCityEventNextRefreshLabel("nira", 6 * 60 + 1)).toBe("14:00");
    expect(resolveCityEventNextRefreshLabel("missing", 0)).toBe("-");
  });

  it("derives the compact hosted refresh time from authoritative schedule tokens", () => {
    expect(resolveServerCityEventSchedule("victor", {
      scheduleLabel: "18:00–04:00 · nové nabídky 18:00 / 22:00 / 02:00",
      nextRefreshAtTick: 4321
    }, 6 * 60 + 10)).toEqual({
      nextBoundaryLabel: "18:00",
      nextRefreshAtTick: 4321
    });
    expect(resolveServerCityEventSchedule("victor", {
      scheduleLabel: "18:00–04:00 · nové nabídky 18:00 / 22:00 / 02:00",
      nextRefreshAtTick: 4321
    }, 18 * 60)).toEqual({
      nextBoundaryLabel: "22:00",
      nextRefreshAtTick: 4321
    });
    expect(resolveServerCityEventSchedule("nyra", {
      scheduleLabel: "Intel pulse 06:00 / 14:00 / 22:00",
      nextRefreshAtTick: 9876
    }, 14 * 60 + 1)).toEqual({
      nextBoundaryLabel: "22:00",
      nextRefreshAtTick: 9876
    });
    expect(resolveServerCityEventSchedule("victor", {
      scheduleLabel: "SERVEROVÝ PLÁN",
      nextRefreshAtTick: 4321
    }, 18 * 60)).toEqual({
      nextBoundaryLabel: "22:00",
      nextRefreshAtTick: 4321
    });
    expect(resolveServerCityEventSchedule("victor", null, 18 * 60)).toEqual({
      nextBoundaryLabel: "22:00",
      nextRefreshAtTick: null
    });
    expect(resolveServerCityEventSchedule("victor", {
      scheduleLabel: "",
      nextRefreshAtTick: null
    }, 18 * 60)).toEqual({
      nextBoundaryLabel: "22:00",
      nextRefreshAtTick: null
    });
  });
});
