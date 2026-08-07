import {
  PAGE_ROOT_SELECTOR,
  START_PHASE_OWNER_BY_DISTRICT_ID,
  activatePlayerBoost,
  addGangHeat,
  appendBuildingActionResultEntry,
  applyInventoryOutput,
  applyTopbarEconomy,
  bootstrapPage,
  destroyRuntime,
  getPlayerBoostViewModel,
  getResolvedGangState,
  renderSpyResourceState,
  setE2eDistrictBuildingPopulationBuffer,
  setBuildingActionFeedback
} from "../runtime.js";
import { resolveBountyDemoTargets } from "../dev-fixtures/bountyDemoData.js";
import {
  getStoredPreviewSession,
  updateStoredPreviewSession
} from "../model/authority-state.js";
import {
  isExplicitGamePreviewEnabled,
  isExplicitLocalDemoEnabled,
  isLocalDemoAccessAvailable
} from "../local-demo-gate.js";
import {
  installLocalDemoGameplayBridge,
  uninstallLocalDemoGameplayBridge
} from "./localDemoGameplayBridge.js";
import { getAllianceDemoFixtureData } from "./localDemoFixtureState.js";
import {
  installLegacyScenarioData,
  LAUNCH_PLAYER_AVATAR_BY_FACTION_ID
} from "./legacyScenarioState.js";

let activeRuntime = null;

const installCanonicalLegacyScenarioData = (legacyScenarioData) => {
  if (
    !legacyScenarioData
    || !Array.isArray(legacyScenarioData.START_PHASE_OWNER_COORDINATES)
  ) {
    throw new Error("Local demo canonical launch scenario is unavailable.");
  }
  installLegacyScenarioData(legacyScenarioData);
  if (
    START_PHASE_OWNER_BY_DISTRICT_ID.size !== 20
    || START_PHASE_OWNER_BY_DISTRICT_ID.get(25) !== 3
    || START_PHASE_OWNER_BY_DISTRICT_ID.get(45) !== 9
  ) {
    throw new Error("Local demo canonical launch ownership failed to initialize.");
  }
};

const publishExecutionMode = ({
  documentRef,
  windowRef
}, mode, reason) => {
  if (windowRef) {
    windowRef.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = mode;
  }
  if (documentRef?.documentElement?.dataset) {
    documentRef.documentElement.dataset.gameplayExecutionMode = mode;
    documentRef.documentElement.dataset.runtimeMode = mode;
  }
  if (documentRef?.body?.dataset) {
    documentRef.body.dataset.runtimeMode = mode;
  }
  documentRef
    ?.querySelector?.('meta[name="empire-gameplay-execution-mode"]')
    ?.setAttribute?.("content", mode);
  windowRef?.empireStreetsRuntimeDiagnostics?.setMode?.(mode, {
    serverSliceActive: false,
    reason
  });
};

export function bootstrapLocalDemoLegacyPage({
  documentRef = globalThis.document,
  legacyScenarioData = null,
  locationRef = globalThis.location,
  windowRef = globalThis.window
} = {}) {
  const localAccess = isLocalDemoAccessAvailable(locationRef);
  const explicitlyEnabled = isExplicitLocalDemoEnabled({ locationRef })
    || isExplicitGamePreviewEnabled(locationRef);
  if (!localAccess || !explicitlyEnabled) {
    throw new Error("Legacy local demo is available only when explicitly enabled on loopback.");
  }
  const root = documentRef?.querySelector?.(PAGE_ROOT_SELECTOR) || null;
  if (
    root?.dataset?.runtimeInit === "server-authoritative"
    || root?.dataset?.gameplayAuthority === "server-authoritative"
  ) {
    throw new Error("Legacy local demo cannot mount beside server-authoritative gameplay.");
  }
  if (activeRuntime) {
    return activeRuntime;
  }
  if (!root) {
    return null;
  }
  installCanonicalLegacyScenarioData(legacyScenarioData);
  publishExecutionMode(
    { documentRef, windowRef },
    "local-demo",
    "local-demo-legacy-bootstrap"
  );
  installLocalDemoGameplayBridge({
    activatePlayerBoost,
    addGangHeat,
    appendBuildingActionResultEntry,
    applyInventoryOutput,
    applyTopbarEconomy,
    getPlayerBoostViewModel,
    getResolvedGangState,
    getAllianceDemoData: getAllianceDemoFixtureData,
    getBountyDemoTargets: () => resolveBountyDemoTargets(getStoredPreviewSession()),
    getLaunchPlayerAvatarByFactionId: (factionId) =>
      LAUNCH_PLAYER_AVATAR_BY_FACTION_ID[String(factionId || "")] || "",
    getStoredPreviewSession,
    renderSpyResourceState,
    setE2eDistrictBuildingPopulationBuffer,
    setBuildingActionFeedback,
    updateStoredPreviewSession
  });
  try {
    activeRuntime = bootstrapPage();
  } catch (error) {
    uninstallLocalDemoGameplayBridge();
    publishExecutionMode(
      { documentRef, windowRef },
      "server-authoritative",
      "local-demo-bootstrap-failed"
    );
    throw error;
  }
  if (!activeRuntime) {
    uninstallLocalDemoGameplayBridge();
    publishExecutionMode(
      { documentRef, windowRef },
      "server-authoritative",
      "local-demo-bootstrap-failed"
    );
  } else {
    root.dataset.gameplayAuthority = "local-demo";
  }
  return activeRuntime;
}

export function destroyLocalDemoLegacyPage({
  documentRef = globalThis.document,
  windowRef = globalThis.window
} = {}) {
  if (!activeRuntime) {
    return false;
  }
  const runtime = activeRuntime;
  activeRuntime = null;
  const root = runtime.root || documentRef?.querySelector?.(PAGE_ROOT_SELECTOR);
  try {
    publishExecutionMode(
      { documentRef, windowRef },
      "server-authoritative",
      "local-demo-destroy"
    );
    const CustomEventConstructor = windowRef?.CustomEvent || globalThis.CustomEvent;
    try {
      if (typeof CustomEventConstructor === "function") {
        documentRef?.dispatchEvent?.(new CustomEventConstructor("empire:runtime-mode-changed", {
          detail: {
            runtimeMode: "server-authoritative",
            reason: "local-demo-destroy"
          }
        }));
      }
    } finally {
      destroyRuntime(root);
    }
  } finally {
    if (root?.dataset?.gameplayAuthority === "local-demo") {
      delete root.dataset.gameplayAuthority;
    }
    uninstallLocalDemoGameplayBridge();
  }
  return true;
}

export * from "../runtime.js";
