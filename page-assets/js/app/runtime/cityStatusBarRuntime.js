export function getMapPhaseFromCityMinutes(cityMinutes) {
  const hour = Math.floor(Number(cityMinutes || 0) / 60) % 24;
  return hour >= 6 && hour < 18 ? "day" : "night";
}

const DEFAULT_CITY_MINUTES = 5 * 60 + 55;
const DEFAULT_MAX_PLAYERS_PER_SERVER = 20;

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStatusLabel(value) {
  const normalized = String(value || "safe").trim().toLowerCase();
  if (normalized === "danger") return "DANGER";
  if (normalized === "critical") return "CRITICAL";
  if (normalized === "defeated") return "DEFEATED";
  return "SAFE";
}

function formatQuietHoursResume(model = {}) {
  const quietHours = normalizeObject(model.quietHours);
  const endHour = Number.isFinite(Number(quietHours.endHour)) ? Number(quietHours.endHour) : 6;
  return `do ${String(Math.max(0, Math.floor(endHour)) % 24).padStart(2, "0")}:00`;
}

function formatTickDuration(ticks) {
  const totalMinutes = Math.max(0, Math.ceil(Number(ticks || 0)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatScoreDelta(value) {
  const safeValue = Math.max(0, Math.ceil(Number(value || 0)));
  if (safeValue >= 1000000) return `+${Math.round(safeValue / 100000) / 10}M`;
  if (safeValue >= 1000) return `+${Math.round(safeValue / 1000)}k`;
  return `+${safeValue}`;
}

function resolveFinalTop3Label(finalLockdown = {}) {
  const topRankCount = Math.max(1, Math.floor(Number(finalLockdown.topRankCount || 3)));
  const currentRank = Number(finalLockdown.currentPlayerRank);
  if (Number.isFinite(currentRank) && currentRank > 0 && currentRank <= topRankCount) {
    return "drž pozici";
  }

  const leaderboard = Array.isArray(finalLockdown.leaderboardTop3) ? finalLockdown.leaderboardTop3 : [];
  const thresholdScore = Number(leaderboard[Math.min(topRankCount, leaderboard.length) - 1]?.score);
  const currentScore = Number(finalLockdown.currentPlayerFinalScore);
  if (!Number.isFinite(thresholdScore) || !Number.isFinite(currentScore)) {
    return "-";
  }

  return formatScoreDelta(Math.max(0, thresholdScore - currentScore + 1));
}

function resolveCityStatusPlayerView(options = {}) {
  const gameplaySlice = normalizeObject(options.gameplaySlice);
  const playerView = normalizeObject(options.playerView || gameplaySlice.player);
  return {
    gameplaySlice,
    playerView,
    elimination: normalizeObject(playerView.elimination || gameplaySlice.elimination),
    finalLockdown: normalizeObject(playerView.finalLockdown),
    maxPlayersPerServer: Number(options.maxPlayersPerServer || gameplaySlice.server?.maxPlayersPerServer || DEFAULT_MAX_PLAYERS_PER_SERVER)
  };
}

function buildBattleRoyaleStatusViewModel(playerOptions = {}) {
  const {
    elimination,
    finalLockdown,
    maxPlayersPerServer
  } = resolveCityStatusPlayerView(playerOptions);
  const finalActive = Boolean(finalLockdown.enabled && (finalLockdown.active || finalLockdown.status === "active"));

  if (finalActive) {
    const rank = Number(finalLockdown.currentPlayerRank);
    const topRankCount = Math.max(1, Math.floor(Number(finalLockdown.topRankCount || 3)));
    return {
      mode: "final",
      secondaryLabel: "Finále",
      secondaryMobileLabel: "Fin",
      secondaryValue: finalLockdown.pausedByQuietHours
        ? formatQuietHoursResume(finalLockdown)
        : `${formatTickDuration(finalLockdown.remainingActiveTicks)} zbývá`,
      statusLabel: "Rank",
      statusMobileLabel: "Rank",
      statusValue: Number.isFinite(rank) && rank > 0 && rank <= topRankCount ? `Top ${topRankCount}` : (Number.isFinite(rank) && rank > 0 ? `#${rank}` : "-"),
      playersLabel: "Top 3",
      playersMobileLabel: "Top3",
      playersValue: resolveFinalTop3Label(finalLockdown),
      actionTitle: "Očista",
      actionAriaLabel: "Očista",
      statusClass: "final"
    };
  }

  const eliminationsStopped = Boolean(elimination.eliminationsStopped);
  const statusValue = eliminationsStopped ? "Top 8" : normalizeStatusLabel(elimination.currentPlayerStatus);
  const activePlayers = Number(elimination.activePlayersRemaining);
  const playersValue = Number.isFinite(activePlayers) && activePlayers > 0
    ? `${activePlayers}/${Math.max(1, Math.floor(maxPlayersPerServer || DEFAULT_MAX_PLAYERS_PER_SERVER))}`
    : `${DEFAULT_MAX_PLAYERS_PER_SERVER}/${DEFAULT_MAX_PLAYERS_PER_SERVER}`;
  const nextTicks = Number(elimination.ticksUntilNextElimination);
  const secondaryValue = eliminationsStopped
    ? "zastaveno"
    : elimination.isQuietHoursNow
      ? formatQuietHoursResume(elimination)
      : Number.isFinite(nextTicks)
        ? `za ${formatTickDuration(nextTicks)}`
        : "čeká se";

  return {
    mode: "br",
    secondaryLabel: "Očista",
    secondaryMobileLabel: "",
    secondaryValue,
    statusLabel: "Stav",
    statusMobileLabel: "Stav",
    statusValue,
    playersLabel: "Hráči",
    playersMobileLabel: "Hráči",
    playersValue,
    actionTitle: "Očista",
    actionAriaLabel: "Očista",
    statusClass: statusValue === "CRITICAL" ? "critical" : statusValue === "DANGER" || statusValue === "DEFEATED" ? "danger" : ""
  };
}

export function buildCityStatusViewModel(phaseState = {}, options = {}) {
  const gameplaySlice = normalizeObject(options.gameplaySlice);
  const playerView = normalizeObject(options.playerView || gameplaySlice.player);
  const dayNight = normalizeObject(playerView.dayNight || gameplaySlice.player?.dayNight);
  const coreMapPhase = dayNight.phaseId === "day" || dayNight.uiThemeHint === "day"
    ? "day"
    : dayNight.phaseId === "night" || dayNight.uiThemeHint === "night"
      ? "night"
      : "";
  const cityMinutes = Number(phaseState.cityMinutes ?? DEFAULT_CITY_MINUTES);
  const hours = String(Math.floor(cityMinutes / 60) % 24).padStart(2, "0");
  const minutes = String(cityMinutes % 60).padStart(2, "0");
  const battleRoyale = buildBattleRoyaleStatusViewModel(options);
  const clockLabel = typeof dayNight.gameClockLabel === "string" && dayNight.gameClockLabel
    ? dayNight.gameClockLabel
    : `${hours}:${minutes}`;

  return {
    cityMinutes,
    clockLabel,
    dayPhaseLabel: battleRoyale.secondaryValue,
    dayPhaseTitle: battleRoyale.secondaryLabel,
    dayPhaseMobileLabel: battleRoyale.secondaryMobileLabel,
    gamePhaseLabel: battleRoyale.statusValue,
    gamePhaseTitle: battleRoyale.statusLabel,
    gamePhaseMobileLabel: battleRoyale.statusMobileLabel,
    statusLabel: battleRoyale.playersValue,
    statusTitle: battleRoyale.playersLabel,
    statusMobileLabel: battleRoyale.playersMobileLabel,
    productionLabel: "Očista",
    productionTitle: "",
    productionMobileLabel: "",
    actionTitle: battleRoyale.actionTitle,
    actionAriaLabel: battleRoyale.actionAriaLabel,
    statusClass: battleRoyale.statusClass,
    cityStatusMode: battleRoyale.mode,
    mapPhaseSource: coreMapPhase ? "core" : "legacy",
    mapPhase: coreMapPhase || (phaseState.mapPhase === "night" || phaseState.mapPhase === "day"
      ? phaseState.mapPhase
      : getMapPhaseFromCityMinutes(cityMinutes)),
    gamePhase: phaseState.gamePhase === "launch" ? "launch" : "live",
    tickMs: Number(options.tickMs || 1000)
  };
}

function syncPhaseHostFromViewModel(phaseHost, viewModel = {}) {
  if (!phaseHost) return;
  const nextMapPhase = viewModel.mapPhase === "day" ? "day" : "night";
  if (viewModel.mapPhaseSource === "core") {
    phaseHost.dataset.coreMapPhase = nextMapPhase;
  } else {
    delete phaseHost.dataset.coreMapPhase;
  }
  if (phaseHost.dataset.mapPhase !== nextMapPhase) {
    phaseHost.dataset.mapPhase = nextMapPhase;
    const CustomEventCtor = phaseHost.ownerDocument?.defaultView?.CustomEvent
      || (typeof CustomEvent !== "undefined" ? CustomEvent : null);
    phaseHost.dispatchEvent?.(
      CustomEventCtor
        ? new CustomEventCtor("mapphasechange", { detail: { phase: nextMapPhase } })
        : { type: "mapphasechange", detail: { phase: nextMapPhase } }
    );
  }
}

function setPillLabel(element, label, mobileLabel) {
  const labelElement = element?.closest?.(".city-status-pill")?.querySelector?.(".city-status-pill__label");
  if (!labelElement) return;
  labelElement.textContent = label || "";
  labelElement.dataset.mobileShort = mobileLabel || "";
}

function updateStatusClasses(element, viewModel = {}) {
  const bar = element?.closest?.(".city-status-bar");
  const statusPill = element?.closest?.(".city-status-pill");
  if (bar) {
    bar.dataset.cityStatusMode = viewModel.cityStatusMode || "br";
  }
  if (!statusPill?.classList) return;
  statusPill.classList.remove("city-status-pill--danger", "city-status-pill--critical", "city-status-pill--final");
  if (viewModel.statusClass === "critical") {
    statusPill.classList.add("city-status-pill--critical");
  } else if (viewModel.statusClass === "danger") {
    statusPill.classList.add("city-status-pill--danger");
  } else if (viewModel.statusClass === "final") {
    statusPill.classList.add("city-status-pill--final");
  }
}

export function renderCityStatusBar(viewModel = {}, elements = {}) {
  if (!elements.clock || !elements.dayPhase || !elements.gamePhase || !elements.status || !elements.production) {
    return false;
  }

  elements.clock.textContent = viewModel.clockLabel || "00:00";
  setPillLabel(elements.clock, "Čas města", "Čas");
  elements.dayPhase.textContent = viewModel.dayPhaseLabel || "NOC";
  setPillLabel(elements.dayPhase, viewModel.dayPhaseTitle || "Očista", viewModel.dayPhaseMobileLabel ?? "");
  elements.gamePhase.textContent = viewModel.gamePhaseLabel || "LIVE";
  setPillLabel(elements.gamePhase, viewModel.gamePhaseTitle || "Stav", viewModel.gamePhaseMobileLabel || "Stav");
  elements.status.textContent = viewModel.statusLabel || "";
  setPillLabel(elements.status, viewModel.statusTitle || "Hráči", viewModel.statusMobileLabel || "Hráči");
  updateStatusClasses(elements.gamePhase, viewModel);
  if (elements.production.tagName === "BUTTON") {
    elements.production.textContent = viewModel.productionLabel || "Očista";
    elements.production.setAttribute?.("title", viewModel.actionTitle || "Očista");
    elements.production.setAttribute?.("aria-label", viewModel.actionAriaLabel || "Očista");
  } else {
    elements.production.textContent = viewModel.productionLabel || "Očista";
  }
  setPillLabel(elements.production, viewModel.productionTitle ?? "", viewModel.productionMobileLabel ?? "");
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
    let latestGameplaySlice = null;
    const updatePhaseStatus = () => {
      const phaseState = deps.syncPhaseHostFromAuthority?.(elements.phaseHost) || {};
      const viewModel = buildCityStatusViewModel(phaseState, {
        gameplaySlice: latestGameplaySlice,
        playerView: latestGameplaySlice?.player,
        tickMs
      });
      syncPhaseHostFromViewModel(elements.phaseHost, viewModel);
      renderCityStatusBar(viewModel, elements);
      return viewModel;
    };
    const handleGameplaySliceRendered = (event) => {
      latestGameplaySlice = event?.detail?.gameplaySlice || null;
      updatePhaseStatus();
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
    root.ownerDocument?.addEventListener?.("empire:gameplay-slice-rendered", handleGameplaySliceRendered);

    windowRef?.addEventListener?.("beforeunload", () => {
      if (clockTimerId !== null) {
        windowRef.clearInterval(clockTimerId);
      }
      root.ownerDocument?.removeEventListener?.("empire:gameplay-slice-rendered", handleGameplaySliceRendered);
    }, { once: true });

    return true;
  };

  return {
    bindCityStatusBar
  };
}
