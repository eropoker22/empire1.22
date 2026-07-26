// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createServerGameplayStatusController
} from "../../page-assets/js/app/ui/serverGameplayStatusController.js";
import {
  createServerGameplayStatusView
} from "../../page-assets/js/app/ui/serverGameplayStatusViewModel.js";

describe("server gameplay status controller", () => {
  beforeEach(() => {
    document.body.innerHTML = createFixture();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("derives gang and city labels only from the authoritative read model", () => {
    expect(createServerGameplayStatusView(createReadModel())).toMatchObject({
      gangMembers: "14",
      factionLabel: "Hackeři",
      districtCount: "1",
      allianceLabel: "Night Shift",
      city: {
        clockLabel: "21:35",
        statusLabel: "7/20"
      }
    });
  });

  it("mounts once and skips equivalent polling models", () => {
    const controller = createServerGameplayStatusController({
      root: document.querySelector("#game-root"),
      documentRef: document
    });
    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    expect(controller.update(createReadModel())).toBeGreaterThan(0);
    expect(document.querySelector("[data-gang-members]").textContent).toBe("14");
    expect(document.querySelector("[data-city-clock]").textContent).toBe("21:35");
    expect(document.querySelector("[data-city-status]").textContent).toBe("7/20");

    const renders = controller.getDiagnostics().renders;
    expect(controller.update(structuredClone(createReadModel()))).toBe(0);
    expect(controller.getDiagnostics().renders).toBe(renders);
  });

  it("updates only changed status fields and cleans up idempotently", () => {
    const controller = createServerGameplayStatusController({
      root: document.querySelector("#game-root"),
      documentRef: document
    });
    controller.mount();
    controller.update(createReadModel());
    const changed = createReadModel();
    changed.player.economy.gangMembers = 15;

    expect(controller.update(changed)).toBe(1);
    expect(document.querySelector("[data-gang-members]").textContent).toBe("15");
    expect(document.querySelector("[data-city-clock]").textContent).toBe("21:35");
    expect(controller.destroy()).toBe(true);
    expect(controller.destroy()).toBe(false);
  });
});

function createReadModel() {
  return {
    server: { maxPlayersPerServer: 20 },
    mode: { tickRateMs: 10_000 },
    districts: [
      { districtId: "district:1", ownerPlayerId: "player:1", isOwnedByPlayer: true },
      { districtId: "district:2", ownerPlayerId: "player:2", isOwnedByPlayer: false }
    ],
    elimination: {
      activePlayersRemaining: 7,
      currentPlayerStatus: "safe",
      ticksUntilNextElimination: 12
    },
    player: {
      playerId: "player:1",
      factionId: "hackeri",
      faction: { name: "Hackeři" },
      alliance: { allianceName: "Night Shift" },
      economy: { gangMembers: 14 },
      dayNight: {
        phaseId: "night",
        uiThemeHint: "night",
        gameClockLabel: "21:35",
        gameHour: 21,
        gameMinute: 35
      }
    }
  };
}

function createFixture() {
  return `<main id="game-root">
    <span data-gang-members>—</span>
    <span data-gang-faction>—</span>
    <span data-gang-districts>—</span>
    <span data-gang-alliance>—</span>
    <div class="city-status-bar">
      ${pill("data-city-clock")}
      ${pill("data-city-day-phase")}
      ${pill("data-city-game-phase")}
      ${pill("data-city-status")}
      <div class="city-status-pill">
        <span class="city-status-pill__label"></span>
        <button data-city-production>—</button>
      </div>
    </div>
  </main>`;
}

function pill(attribute) {
  return `<div class="city-status-pill">
    <span class="city-status-pill__label"></span>
    <strong ${attribute}>—</strong>
  </div>`;
}
