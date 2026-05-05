function getWindowRef() {
  return typeof window !== "undefined" ? window : null;
}

const registeredPublicHandlers = new Map();

function warnCompatibility(message, options = {}) {
  const logger = options.console || (typeof console !== "undefined" ? console : null);
  logger?.warn?.(message);
}

export function createSafePublicHandler(name, fn, fallback = () => undefined, options = {}) {
  return (...args) => {
    try {
      if (typeof fn === "function") {
        return fn(...args);
      }
      warnCompatibility(`Runtime public handler "${name}" is not available.`, options);
      return typeof fallback === "function" ? fallback(...args) : fallback;
    } catch (error) {
      warnCompatibility(`Runtime public handler "${name}" failed: ${error?.message || error}`, options);
      return typeof fallback === "function" ? fallback(...args) : fallback;
    }
  };
}

export function registerRuntimePublicHandlers(context = {}, options = {}) {
  const target = options.windowRef || getWindowRef();
  if (!target) {
    return [];
  }

  const handlers = context.handlers || context;
  const registered = [];
  for (const [name, fn] of Object.entries(handlers || {})) {
    if (typeof fn !== "function") {
      continue;
    }
    target[name] = createSafePublicHandler(name, fn, options.fallback, options);
    registeredPublicHandlers.set(name, target[name]);
    registered.push(name);
  }
  return registered;
}

export function unregisterRuntimePublicHandlers(options = {}) {
  const target = options.windowRef || getWindowRef();
  for (const name of registeredPublicHandlers.keys()) {
    if (target && target[name] === registeredPublicHandlers.get(name)) {
      delete target[name];
    }
  }
  registeredPublicHandlers.clear();
  return true;
}

export function getRegisteredPublicHandlers() {
  return Array.from(registeredPublicHandlers.keys()).sort();
}

export function assertPublicHandlersExist(names = [], options = {}) {
  const target = options.windowRef || getWindowRef();
  return (Array.isArray(names) ? names : []).every((name) => typeof target?.[name] === "function");
}

export function initRuntimeCompatibilityGlobals(api = {}, modules = {}, options = {}) {
  const target = options.windowRef || getWindowRef();
  if (!target) {
    return null;
  }

  const empireNamespace = target.EmpireRuntime && typeof target.EmpireRuntime === "object"
    ? target.EmpireRuntime
    : {};
  const moduleNamespace = target.EmpireRuntimeModules && typeof target.EmpireRuntimeModules === "object"
    ? target.EmpireRuntimeModules
    : {};

  Object.assign(empireNamespace, api);
  Object.assign(moduleNamespace, modules);

  target.EmpireRuntime = empireNamespace;
  target.EmpireRuntimeModules = moduleNamespace;

  const legacyAliases = {
    bootstrapPage: api.bootstrapPage,
    initRuntime: api.initRuntime,
    refreshAllUi: api.refreshAllUi,
    handleActionResult: api.handleActionResult,
    selectDistrict: api.selectDistrict,
    openDistrict: api.openDistrict,
    openBuildingDetail: api.openBuildingDetail,
    collectProduction: api.collectProduction,
    runBuildingAction: api.runBuildingAction,
    craftItem: api.craftItem,
    openMarket: api.openMarket,
    buyMarketItem: api.buyMarketItem,
    sellMarketItem: api.sellMarketItem,
    openAttackPanel: api.openAttackPanel,
    startAttack: api.startAttack,
    openSpyPanel: api.openSpyPanel,
    startSpy: api.startSpy,
    openPlayerProfile: api.openPlayerProfile,
    showToast: api.showToast,
    showNotification: api.showToast,
    showSuccess: api.showSuccess,
    showError: api.showError,
    showWarning: api.showWarning,
    showInfo: api.showInfo,
    clearNotifications: api.clearNotifications
  };

  registerRuntimePublicHandlers(legacyAliases, {
    ...options,
    windowRef: target,
    fallback: options.fallback
  });

  return empireNamespace;
}
