import { CLIENT_EXECUTION_MODES, resolveClientEntryExecutionMode } from "./app/runtime/clientAuthorityState.js";
import { isExplicitGamePreviewEnabled } from "./app/local-demo-gate.js";

const executionMode = resolveClientEntryExecutionMode({
  localDemoEnabled: isExplicitGamePreviewEnabled() ? true : undefined
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
  void import("./app-demo.js?v=runtime-modules-20260726");
} else {
  void import("./app.js?v=runtime-modules-20260726");
}
