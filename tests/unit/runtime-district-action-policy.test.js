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
  isSpying: false,
  isRobbing: false,
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

  it("keeps server-authoritative map actions clickable for the server to validate", () => {
    const actions = getVisibleActions({
      serverAuthoritative: true,
      isOwnedByCurrentPlayer: true,
      hasAdjacentOwnedDistrict: false,
      availableSpies: 0
    });

    expect(actions.map((action) => action.id)).toEqual(["trap", "attack", "heist", "occupy", "rob", "spy"]);
    expect(actions.every((action) => action.enabled)).toBe(true);
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

  it("disables city robbery while the player is spying on the same district", () => {
    const rob = getVisibleActions({ isUnoccupied: true, isSpying: true })
      .find((action) => action.id === "rob");

    expect(rob).toMatchObject({
      visible: true,
      enabled: false,
      reason: "District 12 právě špehuješ. Vykrást ho lze až po návratu špeha."
    });
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

  it("prioritizes an active robbery over the no-spies message", () => {
    const spy = getVisibleActions({ availableSpies: 0, isUnoccupied: true, isRobbing: true })
      .find((action) => action.id === "spy");

    expect(spy).toMatchObject({
      visible: true,
      enabled: false,
      stacked: true,
      subtitle: "Probíhá krádež",
      disabledTone: "no-spies",
      reason: "District 12 právě vykrádáš. Špehování lze spustit až po dokončení vykradení."
    });
  });

  it("keeps neutral districts on occupy and city robbery after successful spy intel", () => {
    const actions = getVisibleActions({ isUnoccupied: true, canOccupyAfterSpy: true });

    expect(actions.map((action) => action.id)).toEqual(["occupy", "rob"]);
  });

  it("blocks occupying a neutral district while its robbery is in progress", () => {
    const occupy = getVisibleActions({ isUnoccupied: true, canOccupyAfterSpy: true, isRobbing: true })
      .find((action) => action.id === "occupy");

    expect(occupy).toMatchObject({
      visible: true,
      enabled: false,
      stacked: true,
      subtitle: "Teď ne",
      disabledTone: "robbery"
    });
  });

  it("blocks a second occupation while another occupation is active", () => {
    const occupy = getVisibleActions({ isUnoccupied: true, canOccupyAfterSpy: true, hasActiveOccupation: true })
      .find((action) => action.id === "occupy");

    expect(occupy).toMatchObject({
      visible: true,
      enabled: false,
      stacked: true,
      subtitle: "Přijď později",
      disabledTone: "occupation"
    });
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
