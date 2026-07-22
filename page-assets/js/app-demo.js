import { ENTRY_FLOW_TARGETS, getEntryFlowTarget } from "./app/auth-flow.js";
import { isExplicitGamePreviewEnabled, isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";
import { bindDesktopGameScrollLimit } from "./app/runtime/desktopScrollLimitRuntime.js";
import { bootstrapPage, PAGE_ROOT_SELECTOR } from "./app/render-ui.js?v=heat-audit-20260721";
import * as localDemoScenarios from "./app/onboarding/demoScenarios.js";
import * as localDemoFixtures from "./app/dev-fixtures/allianceDemoData.js";
import { installLegacyScenarioData } from "./app/runtime/legacyScenarioState.js";
import { installLocalDemoFixtureData } from "./app/runtime/localDemoFixtureState.js";

installLegacyScenarioData(localDemoScenarios);
installLocalDemoFixtureData(localDemoFixtures);

const ENTRY_REDIRECTS = Object.freeze({
  [ENTRY_FLOW_TARGETS.login]: "./login.html",
  [ENTRY_FLOW_TARGETS.lobby]: "./lobby.html",
  [ENTRY_FLOW_TARGETS.faction]: "./faction.html"
});

function canBootGame() {
  if (isExplicitGamePreviewEnabled() || isExplicitLocalDemoEnabled()) return true;
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
