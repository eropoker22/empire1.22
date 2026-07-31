import { describe, expect, it } from "vitest";
import { resolveCityEventsPlayerInfluence } from "../../page-assets/js/app/city-events-runtime.js";

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
});
