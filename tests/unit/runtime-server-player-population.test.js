import { describe, expect, it } from "vitest";
import { resolveServerPlayerPopulation } from "../../page-assets/js/app/runtime/serverPlayerPopulation.js";

describe("server player population", () => {
  it("prefers the canonical economy population", () => {
    expect(resolveServerPlayerPopulation({
      economy: { population: 73, gangMembers: 61 },
      resourceBalances: { population: 52 }
    })).toBe(73);
  });

  it("keeps the gang panel available when an older slice only exposes resource balances", () => {
    expect(resolveServerPlayerPopulation({
      resourceBalances: { population: 42 }
    })).toBe(42);
  });

  it("does not fabricate unavailable population", () => {
    expect(resolveServerPlayerPopulation({ resourceBalances: {} })).toBeNull();
  });
});
