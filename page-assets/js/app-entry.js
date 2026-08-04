import {
  CLIENT_EXECUTION_MODES,
  isE2eLocalDemoEntryEnabled,
  resolveClientEntryExecutionMode
} from "./app/runtime/clientAuthorityState.js";

const executionMode = resolveClientEntryExecutionMode({
  localDemoEnabled: isE2eLocalDemoEntryEnabled()
});
window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = executionMode;
document.documentElement.dataset.gameplayExecutionMode = executionMode;
document.documentElement.dataset.runtimeMode = executionMode;
document.body?.dataset && (document.body.dataset.runtimeMode = executionMode);
document.querySelector('meta[name="empire-gameplay-execution-mode"]')?.setAttribute("content", executionMode);
window.empireStreetsRuntimeDiagnostics?.setMode?.(executionMode, {
  serverSliceActive: false,
  reason: "game-entry-mode-selected"
});

if (executionMode === CLIENT_EXECUTION_MODES.localDemo) {
  void import("./app-demo.js?v=20260731-e2e-parity-only");
} else {
  void import("./app.js?v=ui-refresh-20260805-2");
}
