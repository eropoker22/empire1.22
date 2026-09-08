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

const entryModule = executionMode === CLIENT_EXECUTION_MODES.localDemo
  ? import("./app-demo.js?v=20260731-e2e-parity-only")
  : import("./app.js?v=ui-refresh-20260805-2");

void entryModule.catch(() => showClientEntryUnavailable());

function showClientEntryUnavailable() {
  document.body?.classList.add("game-body--booting");
  document.body?.setAttribute("data-authority-state", "unavailable");
  const shell = document.querySelector("#game-root");
  if (shell instanceof HTMLElement) {
    shell.inert = true;
    shell.setAttribute("aria-busy", "true");
  }
  const gate = document.querySelector("[data-game-authority-gate]");
  gate?.setAttribute("aria-hidden", "false");
  const status = gate?.querySelector("[data-game-authority-status]");
  const message = gate?.querySelector("[data-game-authority-message]");
  const retry = gate?.querySelector("[data-game-authority-retry]");
  if (status) status.textContent = "SERVER NENÍ DOSTUPNÝ";
  if (message) message.textContent = "Klientské moduly hry se nepodařilo načíst. Obnov připojení.";
  if (retry instanceof HTMLButtonElement) {
    retry.hidden = false;
    retry.addEventListener("click", () => location.reload(), { once: true });
  }
}
