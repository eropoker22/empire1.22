import { describe, expect, it } from "vitest";
import { resolveReadyPlayerCount } from "../../../apps/server/src/runtime/lifecycle/hosted-ready-player-count";

describe("hosted ready player count", () => {
  const membership = {
    membershipId: "membership:one",
    playerId: "player:one",
    reservedSpawnDistrictId: "district:one"
  };

  it("counts only a durable membership backed by a complete active Core player", () => {
    expect(resolveReadyPlayerCount([membership], state({
      "player:one": {
          status: "active",
          accountId: "account:one",
          homeDistrictId: "district:one",
          metadata: {
            membershipId: "membership:one",
            setupComplete: true,
            starterPackageApplied: true
          }
        }
      }
    ))).toEqual({ readyPlayerIds: ["player:one"], rejectedPlayerIds: [], count: 1 });
  });

  it.each([
    ["missing Core player", undefined],
    ["inactive Core player", { status: "pending", accountId: "account:one", homeDistrictId: "district:one", metadata: completeMetadata() }],
    ["missing identity", { status: "active", accountId: null, homeDistrictId: "district:one", metadata: completeMetadata() }],
    ["unclaimed home district", { status: "active", accountId: "account:one", homeDistrictId: null, metadata: completeMetadata() }],
    ["different membership", { status: "active", accountId: "account:one", homeDistrictId: "district:one", metadata: { ...completeMetadata(), membershipId: "membership:other" } }],
    ["starter package missing", { status: "active", accountId: "account:one", homeDistrictId: "district:one", metadata: { ...completeMetadata(), starterPackageApplied: false } }]
  ])("rejects %s", (_label, player) => {
    expect(resolveReadyPlayerCount([membership], state({ "player:one": player }))).toEqual({
      readyPlayerIds: [],
      rejectedPlayerIds: ["player:one"],
      count: 0
    });
  });
});

const completeMetadata = () => ({
  membershipId: "membership:one",
  setupComplete: true,
  starterPackageApplied: true
});

const state = (playersById: ReadyState["playersById"]): ReadyState => ({
  playersById,
  districtsById: { "district:one": { ownerPlayerId: "player:one" } }
});

type ReadyState = Parameters<typeof resolveReadyPlayerCount>[1];
