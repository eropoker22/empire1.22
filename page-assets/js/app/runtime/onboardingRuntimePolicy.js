import { GAMEPLAY_EXECUTION_MODES } from "./gameplayExecutionMode.js";

const ONBOARDING_RUNTIME_POLICIES = Object.freeze({
  [GAMEPLAY_EXECUTION_MODES.localDemo]: Object.freeze({
    autoStart: true,
    bind: true,
    useLocalSandbox: true
  }),
  [GAMEPLAY_EXECUTION_MODES.serverAuthoritative]: Object.freeze({
    autoStart: false,
    bind: true,
    useLocalSandbox: true
  }),
  [GAMEPLAY_EXECUTION_MODES.unavailable]: Object.freeze({
    autoStart: false,
    bind: false,
    useLocalSandbox: false
  })
});

export function resolveOnboardingRuntimePolicy(executionMode) {
  return ONBOARDING_RUNTIME_POLICIES[executionMode]
    || ONBOARDING_RUNTIME_POLICIES[GAMEPLAY_EXECUTION_MODES.unavailable];
}
