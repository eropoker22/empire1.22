const REQUIRED_CALLBACKS = Object.freeze([
  "activatePlayerBoost",
  "addGangHeat",
  "appendBuildingActionResultEntry",
  "applyInventoryOutput",
  "applyTopbarEconomy",
  "getPlayerBoostViewModel",
  "getResolvedGangState",
  "renderSpyResourceState",
  "setBuildingActionFeedback"
]);
const OPTIONAL_CALLBACKS = Object.freeze([
  "getAllianceDemoData",
  "getBountyDemoTargets",
  "getLaunchPlayerAvatarByFactionId",
  "getStoredPreviewSession",
  "setE2eDistrictBuildingPopulationBuffer",
  "updateStoredPreviewSession"
]);

let activeProvider = null;

export function installLocalDemoGameplayBridge(provider) {
  if (!provider || typeof provider !== "object") {
    throw new TypeError("Local demo gameplay bridge requires a provider object.");
  }
  const missingCallbacks = REQUIRED_CALLBACKS.filter((name) => typeof provider[name] !== "function");
  if (missingCallbacks.length > 0) {
    throw new Error(`Local demo gameplay bridge is missing: ${missingCallbacks.join(", ")}`);
  }
  activeProvider = Object.freeze(Object.fromEntries(
    [...REQUIRED_CALLBACKS, ...OPTIONAL_CALLBACKS]
      .filter((name) => typeof provider[name] === "function")
      .map((name) => [name, provider[name]])
  ));
  globalThis.empireLocalDemoGameplayBridge = activeProvider;
  globalThis.document?.dispatchEvent?.(new CustomEvent("empire:local-demo-gameplay-bridge-ready"));
  return activeProvider;
}

export function getLocalDemoGameplayBridge() {
  return activeProvider || globalThis.empireLocalDemoGameplayBridge || null;
}

export function getLocalDemoGameplayBridgeForMode(executionMode) {
  return String(executionMode || "") === "local-demo"
    ? getLocalDemoGameplayBridge()
    : null;
}

export function uninstallLocalDemoGameplayBridge() {
  if (!activeProvider) return false;
  if (globalThis.empireLocalDemoGameplayBridge === activeProvider) {
    delete globalThis.empireLocalDemoGameplayBridge;
  }
  activeProvider = null;
  return true;
}
