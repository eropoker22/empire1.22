import { afterEach, describe, expect, it } from "vitest";
import * as firstFixtureModule from "../../page-assets/js/app/runtime/localDemoFixtureState.js?fixture-instance=first";
import * as secondFixtureModule from "../../page-assets/js/app/runtime/localDemoFixtureState.js?fixture-instance=second";

describe("local demo fixture state", () => {
  afterEach(() => {
    firstFixtureModule.uninstallLocalDemoFixtureData();
    secondFixtureModule.uninstallLocalDemoFixtureData();
  });

  it("shares fixture data across cache-versioned module instances", () => {
    const allianceDemoData = Object.freeze({
      activeAlliance: Object.freeze({ allianceId: "demo-alliance" })
    });

    firstFixtureModule.installLocalDemoFixtureData({ ALLIANCE_DEMO_DATA: allianceDemoData });

    expect(firstFixtureModule.ALLIANCE_DEMO_DATA).toEqual(allianceDemoData);
    expect(secondFixtureModule.ALLIANCE_DEMO_DATA).toBeNull();
    expect(secondFixtureModule.getAllianceDemoFixtureData()).toEqual(allianceDemoData);
  });
});
