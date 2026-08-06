import { describe, expect, it } from "vitest";
import {
  dedupeStreetNewsCooldownEntries,
  selectServerPendingMissionCooldowns
} from "../../page-assets/js/app/runtime/serverCooldownStreetNews.js";

describe("server cooldown street news", () => {
  it("creates one robbery cooldown from the real operation and ignores global target cooldown hints", () => {
    const now = Date.parse("2026-08-06T12:00:00.000Z");
    const expiresAt = new Date(now + 60_000).toISOString();
    const readModel = {
      player: { playerId: "player:1" },
      mapEffects: [
        {
          effectId: "notification:rob:1",
          type: "robbery",
          playerId: "player:1",
          districtId: "district:78",
          expiresAt,
          expiresAtTick: 84
        },
        {
          effectId: "notification:rob:duplicate-projection",
          type: "robbery",
          playerId: "player:1",
          districtId: "district:78",
          expiresAt,
          expiresAtTick: 84
        }
      ],
      commandHints: {
        cooldowns: [11, 12, 13, 14, 15].map((districtId) => ({
          commandType: "rob-district",
          targetId: `district:${districtId}`,
          remainingTicks: 6
        }))
      }
    };

    expect(selectServerPendingMissionCooldowns(readModel, now)).toEqual([
      expect.objectContaining({
        type: "robbery",
        playerId: "player:1",
        districtId: "district:78",
        expiresAt: now + 60_000,
        expiresAtTick: 84
      })
    ]);
  });

  it("keeps distinct own operations and filters expired or foreign public effects", () => {
    const now = 1_000_000;
    const readModel = {
      player: { playerId: "player:1" },
      mapEffects: [
        { type: "spy", playerId: "player:1", districtId: "district:2", expiresAt: now + 1_000, expiresAtTick: 10 },
        { type: "attack", playerId: "player:1", districtId: "district:3", expiresAt: now + 2_000, expiresAtTick: 11 },
        { type: "occupy", playerId: "player:1", districtId: "district:4", expiresAt: now + 3_000, expiresAtTick: 12 },
        { type: "attack", playerId: "player:2", districtId: "district:5", expiresAt: now + 4_000, expiresAtTick: 13 },
        { type: "robbery", playerId: "player:1", districtId: "district:6", expiresAt: now - 1, expiresAtTick: 9 }
      ]
    };

    expect(selectServerPendingMissionCooldowns(readModel, now).map((entry) => entry.type))
      .toEqual(["spy", "attack", "occupy"]);
  });

  it("deduplicates the same cooldown across restored and server sources", () => {
    const entries = [
      { id: "local:1", sourceKind: "cooldown", title: "Vykrást district", summary: "District 78" },
      { id: "server:1", sourceKind: "cooldown", title: "Vykrást district", summary: "District 78" },
      { id: "server:2", sourceKind: "cooldown", title: "Útok", summary: "District 78" },
      { id: "captured:1", sourceKind: "cooldown", title: "ŠPEH ZAJAT", summary: "" },
      { id: "captured:2", sourceKind: "cooldown", title: "ŠPEH ZAJAT", summary: "" }
    ];

    expect(dedupeStreetNewsCooldownEntries(entries).map((entry) => entry.id))
      .toEqual(["local:1", "server:2", "captured:1", "captured:2"]);
  });
});
