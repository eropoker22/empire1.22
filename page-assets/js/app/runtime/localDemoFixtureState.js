export let ALLIANCE_DEMO_DATA = null;

export const installLocalDemoFixtureData = (source = {}) => {
  ALLIANCE_DEMO_DATA = source.ALLIANCE_DEMO_DATA && typeof source.ALLIANCE_DEMO_DATA === "object"
    ? Object.freeze({ ...source.ALLIANCE_DEMO_DATA })
    : null;
};
