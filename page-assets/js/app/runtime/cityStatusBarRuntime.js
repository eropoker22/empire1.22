import {
  formatEliminationRemainingMs,
  resolveAuthoritativeEliminationCountdown,
  resolveAuthoritativeMatchCountdowns
} from "./authoritativeEliminationCountdown.js";
import { bindSharedCountdown } from "../ui/sharedCountdownTicker.js";

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

  return finalLockdown.scoreGapToTop3 != null && Number.isFinite(Number(finalLockdown.scoreGapToTop3))
    ? formatScoreDelta(finalLockdown.scoreGapToTop3) : "—";
}

function resolveCityStatusPlayerView(options = {}) {
  const gameplaySlice = normalizeObject(options.gameplaySlice);
  const playerView = normalizeObject(options.playerView || gameplaySlice.player);
  return {
    gameplaySlice,
    playerView,
    elimination: normalizeObject(playerView.elimination || gameplaySlice.elimination),
    finalLockdown: normalizeObject(playerView.finalLockdown),
    maxPlayersPerServer: Number(options.maxPlayersPerServer || gameplaySlice.server?.maxPlayersPerServer || 0)
  };
}

function buildBattleRoyaleStatusViewModel(playerOptions = {}) {
  const {
    elimination,
    finalLockdown,
    maxPlayersPerServer
  } = resolveCityStatusPlayerView(playerOptions);
  const finalActive = Boolean(finalLockdown.enabled && (finalLockdown.active || finalLockdown.status === "active"));
  const authoritativeCountdown = resolveAuthoritativeEliminationCountdown(
    playerOptions.gameplaySlice,
    playerOptions.nowMs
  );

  if (finalActive) {
    const clocks = resolveAuthoritativeMatchCountdowns(playerOptions.gameplaySlice, playerOptions.nowMs);
    const clockLabel = (ms) => {
      if (ms === null || !Number.isFinite(ms)) return "—";
      const seconds = Math.max(0, Math.ceil(ms / 1000));
      return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map((part) => String(part).padStart(2, "0")).join(":");
    };
    const rank = Number(finalLockdown.currentPlayerRank);
    const topRankCount = Math.max(1, Math.floor(Number(finalLockdown.topRankCount || 3)));
    return {
      mode: "final",
      secondaryLabel: "Finále",
      secondaryMobileLabel: "Fin",
      secondaryValue: finalLockdown.result ? "ukončeno" : finalLockdown.pausedByQuietHours
        ? `Pauza ${clockLabel(clocks.quietRemainingMs)} · FIN ${clockLabel(clocks.finalActiveMs)}`
        : `${clockLabel(clocks.finalActiveMs)} zbývá`,
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
  const statusValue = elimination.playerStatus && elimination.playerStatus !== "active" ? "DIVÁK" : eliminationsStopped ? "ČEKÁ" : normalizeStatusLabel(elimination.currentPlayerStatus);
  const activePlayers = Number(elimination.activePlayersRemaining);
  const playersValue = elimination.activePlayersRemaining != null && Number.isFinite(activePlayers) && activePlayers >= 0
    ? maxPlayersPerServer > 0 ? `${activePlayers}/${Math.floor(maxPlayersPerServer)}` : `${activePlayers}`
    : "—";
  const secondaryValue = eliminationsStopped
    ? "zastaveno"
    : authoritativeCountdown.state === "quiet_hours"
      ? `za ${formatEliminationRemainingMs(authoritativeCountdown.remainingMs, { compact: true })}`
      : authoritativeCountdown.state === "counting"
        ? `za ${formatEliminationRemainingMs(authoritativeCountdown.remainingMs, { compact: true })}`
        : authoritativeCountdown.state === "evaluating"
          ? "vyhodnocuje se"
          : authoritativeCountdown.state === "paused" ? "server pozastaven"
            : authoritativeCountdown.state === "stale" ? "čekám na data" : authoritativeCountdown.state === "ended" ? "ukončeno" : "čeká se";

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
  elements.status.classList?.toggle?.("is-hold-position", viewModel.statusLabel === "drž pozici");
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
    let unbindAuthoritativeCountdown = null;
    let latestGameplaySlice = null;
    let hiddenAtMs = null;
    const shouldRunLocalTick = () => deps.shouldRunLocalTick?.() !== false;
    const stopClockTimer = () => {
      if (clockTimerId === null) return;
      windowRef?.clearInterval?.(clockTimerId);
      clockTimerId = null;
      deps.onLocalTickActiveChange?.(false);
    };
    const startClockTimer = () => {
      if (clockTimerId !== null || !shouldRunLocalTick() || root.ownerDocument?.hidden) return;
      const intervalMs = Math.max(1, Number(deps.getTickIntervalMs?.(tickMs) || tickMs));
      clockTimerId = windowRef?.setInterval?.(() => {
        if (!shouldRunLocalTick()) {
          stopClockTimer();
          return;
        }
        deps.recordLocalTick?.();
        deps.onTick?.({
          getMapPhaseFromClock: getMapPhaseFromCityMinutes,
          minuteStep,
          phaseHost: elements.phaseHost,
          root,
          updatePhaseStatus
        });
      }, intervalMs) ?? null;
      if (clockTimerId !== null) deps.onLocalTickActiveChange?.(true);
    };
    const restartClockTimer = () => {
      stopClockTimer();
      startClockTimer();
    };
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
      restartClockTimer();
    };
    const handleRuntimeModeChange = () => restartClockTimer();
    const handlePerformanceModeChange = () => restartClockTimer();
    const handleVisibilityChange = () => {
      if (root.ownerDocument?.hidden) {
        hiddenAtMs = Date.now();
        stopClockTimer();
      } else {
        const intervalMs = Math.max(1, Number(deps.getTickIntervalMs?.(tickMs) || tickMs));
        const elapsedTicks = hiddenAtMs === null
          ? 0
          : Math.max(0, Math.floor((Date.now() - hiddenAtMs) / intervalMs));
        hiddenAtMs = null;
        if (elapsedTicks > 0 && shouldRunLocalTick()) {
          deps.recordLocalTick?.(elapsedTicks);
          deps.onTick?.({
            elapsedTicks,
            getMapPhaseFromClock: getMapPhaseFromCityMinutes,
            minuteStep: minuteStep * elapsedTicks,
            phaseHost: elements.phaseHost,
            root,
            updatePhaseStatus
          });
        }
        startClockTimer();
      }
    };

    updatePhaseStatus();
    unbindAuthoritativeCountdown = bindSharedCountdown(elements.dayPhase, () => Date.now(), {
      render: updatePhaseStatus
    });
    if (shouldRunLocalTick()) {
      deps.onInitialSync?.({
        root,
        phaseHost: elements.phaseHost,
        updatePhaseStatus
      });
    }
    startClockTimer();

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
    root.ownerDocument?.addEventListener?.("empire:runtime-mode-changed", handleRuntimeModeChange);
    root.ownerDocument?.addEventListener?.("visibilitychange", handleVisibilityChange);
    windowRef?.addEventListener?.("empire:mobile-performance-mode-changed", handlePerformanceModeChange);

    windowRef?.addEventListener?.("beforeunload", () => {
      stopClockTimer();
      unbindAuthoritativeCountdown?.();
      unbindAuthoritativeCountdown = null;
      root.ownerDocument?.removeEventListener?.("empire:gameplay-slice-rendered", handleGameplaySliceRendered);
      root.ownerDocument?.removeEventListener?.("empire:runtime-mode-changed", handleRuntimeModeChange);
      root.ownerDocument?.removeEventListener?.("visibilitychange", handleVisibilityChange);
      windowRef?.removeEventListener?.("empire:mobile-performance-mode-changed", handlePerformanceModeChange);
    }, { once: true });

    return true;
  };

  return {
    bindCityStatusBar
  };
}
