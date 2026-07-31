import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALLIANCE_CREATE_REQUIRED_INFLUENCE,
  createAllianceCreateEligibility
} from "../../page-assets/js/app/runtime/allianceCreateViewModel.js";

describe("alliance create view model", () => {
  it("uses the server eligibility without re-authorizing from rendered influence", () => {
    expect(createAllianceCreateEligibility({
      board: {
        canCreateAlliance: true,
        createDisabledReason: null
      },
      localDemo: false,
      localDemoInfluence: 0
    })).toEqual({
      canCreate: true,
      disabledReason: null,
      showInfluenceRequirement: false
    });
  });

  it("keeps the influence threshold only for explicit local demo preview", () => {
    const board = {
      canCreateAlliance: true,
      createDisabledReason: null
    };

    expect(createAllianceCreateEligibility({
      board,
      localDemo: true,
      localDemoInfluence: ALLIANCE_CREATE_REQUIRED_INFLUENCE - 1
    })).toMatchObject({
      canCreate: false,
      disabledReason: "ALLIANCE_CREATE_INSUFFICIENT_INFLUENCE",
      showInfluenceRequirement: true
    });
    expect(createAllianceCreateEligibility({
      board,
      localDemo: true,
      localDemoInfluence: ALLIANCE_CREATE_REQUIRED_INFLUENCE
    })).toMatchObject({
      canCreate: true,
      disabledReason: null
    });
  });

  it("preserves the server disabled reason", () => {
    expect(createAllianceCreateEligibility({
      board: {
        canCreateAlliance: false,
        createDisabledReason: "ALLIANCE_CREATE_LOCKED"
      }
    })).toEqual({
      canCreate: false,
      disabledReason: "ALLIANCE_CREATE_LOCKED",
      showInfluenceRequirement: false
    });
  });

  it("is used by the visible alliance runtime", () => {
    const source = readFileSync(resolve(
      process.cwd(),
      "page-assets/js/app/alliance-runtime.js"
    ), "utf8");

    expect(source).toContain("createAllianceCreateEligibility");
    expect(source).not.toContain("board?.canCreateAlliance === true && hasInfluence");
    expect(source).not.toContain("latestAllianceBoard?.canCreateAlliance === true && hasInfluence");
    expect(source).toContain("if (!isDevOnlyAllianceDemoEnabled())");
    expect(source).toContain("isDevOnlyAllianceDemoEnabled() ? getRememberedAllianceColor(alliance) :");
  });
});
