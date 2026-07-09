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

  it("keeps enemy-owned districts on attack and heist after successful spy intel", () => {
    const actions = getVisibleActions({ canOccupyAfterSpy: true });

    expect(actions.map((action) => action.id)).toEqual(["attack", "heist"]);
    expect(actions.some((action) => action.id === "occupy")).toBe(false);
  });

  it("keeps city robbery only for adjacent empty districts", () => {
    const actions = getVisibleActions({ isUnoccupied: true });

    expect(actions.map((action) => action.id)).toEqual(["rob", "spy"]);
    expect(actions.some((action) => action.id === "heist")).toBe(false);
  });

  it("keeps spy visible but disabled when all spies are deployed", () => {
    const actions = getVisibleActions({ availableSpies: 0 });
    const spy = actions.find((action) => action.id === "spy");

    expect(spy).toMatchObject({
      visible: true,
      enabled: false,
      label: "Špehovat",
      stacked: true,
      subtitle: "Žádní špehové",
      disabledTone: "no-spies",
      reason: null
    });
  });

  it("keeps neutral districts on occupy and city robbery after successful spy intel", () => {
    const actions = getVisibleActions({ isUnoccupied: true, canOccupyAfterSpy: true });

    expect(actions.map((action) => action.id)).toEqual(["occupy", "rob"]);
  });

  it("does not show heist on own or non-adjacent districts", () => {
    expect(getVisibleActions({ isOwnedByCurrentPlayer: true }).some((action) => action.id === "heist")).toBe(false);
    expect(getVisibleActions({ hasAdjacentOwnedDistrict: false }).some((action) => action.id === "heist")).toBe(false);
  });

  it("hides every district action while occupation cooldown is running", () => {
    const actions = resolveDistrictActions({
      districtId: 12,
      isOwnedByCurrentPlayer: false,
      hasAdjacentOwnedDistrict: true,
      isUnoccupied: true,
      canOccupyAfterSpy: true,
      availableSpies: 1,
      isOccupying: true,
      currentTrapDistrictId: 0,
      trapMoveCooldownSeconds: 0
    });

    expect(actions.every((action) => action.visible === false && action.enabled === false)).toBe(true);
    expect(actions.every((action) => action.reason === "District 12 je obsazován.")).toBe(true);
  });

  it("locks downtown occupation until final lockdown without hiding other available actions", () => {
    const actions = resolveDistrictActions({
      districtId: 79,
      isOwnedByCurrentPlayer: false,
      hasAdjacentOwnedDistrict: true,
      isUnoccupied: true,
      canOccupyAfterSpy: true,
      availableSpies: 1,
      isOccupying: false,
      isDowntownOccupationLocked: true,
      currentTrapDistrictId: 0,
      trapMoveCooldownSeconds: 0
    });
    const visibleActions = actions.filter((action) => action.visible);

    expect(visibleActions.map((action) => action.id)).toEqual(["rob"]);
    expect(actions.find((action) => action.id === "occupy")).toMatchObject({
      visible: false,
      enabled: false,
      reason: "Downtown districty lze obsazovat až ve final lockdown fázi."
    });
  });
});
