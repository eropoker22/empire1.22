import { HOSTED_E2E_STARTING_PLAYER_STATE } from "./local-hosted/hosted-e2e-starting-player-state.mjs";

const withOutputEmpty = (resourceKey) => ({
  ...HOSTED_E2E_STARTING_PLAYER_STATE,
  materials: {
    ...HOSTED_E2E_STARTING_PLAYER_STATE.materials,
    [resourceKey]: 0
  }
});

export const REMOTE_MANUAL_STARTING_PLAYER_STATE = Object.freeze({
  cleanCash: 1_000_000,
  dirtyCash: 500_000,
  population: 1_000,
  spySlots: 2,
  materials: Object.freeze(Object.fromEntries(
    Object.keys(HOSTED_E2E_STARTING_PLAYER_STATE.materials).map((materialId) => [
      materialId,
      500
    ])
  ))
});

const suite = (name, options = {}) => Object.freeze({
  name,
  bootstrapCount: options.bootstrapCount ?? 1,
  capacity: options.capacity ?? 20,
  scenario: options.scenario ?? "",
  startingPlayerState: options.startingPlayerState ?? HOSTED_E2E_STARTING_PLAYER_STATE,
  playwrightRuns: Object.freeze(options.playwrightRuns ?? []),
  manual: options.manual === true,
  restartWorkerBeforeSpec: options.restartWorkerBeforeSpec === true,
  pauseResumeBeforeSpec: options.pauseResumeBeforeSpec === true
});
const run = (name, specs, options = {}) => Object.freeze({
  name,
  specs: Object.freeze(specs),
  grep: options.grep ?? "",
  environment: Object.freeze(options.environment ?? {}),
  timeoutMs: options.timeoutMs ?? 1_200_000
});

export const REMOTE_STAGING_ACCEPTANCE_SUITES = Object.freeze([
  suite("manual-admin-player", {
    manual: true,
    playwrightRuns: [run("manual-admin-player", ["tests/e2e/manual-hosted-admin-player-flow.spec.js"], { timeoutMs: 1_800_000 })]
  }),
  suite("ui-parity", {
    playwrightRuns: [
      run("ui-parity-shared", ["tests/e2e/live-demo-ui-parity.spec.js", "tests/e2e/live-demo-utility-modal-parity.spec.js"], {
        grep: "canonical building parity coverage contract|live/demo shared presentation parity|live/demo utility modal parity"
      }),
      run("ui-parity-buildings-a", ["tests/e2e/live-demo-ui-parity.spec.js"], {
        grep: "commercial-mall-pharmacy|residential-arcade-garage|park-distribution|industrial-recycle"
      }),
      run("ui-parity-buildings-b", ["tests/e2e/live-demo-ui-parity.spec.js"], {
        grep: "industrial-armory-warehouse|residential-recovery|industrial-power|park-night-cover|park-drug-lab"
      }),
      run("ui-parity-buildings-c", ["tests/e2e/live-demo-ui-parity.spec.js"], {
        grep: "commercial-mobility-exchange|residential-school|commercial-fitness"
      })
    ]
  }),
  suite("ui-parity-social", {
    playwrightRuns: [
      run("ui-parity-social-a", ["tests/e2e/live-demo-social-modal-parity.spec.js"], { environment: { EMPIRE_UI_PARITY_SOCIAL_BATCH_KEYS: "social-01,social-02" } }),
      run("ui-parity-social-b", ["tests/e2e/live-demo-social-modal-parity.spec.js"], { environment: { EMPIRE_UI_PARITY_SOCIAL_BATCH_KEYS: "social-03,social-04" } }),
      run("ui-parity-social-c", ["tests/e2e/live-demo-social-modal-parity.spec.js"], { environment: { EMPIRE_UI_PARITY_SOCIAL_BATCH_KEYS: "social-05" } })
    ]
  }),
  suite("production-pharmacy", {
    startingPlayerState: withOutputEmpty("chemicals"),
    playwrightRuns: [run("production-pharmacy", ["tests/e2e/live-production-pharmacy.spec.js"])]
  }),
  suite("production-drug-lab", {
    startingPlayerState: withOutputEmpty("neon-dust"),
    playwrightRuns: [run("production-drug-lab", ["tests/e2e/live-production-drug-lab.spec.js"])]
  }),
  suite("production-factory", {
    startingPlayerState: withOutputEmpty("metal-parts"),
    playwrightRuns: [run("production-factory", ["tests/e2e/live-production-factory.spec.js"])]
  }),
  suite("production-armory", {
    startingPlayerState: withOutputEmpty("baseball-bat"),
    playwrightRuns: [run("production-armory", ["tests/e2e/live-production-armory.spec.js"])]
  }),
  suite("income", {
    restartWorkerBeforeSpec: true,
    playwrightRuns: [run("income", ["tests/e2e/live-hosted-income.spec.js"])]
  }),
  suite("building-actions-day", {
    scenario: "building-actions-day",
    playwrightRuns: [run("building-actions-day", ["tests/e2e/live-hosted-building-actions-visible-ui.spec.js"], {
      environment: { EMPIRE_HOSTED_BUILDING_ACTION_PHASE: "day" }, timeoutMs: 1_800_000
    })]
  }),
  suite("building-actions-night", {
    scenario: "building-actions-night",
    playwrightRuns: [run("building-actions-night", ["tests/e2e/live-hosted-building-actions-visible-ui.spec.js"], {
      environment: { EMPIRE_HOSTED_BUILDING_ACTION_PHASE: "night" }, timeoutMs: 1_800_000
    })]
  }),
  suite("ui-parity-non-spawn", {
    scenario: "building-parity-non-spawn",
    playwrightRuns: [
      run("non-spawn-a", ["tests/e2e/live-hosted-non-spawn-building-parity.spec.js"], {
        environment: { EMPIRE_UI_PARITY_NON_SPAWN_KEYS: "casino,court-vip-lounge,central-bank,stock-exchange" }, timeoutMs: 1_800_000
      }),
      run("non-spawn-b", ["tests/e2e/live-hosted-non-spawn-building-parity.spec.js"], {
        environment: { EMPIRE_UI_PARITY_NON_SPAWN_KEYS: "city-hall-parliament,airport-lobby-club,port" }, timeoutMs: 1_800_000
      })
    ]
  }),
  suite("multiplayer-visible-actions", {
    bootstrapCount: 3,
    scenario: "multiplayer-core",
    playwrightRuns: [run("multiplayer-visible-actions", [
      "tests/e2e/manual-hosted-district-actions-ui.spec.js",
      "tests/e2e/live-demo-district-action-overlay-parity.spec.js"
    ], { timeoutMs: 1_800_000 })]
  }),
  suite("city-events", {
    scenario: "city-events",
    playwrightRuns: [run("city-events", ["tests/e2e/live-city-events.spec.js"])]
  }),
  suite("social-visible-ui", {
    bootstrapCount: 3,
    scenario: "multiplayer-core",
    playwrightRuns: [run("social-visible-ui", ["tests/e2e/live-hosted-social-visible-ui.spec.js"], { timeoutMs: 1_800_000 })]
  }),
  suite("social-concurrency-privacy", {
    bootstrapCount: 5,
    scenario: "social-concurrency-privacy",
    playwrightRuns: [run("social-concurrency-privacy", ["tests/e2e/live-hosted-social-concurrency-privacy.spec.js"], { timeoutMs: 1_800_000 })]
  }),
  suite("lifecycle-stop", {
    pauseResumeBeforeSpec: true,
    playwrightRuns: [run("lifecycle-stop", ["tests/e2e/live-hosted-lifecycle-stop.spec.js"])]
  })
]);

export const getRemoteStagingAcceptanceSuite = (name) => {
  const selected = REMOTE_STAGING_ACCEPTANCE_SUITES.find((candidate) => candidate.name === name);
  if (!selected) {
    throw new Error(`Unknown remote staging suite: ${name}. Available: ${REMOTE_STAGING_ACCEPTANCE_SUITES.map((entry) => entry.name).join(", ")}.`);
  }
  return selected;
};
