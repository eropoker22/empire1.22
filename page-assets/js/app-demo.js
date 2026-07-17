import { ENTRY_FLOW_TARGETS, getEntryFlowTarget } from "./app/auth-flow.js";
import { bindDesktopGameScrollLimit } from "./app/runtime/desktopScrollLimitRuntime.js";
import { bootstrapPage, PAGE_ROOT_SELECTOR } from "./app/render-ui.js";

const ENTRY_REDIRECTS = Object.freeze({
  [ENTRY_FLOW_TARGETS.login]: "./login.html",
  [ENTRY_FLOW_TARGETS.lobby]: "./lobby.html",
  [ENTRY_FLOW_TARGETS.faction]: "./faction.html"
});

function canBootGame() {
  const target = getEntryFlowTarget();
  if (target === ENTRY_FLOW_TARGETS.game) {
    return true;
  }

  const redirectHref = ENTRY_REDIRECTS[target] || "./lobby.html";
  window.location.replace(redirectHref);
  return false;
}

const shouldBootGame = canBootGame();

function bootGamePage() {
  const runtime = bootstrapPage();
  bindDesktopGameScrollLimit();
  return runtime;
}

if (shouldBootGame && document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGamePage, { once: true });
} else if (shouldBootGame && document.querySelector(PAGE_ROOT_SELECTOR)) {
  bootGamePage();
}
