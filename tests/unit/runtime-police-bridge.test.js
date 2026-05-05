import { describe, expect, it } from "vitest";
import { resolvePoliceHeatFeedback } from "../../page-assets/js/app/runtime/policeHeatBridge.js";

describe("runtime police heat bridge", () => {
  it("uses the core PoliceReadModel before legacy heat fallback", () => {
    const feedback = resolvePoliceHeatFeedback({
      player: {
        playerId: "player:1",
        police: {
          playerId: "player:1",
          heat: 72,
          wantedLevel: 3,
          wantedLabel: "3 / 5",
          riskTier: "high",
          aggregatePressure: 132,
          playerHeatPressure: 72,
          districtHeatPressure: 60,
          hottestDistrictId: "district:7",
          hottestDistrictHeat: 60,
          pendingRaid: {
            raidId: "police:raid:1",
            severity: "high",
            reason: "aggregate-pressure:132",
            previewConsequences: {
              seizedDirtyCash: 18,
              heatReducedBy: 25
            }
          },
          policeFeed: [
            {
              id: "police:event:1",
              type: "police-raid-pending",
              message: "Raid pending."
            }
          ],
          lastPoliceEvent: {
            id: "police:event:1",
            type: "police-raid-pending",
            message: "Raid pending."
          },
          recommendedAction: "Zvaž pauzu v útocích."
        }
      },
      gangState: {
        heat: 0
      }
    });

    expect(feedback).toMatchObject({
      heat: 72,
      riskKey: "high",
      aggregatePressure: 132,
      districtHeatPressure: 60,
      hottestDistrictId: "district:7",
      hottestDistrictHeat: 60,
      hasCoreReadModel: true,
      hasRealPoliceEvent: true,
      pendingRaid: {
        raidId: "police:raid:1"
      },
      previewConsequences: {
        seizedDirtyCash: 18
      }
    });
  });

  it("keeps the legacy fallback when the core read model is missing", () => {
    const feedback = resolvePoliceHeatFeedback({
      gangState: {
        heat: 96
      },
      heatLevel: {
        id: 4
      },
      policeActions: {}
    });

    expect(feedback).toMatchObject({
      riskKey: "high",
      aggregatePressure: 96,
      hasCoreReadModel: false,
      hottestDistrictId: null,
      pendingRaid: null
    });
  });
});
