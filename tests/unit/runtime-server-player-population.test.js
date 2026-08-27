// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { renderGangMembersState } from "../../page-assets/js/app/runtime.js";
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

  it("does not replace the last confirmed population with a dash while the server slice is transiently unavailable", () => {
    document.documentElement.dataset.gameplayExecutionMode = "server-authoritative";
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.EmpireGameplaySliceClient;

    const population = document.createElement("strong");
    population.dataset.gangMembers = "";
    population.textContent = "73";
    const root = document.createElement("main");
    root.append(population);

    expect(renderGangMembersState(root)).toBe(false);
    expect(population.textContent).toBe("73");

    delete document.documentElement.dataset.gameplayExecutionMode;
  });
});
