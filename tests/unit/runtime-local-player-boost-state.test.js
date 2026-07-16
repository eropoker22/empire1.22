import { describe, expect, it } from "vitest";
import {
  activateLocalPlayerBoost,
  consumeLocalTacticalGrid,
  createEmptyLocalPlayerBoostState,
  createLocalPlayerBoostView,
  getLocalSpyBoostSnapshot,
  migrateLegacyFactoryBoostState,
  synchronizeLocalPlayerBoostSession
} from "../../page-assets/js/app/runtime/localPlayerBoostState.js";

const NOW = 1_000_000;

const createSession = (overrides = {}) => ({
  economy: { cleanMoney: 50_000 },
  inventory: {
    drugs: {
      "ghost-serum": 10,
      "pulse-shot": 10,
      "overdrive-x": 10
    },
    factorySupplies: { combatModule: 10 }
  },
  production: { jobs: {}, factory: {} },
  playerBoosts: createEmptyLocalPlayerBoostState(),
  ...overrides
});

describe("local-demo player boost state", () => {
  it("activates atomically, debits exact costs once, and blocks another active protocol", () => {
    const original = createSession();
    const activated = activateLocalPlayerBoost(original, "ghost-network", {
      now: NOW,
      commandId: "boost:ghost:1"
    });

    expect(activated).toMatchObject({ ok: true, replayed: false, boostId: "ghost-network" });
    expect(activated.session.economy.cleanMoney).toBe(45_000);
    expect(activated.session.inventory.drugs).toMatchObject({
      "ghost-serum": 8,
      "pulse-shot": 8,
      "overdrive-x": 10
    });
    expect(activated.session.playerBoosts.active).toMatchObject({
      boostId: "ghost-network",
      status: "timed",
      activatedAtMs: NOW,
      expiresAtMs: NOW + 12 * 60_000
    });
    expect(activated.session.playerBoosts.cooldownUntilMsByBoostId["ghost-network"])
      .toBe(NOW + 35 * 60_000);

    const replay = activateLocalPlayerBoost(activated.session, "ghost-network", {
      now: NOW + 100,
      commandId: "boost:ghost:1"
    });
    expect(replay).toMatchObject({ ok: true, replayed: true });
    expect(replay.session.economy.cleanMoney).toBe(45_000);
    expect(replay.session.inventory.drugs["ghost-serum"]).toBe(8);

    const blocked = activateLocalPlayerBoost(activated.session, "industrial-overdrive", {
      now: NOW + 100,
      commandId: "boost:industrial:1"
    });
    expect(blocked).toMatchObject({ ok: false, code: "boost_already_active" });
    expect(blocked.session).toEqual(activated.session);
  });

  it.each([
    ["ghost-network", "ghost-serum", { drugs: { "ghost-serum": 1, "pulse-shot": 10, "overdrive-x": 10 }, factorySupplies: { combatModule: 10 } }],
    ["ghost-network", "pulse-shot", { drugs: { "ghost-serum": 10, "pulse-shot": 1, "overdrive-x": 10 }, factorySupplies: { combatModule: 10 } }],
    ["industrial-overdrive", "overdrive-x", { drugs: { "ghost-serum": 10, "pulse-shot": 10, "overdrive-x": 1 }, factorySupplies: { combatModule: 10 } }],
    ["industrial-overdrive", "combat-module", { drugs: { "ghost-serum": 10, "pulse-shot": 10, "overdrive-x": 10 }, factorySupplies: { combatModule: 1 } }],
    ["tactical-grid", "ghost-serum", { drugs: { "ghost-serum": 1, "pulse-shot": 10, "overdrive-x": 10 }, factorySupplies: { combatModule: 10 } }],
    ["tactical-grid", "overdrive-x", { drugs: { "ghost-serum": 10, "pulse-shot": 10, "overdrive-x": 0 }, factorySupplies: { combatModule: 10 } }],
    ["tactical-grid", "combat-module", { drugs: { "ghost-serum": 10, "pulse-shot": 10, "overdrive-x": 10 }, factorySupplies: { combatModule: 2 } }]
  ])("rejects %s with missing %s without a partial debit", (boostId, resourceKey, inventory) => {
    const original = createSession({ inventory });
    const result = activateLocalPlayerBoost(original, boostId, {
      now: NOW,
      commandId: `missing:${resourceKey}`
    });
    expect(result).toMatchObject({ ok: false, code: "boost_missing_resources" });
    expect(result.session).toEqual(original);
  });

  it("rejects missing clean cash without changing inventory or cooldown", () => {
    const original = createSession({ economy: { cleanMoney: 4_999 } });
    const result = activateLocalPlayerBoost(original, "ghost-network", {
      now: NOW,
      commandId: "missing:cash"
    });
    expect(result).toMatchObject({ ok: false, code: "boost_missing_clean_cash" });
    expect(result.session).toEqual(original);
  });

  it("expires without refund, keeps the original cooldown, and allows another protocol", () => {
    const activated = activateLocalPlayerBoost(createSession(), "ghost-network", {
      now: NOW,
      commandId: "expire:ghost"
    });
    const synchronized = synchronizeLocalPlayerBoostSession(
      activated.session,
      NOW + 12 * 60_000
    );

    expect(synchronized.expired).toMatchObject({ boostId: "ghost-network" });
    expect(synchronized.session.playerBoosts.active).toBeNull();
    expect(synchronized.session.economy.cleanMoney).toBe(45_000);
    expect(synchronized.session.inventory.drugs["ghost-serum"]).toBe(8);
    expect(synchronized.session.playerBoosts.cooldownUntilMsByBoostId["ghost-network"])
      .toBe(NOW + 35 * 60_000);

    const next = activateLocalPlayerBoost(synchronized.session, "industrial-overdrive", {
      now: NOW + 12 * 60_000,
      commandId: "activate:industrial"
    });
    expect(next).toMatchObject({ ok: true, boostId: "industrial-overdrive" });
  });

  it("arms Tactical Grid, does not consume it for a snapshot, and consumes one valid combat once", () => {
    const activated = activateLocalPlayerBoost(createSession(), "tactical-grid", {
      now: NOW,
      commandId: "grid:activate"
    });
    const preview = createLocalPlayerBoostView(activated.session, NOW + 1_000);
    expect(preview.active).toMatchObject({ boostId: "tactical-grid", status: "armed" });
    expect(activated.session.playerBoosts.active).not.toBeNull();

    const consumed = consumeLocalTacticalGrid(activated.session, {
      now: NOW + 2_000,
      combatId: "combat:1",
      role: "defender"
    });
    expect(consumed).toMatchObject({ consumed: true, multiplier: 1.12 });
    expect(consumed.session.playerBoosts.active).toBeNull();
    expect(consumed.session.playerBoosts.cooldownUntilMsByBoostId["tactical-grid"])
      .toBe(NOW + 60 * 60_000);

    const duplicate = consumeLocalTacticalGrid(consumed.session, {
      now: NOW + 3_000,
      combatId: "combat:1",
      role: "defender"
    });
    expect(duplicate).toMatchObject({ consumed: false, replayed: true, multiplier: 1 });
    expect(duplicate.session).toEqual(consumed.session);
  });

  it("expires an unused Tactical Grid without refund and preserves its original cooldown", () => {
    const activated = activateLocalPlayerBoost(createSession(), "tactical-grid", {
      now: NOW,
      commandId: "grid:unused"
    });
    const synchronized = synchronizeLocalPlayerBoostSession(
      activated.session,
      NOW + 20 * 60_000
    );

    expect(synchronized.expired).toMatchObject({
      boostId: "tactical-grid",
      message: "Tactical Grid expiroval bez použití."
    });
    expect(synchronized.session.playerBoosts.active).toBeNull();
    expect(synchronized.session.playerBoosts.cooldownUntilMsByBoostId["tactical-grid"])
      .toBe(NOW + 60 * 60_000);
    expect(synchronized.session.economy.cleanMoney).toBe(40_000);
    expect(synchronized.session.inventory.drugs).toMatchObject({
      "ghost-serum": 8,
      "overdrive-x": 9
    });
    expect(synchronized.session.inventory.materials["combat-module"]).toBe(7);
    expect(synchronized.session.inventory.factorySupplies).toBeUndefined();
  });

  it("captures Ghost Network effects without mutating state", () => {
    const activated = activateLocalPlayerBoost(createSession(), "ghost-network", {
      now: NOW,
      commandId: "ghost:snapshot"
    });
    expect(getLocalSpyBoostSnapshot(activated.session, NOW + 1_000)).toEqual({
      boostId: "ghost-network",
      activatedAtMs: NOW,
      spyDurationMultiplier: 0.65,
      criticalFailureChanceMultiplier: 0.75,
      extraIntelBlocksOnSuccess: 1
    });
    expect(activated.session.playerBoosts.active?.boostId).toBe("ghost-network");
  });

  it("migrates an old Assault snapshot once without refund or replacement boost", () => {
    const legacy = createSession({
      playerBoosts: undefined,
      production: {
        jobs: {},
        factory: {
          boosts: {
            active: {
              id: "assault",
              expiresAtMs: NOW + 10_000,
              inputCosts: { "combat-module": 2 }
            }
          }
        }
      }
    });
    const first = migrateLegacyFactoryBoostState(legacy);
    expect(first.migrated).toBe(true);
    expect(first.session.playerBoosts).toMatchObject({ version: 1, active: null });
    expect(first.session.production.factory).toBeUndefined();
    expect(first.session.economy.cleanMoney).toBe(50_000);
    expect(first.session.inventory.factorySupplies.combatModule).toBe(10);

    const second = migrateLegacyFactoryBoostState(first.session);
    expect(second.migrated).toBe(false);
    expect(second.session).toEqual(first.session);
  });
});
