export function getMapPhaseFromCityMinutes(cityMinutes) {
  const hour = Math.floor(Number(cityMinutes || 0) / 60) % 24;
  return hour >= 6 && hour < 20 ? "day" : "night";
}

export function buildCityStatusViewModel(phaseState = {}, options = {}) {
  const cityMinutes = Number(phaseState.cityMinutes ?? (22 * 60 + 14));
  const hours = String(Math.floor(cityMinutes / 60) % 24).padStart(2, "0");
  const minutes = String(cityMinutes % 60).padStart(2, "0");
  const mapPhase = phaseState.mapPhase === "night" ? "NOC" : "DEN";
  const gamePhase = phaseState.gamePhase === "launch" ? "DEV-ONLY" : "LIVE";
  const productionLabel = mapPhase === "NOC"
    ? "-8 % noční směna"
    : gamePhase === "DEV-ONLY"
      ? "+6 % rozjezd výroby"
      : "+12 % denní směna";

  return {
    cityMinutes,
    clockLabel: `${hours}:${minutes}`,
    dayPhaseLabel: mapPhase,
    gamePhaseLabel: gamePhase,
    statusLabel: mapPhase === "NOC"
      ? "Město nespí"
      : gamePhase === "DEV-ONLY"
        ? "Rozjezd ulic"
        : "Klid před bouří",
    productionLabel,
    mapPhase: phaseState.mapPhase === "night" ? "night" : "day",
    gamePhase: phaseState.gamePhase === "launch" ? "launch" : "live",
    tickMs: Number(options.tickMs || 1000)
  };
}

export function renderCityStatusBar(viewModel = {}, elements = {}) {
  if (!elements.clock || !elements.dayPhase || !elements.gamePhase || !elements.status || !elements.production) {
    return false;
  }

  elements.clock.textContent = viewModel.clockLabel || "00:00";
  elements.dayPhase.textContent = viewModel.dayPhaseLabel || "NOC";
  elements.gamePhase.textContent = viewModel.gamePhaseLabel || "LIVE";
  elements.status.textContent = viewModel.statusLabel || "";
  elements.production.textContent = viewModel.productionLabel || "";
  return true;
}

function resolveCityStatusElements(root, selectors = {}) {
  if (!root) {
    return null;
  }

  return {
    phaseHost: root.querySelector(selectors.phaseHost),
    clock: root.querySelector(selectors.clock),
    dayPhase: root.querySelector(selectors.dayPhase),
    gamePhase: root.querySelector(selectors.gamePhase),
    status: root.querySelector(selectors.status),
    production: root.querySelector(selectors.production)
  };
}

export function createCityStatusBarRuntime(deps = {}) {
  const selectors = deps.selectors || {};
  const tickMs = Number(deps.tickMs || 1000);
  const minuteStep = Number(deps.minuteStep || 1);
  const windowRef = deps.windowRef || (typeof window !== "undefined" ? window : null);

  const bindCityStatusBar = (root) => {
    const elements = resolveCityStatusElements(root, selectors);

    if (!elements?.phaseHost || !elements.clock || !elements.dayPhase || !elements.gamePhase || !elements.status || !elements.production) {
      return false;
    }

    let clockTimerId = null;
    const updatePhaseStatus = () => {
      const phaseState = deps.syncPhaseHostFromAuthority?.(elements.phaseHost) || {};
      const viewModel = buildCityStatusViewModel(phaseState, { tickMs });
      renderCityStatusBar(viewModel, elements);
      return viewModel;
    };

    updatePhaseStatus();
    deps.onInitialSync?.({
      root,
      phaseHost: elements.phaseHost,
      updatePhaseStatus
    });

    clockTimerId = windowRef?.setInterval?.(() => {
      deps.onTick?.({
        getMapPhaseFromClock: getMapPhaseFromCityMinutes,
        minuteStep,
        phaseHost: elements.phaseHost,
        root,
        updatePhaseStatus
      });
    }, tickMs) ?? null;

    elements.phaseHost.addEventListener("mapphasechange", updatePhaseStatus);
    elements.phaseHost.addEventListener("gamephasechange", updatePhaseStatus);
    elements.phaseHost.addEventListener("gamephasechange", () => {
      deps.onGamePhaseChange?.({
        root,
        phaseHost: elements.phaseHost,
        updatePhaseStatus
      });
    });

    windowRef?.addEventListener?.("beforeunload", () => {
      if (clockTimerId !== null) {
        windowRef.clearInterval(clockTimerId);
      }
    }, { once: true });

    return true;
  };

  return {
    bindCityStatusBar
  };
}
