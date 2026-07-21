import { isExplicitLocalDemoEnabled, isLocalDemoAccessAvailable } from "../local-demo-gate.js";

export const CLIENT_EXECUTION_MODES = Object.freeze({
  serverAuthoritative: "server-authoritative",
  localDemo: "local-demo",
  onboardingSandbox: "onboarding-sandbox"
});

export const resolveClientAuthorityState = (options = {}) => {
  const locationRef = options.locationRef || globalThis.location;
  const localDemoEnabled = options.localDemoEnabled ?? isExplicitLocalDemoEnabled({
    locationRef,
    configOverrides: options.configOverrides,
    sessionStorageRef: options.sessionStorageRef
  });
  const onboardingSandbox = options.onboardingSandbox === true;
  const executionMode = onboardingSandbox
    ? CLIENT_EXECUTION_MODES.onboardingSandbox
    : localDemoEnabled
      ? CLIENT_EXECUTION_MODES.localDemo
      : CLIENT_EXECUTION_MODES.serverAuthoritative;
  const environment = resolveEnvironment(locationRef);
  const accountReady = options.accountReady === true;
  const membershipReady = options.membershipReady === true;
  const gameplayReady = options.gameplayReady === true;
  const serverReady = options.serverReady === true;
  const fixturesAllowed = executionMode !== CLIENT_EXECUTION_MODES.serverAuthoritative;

  return Object.freeze({
    executionMode,
    environment,
    serverReady,
    accountReady,
    membershipReady,
    gameplayReady,
    fixturesAllowed,
    reasonCode: options.reasonCode || resolveReasonCode({
      executionMode,
      accountReady,
      membershipReady,
      gameplayReady,
      serverReady
    })
  });
};

export const publishClientAuthorityState = (state, windowRef = globalThis.window) => {
  if (windowRef && typeof windowRef === "object") {
    windowRef.empireClientAuthorityState = state;
  }
  return state;
};

export const resolveClientEntryExecutionMode = (options = {}) => publishClientAuthorityState(
  resolveClientAuthorityState(options),
  options.windowRef || globalThis.window
).executionMode;

const resolveEnvironment = (locationRef) => {
  if (isLocalDemoAccessAvailable(locationRef)) return "local";
  const hostname = String(locationRef?.hostname || "").toLowerCase();
  return hostname.includes("staging") || hostname.includes("deploy-preview") ? "staging" : "production";
};

const resolveReasonCode = ({ executionMode, accountReady, membershipReady, gameplayReady, serverReady }) => {
  if (executionMode === CLIENT_EXECUTION_MODES.localDemo) return "LOCAL_DEMO_EXPLICIT";
  if (executionMode === CLIENT_EXECUTION_MODES.onboardingSandbox) return "ONBOARDING_SANDBOX_ACTIVE";
  if (!accountReady) return "ACCOUNT_SESSION_PENDING";
  if (!membershipReady) return "MEMBERSHIP_PENDING";
  if (!serverReady) return "SERVER_CONNECTION_PENDING";
  if (!gameplayReady) return "GAMEPLAY_SLICE_PENDING";
  return null;
};
