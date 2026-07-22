import { GAMEPLAY_EXECUTION_MODES } from "./gameplayExecutionMode.js";

export function canSubmitServerGameplayCommand(options = {}) {
  return options.onboardingSandboxActive !== true
    && options.documentAvailable !== false
    && options.hasValidatedGameplaySlice === true
    && options.executionMode === GAMEPLAY_EXECUTION_MODES.serverAuthoritative;
}
