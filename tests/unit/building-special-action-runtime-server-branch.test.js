import { describe, expect, it, vi } from "vitest";
import { presentServerBuildingActionResponse } from "../../page-assets/js/app/runtime/serverBuildingActionResponse.js";

describe("runtime server building action response", () => {
  it("renders the authoritative report and refreshes the server projection after acceptance", () => {
    const setFeedback = vi.fn();
    const refreshBuildingDetail = vi.fn();
    const root = {};
    const shell = {};

    const accepted = presentServerBuildingActionResponse({
      response: {
        accepted: true,
        readModel: {
          reports: [{ summary: "Server potvrdil efekt i cooldown." }]
        }
      },
      action: "Tržní tlak",
      actionProfile: { summary: "Lokální fallback" },
      definition: { rewardSummary: "Statický fallback" },
      context: { buildingName: "Burza", district: { id: 79 } },
      root,
      shell
    }, { setFeedback, refreshBuildingDetail });

    expect(accepted).toBe(true);
    expect(setFeedback).toHaveBeenCalledWith(
      root,
      "success",
      "Tržní tlak",
      "Server potvrdil efekt i cooldown.",
      "Burza · District 79"
    );
    expect(refreshBuildingDetail).toHaveBeenCalledWith(root, shell);
  });

  it("surfaces a rejection without refreshing or running a local success path", () => {
    const setFeedback = vi.fn();
    const refreshBuildingDetail = vi.fn();
    const root = {};

    const accepted = presentServerBuildingActionResponse({
      response: {
        accepted: false,
        errors: [{ code: "building.cooldown", message: "Akce ještě čeká." }]
      },
      action: "Tržní tlak",
      context: { buildingName: "Burza", district: { id: 79 } },
      root,
      shell: {}
    }, { setFeedback, refreshBuildingDetail });

    expect(accepted).toBe(false);
    expect(setFeedback).toHaveBeenCalledWith(
      root,
      "warning",
      "Tržní tlak",
      "Akce ještě čeká.",
      "Burza"
    );
    expect(refreshBuildingDetail).not.toHaveBeenCalled();
  });
});
