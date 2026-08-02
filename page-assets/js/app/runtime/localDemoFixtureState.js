const LOCAL_DEMO_FIXTURE_DATA_KEY = Symbol.for("empire-streets.local-demo-fixture-data");

export let ALLIANCE_DEMO_DATA = null;

export const installLocalDemoFixtureData = (source = {}) => {
  ALLIANCE_DEMO_DATA = source.ALLIANCE_DEMO_DATA && typeof source.ALLIANCE_DEMO_DATA === "object"
    ? Object.freeze({ ...source.ALLIANCE_DEMO_DATA })
    : null;
  globalThis[LOCAL_DEMO_FIXTURE_DATA_KEY] = Object.freeze({
    allianceDemoData: ALLIANCE_DEMO_DATA
  });
  return ALLIANCE_DEMO_DATA;
};

export const getAllianceDemoFixtureData = () =>
  ALLIANCE_DEMO_DATA
  || globalThis[LOCAL_DEMO_FIXTURE_DATA_KEY]?.allianceDemoData
  || null;

export const uninstallLocalDemoFixtureData = () => {
  ALLIANCE_DEMO_DATA = null;
  delete globalThis[LOCAL_DEMO_FIXTURE_DATA_KEY];
};
