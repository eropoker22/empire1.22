import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { createRequiredInputViews } from "../../../packages/game-core/src/projections/district-building-action-view-helpers";

describe("building action input views", () => {
  it("projects canonical emergency decree mode ids accepted by the server", () => {
    const config = resolveModeConfig("free");
    const cityHallConfig = config.balance.cityHall!;
    const action = config.balance.buildingActions![cityHallConfig.emergencyDecree.actionId];

    const modeInput = createRequiredInputViews({
      action,
      cityHallConfig
    }).find((input) => input.id === "mode");

    expect(modeInput).toMatchObject({
      type: "select",
      required: true
    });
    expect(modeInput?.options?.map((option) => option.value)).toEqual([
      "night_patrols",
      "suspended_checks",
      "construction_closure"
    ]);
  });
});
