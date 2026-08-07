import { ENTRY_FLOW_TARGETS, getEntryFlowTarget } from "./app/auth-flow.js";
import { isExplicitGamePreviewEnabled, isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";
import { bindDesktopGameScrollLimit } from "./app/runtime/desktopScrollLimitRuntime.js";
import * as localDemoScenarios from "./app/onboarding/demoScenarios.js";
import * as localDemoFixtures from "./app/dev-fixtures/allianceDemoData.js";
import { installLocalDemoFixtureData } from "./app/runtime/localDemoFixtureState.js";

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
let activeRuntime = null;
let bootGeneration = 0;
let bootPromise = null;
let bootPromiseGeneration = -1;
let desktopScrollController = null;
let localDemoLifecycleModule = null;
let localDemoLifecycleModulePromise = null;

const loadLocalDemoLifecycleModule = () => {
  if (!localDemoLifecycleModulePromise) {
    localDemoLifecycleModulePromise = import("./app/runtime/localDemoLegacyBootstrap.js")
      .then((module) => {
        localDemoLifecycleModule = module;
        return module;
      });
  }
  return localDemoLifecycleModulePromise;
};

async function bootGamePage() {
  if (activeRuntime) return activeRuntime;
  const requestedGeneration = bootGeneration;
  if (bootPromise && bootPromiseGeneration === requestedGeneration) {
    return bootPromise;
  }

  const pendingBoot = (async () => {
    const { bootstrapLocalDemoLegacyPage } = await loadLocalDemoLifecycleModule();
    if (requestedGeneration !== bootGeneration) return null;
    const runtime = bootstrapLocalDemoLegacyPage({
      legacyScenarioData: localDemoScenarios
    });
    if (!runtime || requestedGeneration !== bootGeneration) {
      localDemoLifecycleModule?.destroyLocalDemoLegacyPage?.();
      return null;
    }
    activeRuntime = runtime;
    desktopScrollController?.destroy?.();
    desktopScrollController = bindDesktopGameScrollLimit();
    return runtime;
  })();
  bootPromise = pendingBoot;
  bootPromiseGeneration = requestedGeneration;
  try {
    return await pendingBoot;
  } finally {
    if (bootPromise === pendingBoot) {
      bootPromise = null;
      bootPromiseGeneration = -1;
    }
  }
}

function destroyGamePage() {
  bootGeneration += 1;
  activeRuntime = null;
  desktopScrollController?.destroy?.();
  desktopScrollController = null;
  return localDemoLifecycleModule?.destroyLocalDemoLegacyPage?.() || false;
}

function handlePageHide() {
  destroyGamePage();
}

function handlePageShow(event) {
  if (shouldBootGame && (event?.persisted === true || !activeRuntime)) {
    void bootGamePage();
  }
}

window.addEventListener("pagehide", handlePageHide);
window.addEventListener("pageshow", handlePageShow);

if (shouldBootGame && document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void bootGamePage(), { once: true });
} else if (shouldBootGame) {
  void bootGamePage();
}
