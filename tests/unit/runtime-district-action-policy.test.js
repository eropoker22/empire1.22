import { describe, expect, it } from "vitest";
import { resolveDistrictActions } from "../../page-assets/js/app/legacy/district-action-policy.js";

const getVisibleActions = (context = {}) => resolveDistrictActions({
  districtId: 12,
  isOwnedByCurrentPlayer: false,
  hasAdjacentOwnedDistrict: true,
  isUnoccupied: false,
  canOccupyAfterSpy: false,
  availableSpies: 1,
  isOccupying: false,
  currentTrapDistrictId: 0,
  trapMoveCooldownSeconds: 0,
  ...context
}).filter((action) => action.visible);

describe("legacy district action policy", () => {
  it("shows PvP heist next to attack and spy for adjacent enemy-owned districts", () => {
    const actions = getVisibleActions();

    expect(actions.map((action) => action.id)).toEqual(["attack", "heist", "spy"]);
    expect(actions.find((action) => action.id === "heist")).toMatchObject({
      enabled: true,
      label: "Vykrást hráče",
      reason: null
    });
  });

  it("keeps city robbery only for adjacent empty districts", () => {
    const actions = getVisibleActions({ isUnoccupied: true });

    expect(actions.map((action) => action.id)).toEqual(["rob", "spy"]);
    expect(actions.some((action) => action.id === "heist")).toBe(false);
  });

  it("does not show heist on own or non-adjacent districts", () => {
    expect(getVisibleActions({ isOwnedByCurrentPlayer: true }).some((action) => action.id === "heist")).toBe(false);
    expect(getVisibleActions({ hasAdjacentOwnedDistrict: false }).some((action) => action.id === "heist")).toBe(false);
  });
});
