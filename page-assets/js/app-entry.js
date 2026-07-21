import { isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";

const executionMode = isExplicitLocalDemoEnabled() ? "local-demo" : "server-authoritative";
window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = executionMode;
document.documentElement.dataset.gameplayExecutionMode = executionMode;
document.documentElement.dataset.runtimeMode = executionMode;
document.body?.dataset && (document.body.dataset.runtimeMode = executionMode);
document.querySelector('meta[name="empire-gameplay-execution-mode"]')?.setAttribute("content", executionMode);
window.empireStreetsRuntimeDiagnostics?.setMode?.(executionMode, {
  serverSliceActive: false,
  reason: "game-entry-mode-selected"
});

if (executionMode === "local-demo") {
  void import("./app-demo.js?v=heat-audit-20260721");
} else {
  void import("./app.js?v=heat-audit-20260721");
}
