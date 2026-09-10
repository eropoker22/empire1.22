import { describe, expect, it } from "vitest";
import { copyFreeHostedStartingPlayerState } from "@empire/game-config";
import { createServerInstanceRuntime } from "../../apps/server/src/runtime/instance-manager/instance-factory";
import { createStartingDistrictPreviewer } from "../../apps/server/src/player-entry/starting-district-preview";
import { addPlayerToGameplaySliceState } from "../../apps/server/src/bootstrap/gameplay-slice-session-seed";

describe("authoritative starting district preview", () => {
  it("explains an actual park without passive clean income or population and leaves the source untouched", () => {
    const runtime = createServerInstanceRuntime("instance:preview", "free");
    const state = addPlayerToGameplaySliceState(runtime.state, { serverInstanceId: runtime.record.id, playerId: "player:existing", mode: "free" });
    const before = structuredClone(state);
    const preview = createStartingDistrictPreviewer(state, "free", copyFreeHostedStartingPlayerState());
    const entries = Object.values(state.districtsById).map(d => ({ district: d, preview: preview(d.id)! }));
    const difficult = entries.filter(e => e.preview.cleanCashPerHour === 0 && e.preview.populationSource.startsWith("Bez pasivního"));
    expect(difficult.length).toBeGreaterThan(0);
    for (const { district, preview: value } of difficult) {
      expect(value.difficulty).toContain("bez pasivního clean příjmu a lidí");
      expect(value.buildingNames).toHaveLength(district.buildingIds.length);
      expect(value.basis).toContain("Mafián");
      expect(Number.isFinite(value.dirtyCashPerHour)).toBe(true);
    }
    expect(entries.some(e => e.preview.cleanCashPerHour > 0)).toBe(true);
    expect(state).toEqual(before);
    expect(preview("district:missing")).toBeUndefined();
    expect(createStartingDistrictPreviewer(null, "free", copyFreeHostedStartingPlayerState())("district:1")).toBeUndefined();
  });
});
