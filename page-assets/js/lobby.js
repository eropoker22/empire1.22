import {
  MAP_DISTRICT_GEOMETRY_TOP_INSET,
  createDistrictGeometry,
  getDistrictAtPoint
} from "./app/district-geometry.js";
import {
  clearAuthSession,
  DEFAULT_PUBLIC_SERVER_MODE,
  ensureIdentity,
  getActiveServerRegistration,
  getEntryFlowTarget,
  getRegistrationDraft,
  hasLockedFaction,
  saveLobbyStep,
  SERVER_CATALOG
} from "./app/auth-flow.js";

const FACTION_ENTRY_HREF = "./faction.html";
const GAME_ENTRY_HREF = "./game.html";
const LOGIN_ENTRY_HREF = "./login.html";
const DISTRICT_CANVAS_WIDTH = 1600;
const DISTRICT_CANVAS_HEIGHT = 980;
const NIGHT_MAP_IMAGE_PATH = "../img/mapanoc.png";
const LOBBY_STATUS_INITIAL_PLAYERS = 4200;
const LOBBY_STATUS_UPDATE_MS = 5000;
const LOBBY_STATUS_ANIMATION_MS = 1700;
const LOBBY_STATUS_MIN_PLAYERS = 4050;
const LOBBY_STATUS_MAX_PLAYERS = 4380;
const SERVER_LIST_REFRESH_SECONDS = 20;
const SERVER_LIST_ENDPOINT = "/api/servers";
const MATCHMAKING_RESERVE_ENDPOINT = "/api/matchmaking/reserve";
const MATRIX_DIGITS = "0123456789";
const SERVER_COUNTDOWN_OFFSETS_MINUTES = Object.freeze({
  "instance:free:eu-central:public-1": 12
});
const SERVER_LIST_FALLBACK_SOURCE = "dev-static-fallback";
const SERVER_LIST_SERVER_SOURCE = "server-summary";

const LOBBY_NAV_PREVIEWS = Object.freeze({
  city: Object.freeze({
    title: "SERVER",
    message: "Vyber server."
  }),
  gang: Object.freeze({
    title: "MŮJ GANG",
    message: "Mock data gangu."
  }),
  market: Object.freeze({
    title: "OBCHOD",
    message: "Mock nabídka obchodu."
  }),
  settings: Object.freeze({
    title: "NASTAVENÍ",
    message: "Mock nastavení účtu."
  })
});

const formatLobbyPlayerCount = (value) => new Intl.NumberFormat("cs-CZ")
  .format(Math.max(0, Math.round(Number(value) || 0)))
  .replace(/\u00a0/g, " ");

const normalizeLobbyMode = (mode) => {
  const normalized = String(mode || "").trim().toLowerCase();
  return normalized === "free" || normalized === "war" ? normalized : "";
};

const resolveInitialLobbyMode = (registration, activeServerRegistration) => {
  if (activeServerRegistration?.serverMode) {
    return activeServerRegistration.serverMode;
  }
  const requestedMode = normalizeLobbyMode(new URLSearchParams(window.location.search).get("mode"));
  return requestedMode || normalizeLobbyMode(registration?.serverMode) || DEFAULT_PUBLIC_SERVER_MODE;
};

const getServerModeLabel = (mode) => mode === "war" ? "WAR Mode" : "FREE Battle Royale";

function createServerFromSummary(summary) {
  if (!summary || typeof summary !== "object") {
    return null;
  }

  const id = String(summary.serverInstanceId || "").trim();
  const mode = String(summary.mode || "").trim().toLowerCase();
  if (!id || (mode !== "free" && mode !== "war")) {
    return null;
  }

  const playerCount = Math.max(0, Number(summary.playerCount || 0) || 0);
  const maxPlayers = Math.max(1, Number(summary.maxPlayers || 1) || 1);
  const status = String(summary.status || "lobby").toUpperCase();
  const full = playerCount >= maxPlayers;
  const joinable = Boolean(summary.joinable);
  const map = summary.map && typeof summary.map === "object"
    ? {
        totalDistricts: Number(summary.map.totalDistricts || 0) || 0,
        downtownDistricts: Number(summary.map.downtownDistricts || 0) || 0,
        commercialDistricts: Number(summary.map.commercialDistricts || 0) || 0,
        industrialDistricts: Number(summary.map.industrialDistricts || 0) || 0,
        residentialDistricts: Number(summary.map.residentialDistricts || 0) || 0,
        parkDistricts: Number(summary.map.parkDistricts || 0) || 0
      }
    : null;

  return {
    id,
    serverInstanceId: id,
    name: String(summary.displayName || id),
    mode,
    region: String(summary.region || "EU Central"),
    players: playerCount,
    capacity: maxPlayers,
    startLabel: joinable
      ? (mode === "war" ? "Premium režim / dev vstup" : "Začni zdarma")
      : mode === "war" ? "UZAVŘENO" : status,
    badge: mode === "war" && !joinable ? "PŘIPRAVUJEME" : mode === "war" ? "WAR Mode" : "FREE Battle Royale",
    joinPolicy: String(summary.joinPolicy || (joinable ? "open" : "closed")).toLowerCase(),
    status,
    activity: playerCount / maxPlayers > 0.75 ? "HIGH" : playerCount / maxPlayers > 0.35 ? "MEDIUM" : "LOW",
    full,
    closed: !joinable && !full,
    locked: !joinable && !full,
    offline: ["STOPPED", "ENDED", "DESTROYED", "CRASHED"].includes(status),
    riskPercent: Math.round((playerCount / maxPlayers) * 100),
    description: mode === "war"
      ? "WAR Mode: PŘIPRAVUJEME. War režim není dočasně dostupný pro veřejné hráče."
      : `FREE Battle Royale: 20 hráčů, ${map?.totalDistricts || 161} districtů, ${map?.downtownDistricts || 8} downtown. Začni zdarma, město tě rozřeže rychle.`,
    map
  };
}

function mergeServerSummariesWithFallback(serverSummaries, fallbackServers) {
  const serverBacked = serverSummaries.map(createServerFromSummary).filter(Boolean);
  if (serverBacked.length < 1) {
    return Array.isArray(fallbackServers) ? fallbackServers : [];
  }

  const serverBackedIds = new Set(serverBacked.map((server) => server.id));
  const fallbackOnly = (Array.isArray(fallbackServers) ? fallbackServers : [])
    .filter((server) => !serverBackedIds.has(server.id));
  return [...serverBacked, ...fallbackOnly];
}

let lobbyLogoutPrompt = null;
let isLeavingLobby = false;
const LOBBY_HISTORY_ACTIVE_STATE = "active";
const LOBBY_HISTORY_GUARD_STATE = "back-logout";

function markLeavingLobby() {
  isLeavingLobby = true;
}

function promptLobbyLogoutConfirmation() {
  if (lobbyLogoutPrompt) {
    return lobbyLogoutPrompt;
  }

  const modal = document.querySelector("[data-lobby-logout-modal]");
  const confirmButton = document.querySelector("[data-lobby-logout-confirm]");
  const cancelNodes = Array.from(document.querySelectorAll("[data-lobby-logout-cancel]"));

  if (!(modal instanceof HTMLElement) || !(confirmButton instanceof HTMLButtonElement)) {
    return Promise.resolve(window.confirm("Opravdu se chceš odhlásit z lobby?"));
  }

  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  lobbyLogoutPrompt = new Promise((resolve) => {
    const finish = (shouldLogout) => {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-lobby-logout-modal-open");
      confirmButton.removeEventListener("click", confirmLogout);
      cancelNodes.forEach((node) => node.removeEventListener("click", cancelLogout));
      window.removeEventListener("keydown", handleKeydown);
      if (!shouldLogout) {
        previouslyFocused?.focus?.();
      }
      lobbyLogoutPrompt = null;
      resolve(shouldLogout);
    };

    const confirmLogout = () => finish(true);
    const cancelLogout = () => finish(false);
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelLogout();
      }
    };

    confirmButton.addEventListener("click", confirmLogout);
    cancelNodes.forEach((node) => node.addEventListener("click", cancelLogout));
    window.addEventListener("keydown", handleKeydown);

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-lobby-logout-modal-open");
    confirmButton.focus();
  });

  return lobbyLogoutPrompt;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!ensureIdentity()) {
    markLeavingLobby();
    window.location.href = LOGIN_ENTRY_HREF;
    return;
  }

  installLobbyBackLogoutGuard();

  const registration = getRegistrationDraft();
  const lobbyRoot = document.querySelector("#lobby-root");
  const tabs = Array.from(document.querySelectorAll("[data-server-mode-tab]"));
  const list = document.querySelector("[data-server-list]");
  const userLabel = document.querySelector("[data-lobby-user]");
  const userMeta = document.querySelector("[data-lobby-user-meta]");
  const profileCard = document.querySelector("[data-lobby-profile-card]");
  const summaryServer = document.querySelector("[data-lobby-summary-server]");
  const summaryDistrict = document.querySelector("[data-lobby-summary-district]");
  const summaryMode = document.querySelector("[data-lobby-summary-mode]");
  const summaryCells = {
    server: document.querySelector("[data-lobby-summary-cell='server']"),
    mode: document.querySelector("[data-lobby-summary-cell='mode']"),
    district: document.querySelector("[data-lobby-summary-cell='district']")
  };
  const topUserLabel = document.querySelector("[data-lobby-top-user]");
  const navButtons = Array.from(document.querySelectorAll("[data-lobby-nav-target]"));
  const lobbyViews = Array.from(document.querySelectorAll("[data-lobby-view]"));
  const flowNote = document.querySelector("[data-lobby-flow-note]");
  const lobbyDetailName = document.querySelector("[data-lobby-detail-name]");
  const lobbyDetailRegion = document.querySelector("[data-lobby-detail-region]");
  const lobbyDetailStatus = document.querySelector("[data-lobby-detail-status]");
  const lobbyDetailMode = document.querySelector("[data-lobby-detail-mode]");
  const lobbyDetailCapacity = document.querySelector("[data-lobby-detail-capacity]");
  const lobbyDetailStart = document.querySelector("[data-lobby-detail-start]");
  const lobbyDetailDescription = document.querySelector("[data-lobby-detail-description]");
  const lobbyRiskRing = document.querySelector("[data-lobby-risk-ring]");
  const lobbyRiskValue = document.querySelector("[data-lobby-risk-value]");
  const lobbyOpenSelectedButton = document.querySelector("[data-lobby-open-selected]");
  const lobbyEnterSelectedButton = document.querySelector("[data-lobby-enter-selected]");
  const lobbyStatusCount = document.querySelector("[data-lobby-status-count]");
  const lobbyRefreshCountdown = document.querySelector("[data-lobby-refresh-countdown]");
  const lobbyRefreshCountdownShell = lobbyRefreshCountdown?.closest(".lobby-refresh-countdown") || null;
  const modeTabsShell = document.querySelector(".auth-mode-tabs");
  const serverListShell = document.querySelector(".lobby-server-list-only");
  const detailColumn = document.querySelector(".lobby-detail-column");
  const activeServerCard = document.querySelector("[data-lobby-active-server-card]");
  const activeServerName = document.querySelector("[data-active-server-name]");
  const activeServerMode = document.querySelector("[data-active-server-mode]");
  const activeServerStatus = document.querySelector("[data-active-server-status]");
  const activeServerDistrict = document.querySelector("[data-active-server-district]");
  const activeServerNote = document.querySelector("[data-active-server-note]");
  const activeServerContinueButton = document.querySelector("[data-lobby-continue-active]");

  const detailModal = document.querySelector("[data-server-detail-modal]");
  const detailModalTitle = document.querySelector("[data-server-detail-title]");
  const detailModalSubtitle = document.querySelector("[data-server-detail-subtitle]");
  const detailModalMode = document.querySelector("[data-server-detail-mode]");
  const detailModalCapacity = document.querySelector("[data-server-detail-capacity]");
  const detailModalStart = document.querySelector("[data-server-detail-start]");
  const detailModalCountdown = document.querySelector("[data-server-detail-countdown]");
  const detailModalHint = document.querySelector("[data-server-detail-hint]");
  const detailModalTypeCounts = document.querySelector("[data-server-detail-type-counts]");
  const detailModalMaterials = document.querySelector("[data-server-detail-materials]");
  const detailCanvas = document.querySelector("[data-server-detail-map]");
  const detailCanvasShell = document.querySelector("[data-server-detail-map-shell]");
  const detailContinueButton = document.querySelector("[data-server-detail-continue]");
  const detailZoomInButton = document.querySelector("[data-server-detail-zoom-in]");
  const detailZoomOutButton = document.querySelector("[data-server-detail-zoom-out]");
  const detailCloseNodes = Array.from(document.querySelectorAll("[data-server-detail-close]"));

  const geometry = createDistrictGeometry(DISTRICT_CANVAS_WIDTH, DISTRICT_CANVAS_HEIGHT, 0, MAP_DISTRICT_GEOMETRY_TOP_INSET, 0);
  const minSpawnColumnIndex = Math.min(...geometry.districts.map((district) => district.columnIndex));
  const maxSpawnColumnIndex = Math.max(...geometry.districts.map((district) => district.columnIndex));
  const maxSpawnRowIndex = Math.max(...geometry.districts.map((district) => district.rowIndex));
  const nightMapImage = new Image();
  nightMapImage.src = NIGHT_MAP_IMAGE_PATH;
  nightMapImage.addEventListener("load", () => renderAllCanvases());
  const selectableSpawnDistrictIds = new Set(
    geometry.districts
      .filter((district) => (
        district.columnIndex === minSpawnColumnIndex
        || district.columnIndex === maxSpawnColumnIndex
        || district.rowIndex === maxSpawnRowIndex
      ))
      .map((district) => district.id)
  );
  let availableServers = Array.isArray(SERVER_CATALOG) ? SERVER_CATALOG : [];
  let serverListSource = SERVER_LIST_FALLBACK_SOURCE;
  const activeServerRegistration = getActiveServerRegistration(registration);
  const isActiveServerEntry = Boolean(activeServerRegistration);
  const state = {
    mode: resolveInitialLobbyMode(registration, activeServerRegistration),
    serverId: activeServerRegistration?.serverId || "",
    hoveredDistrictId: null,
    selectedDistrictId: activeServerRegistration?.preferredStartDistrictId || activeServerRegistration?.startDistrictId || null,
    serverDistrictSelections: new Map(),
    launchByServerId: Object.fromEntries(
      Object.entries(SERVER_COUNTDOWN_OFFSETS_MINUTES).map(([serverId, minutes]) => [
        serverId,
        Date.now() + (minutes * 60 * 1000)
      ])
    ),
    countdownTimer: null,
    detailZoom: 1,
    detailPanX: 0,
    detailPanY: 0,
    activePanPointerId: null,
    detailIsPinching: false,
    detailPinchStartDistance: 0,
    detailPinchStartZoom: 1,
    detailPinchStartMidX: 0,
    isReservingServer: false,
    detailPinchStartMidY: 0,
    detailPinchOriginX: 0,
    detailPinchOriginY: 0,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
    panningMoved: false,
    suppressNextMapClick: false,
    serverRefreshSecondsRemaining: SERVER_LIST_REFRESH_SECONDS
  };
  let activeLobbyNav = "city";
  const detailMapPointers = new Map();

  const normalizeSelectableDistrictId = (districtId) => {
    const normalizedDistrictId = Number.parseInt(String(districtId || ""), 10) || 0;
    return selectableSpawnDistrictIds.has(normalizedDistrictId) ? normalizedDistrictId : null;
  };

  const isSelectableSpawnDistrict = (district) => Boolean(district && selectableSpawnDistrictIds.has(Number(district.id || 0)));

  const startLobbyStatusTicker = () => {
    if (!(lobbyStatusCount instanceof HTMLElement)) {
      return;
    }

    let currentCount = LOBBY_STATUS_INITIAL_PLAYERS;
    let direction = 1;
    let animationFrame = 0;

    const renderStatusCount = (value, isScrambling = false) => {
      const countText = typeof value === "string" ? value : formatLobbyPlayerCount(value);
      lobbyStatusCount.textContent = `${countText} hráčů`;
      lobbyStatusCount.classList.toggle("is-scrambling", isScrambling);
    };

    const scrambleCountText = (value) => formatLobbyPlayerCount(value).replace(/\d/g, (digit) => (
      Math.random() < 0.38 ? MATRIX_DIGITS[Math.floor(Math.random() * MATRIX_DIGITS.length)] : digit
    ));

    const animateStatusCount = (targetCount) => {
      window.cancelAnimationFrame(animationFrame);
      const startCount = currentCount;
      const startTime = performance.now();

      const tick = (now) => {
        const progress = Math.min(1, (now - startTime) / LOBBY_STATUS_ANIMATION_MS);
        const easedProgress = 1 - ((1 - progress) ** 3);
        const visibleCount = Math.round(startCount + ((targetCount - startCount) * easedProgress));

        renderStatusCount(progress < 0.88 ? scrambleCountText(visibleCount) : visibleCount, progress < 0.96);

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(tick);
          return;
        }

        currentCount = targetCount;
        renderStatusCount(currentCount);
      };

      animationFrame = window.requestAnimationFrame(tick);
    };

    const queueNextStatusCount = () => {
      const delta = 45 + Math.floor(Math.random() * 185);
      let targetCount = currentCount + (direction * delta);

      if (targetCount < LOBBY_STATUS_MIN_PLAYERS || targetCount > LOBBY_STATUS_MAX_PLAYERS) {
        direction *= -1;
        targetCount = currentCount + (direction * delta);
      }

      direction *= -1;
      animateStatusCount(targetCount);
    };

    renderStatusCount(currentCount);
    window.setInterval(queueNextStatusCount, LOBBY_STATUS_UPDATE_MS);
  };

  state.selectedDistrictId = normalizeSelectableDistrictId(state.selectedDistrictId);
  state.serverDistrictSelections = new Map(
    Array.from(state.serverDistrictSelections.entries())
      .map(([serverId, districtId]) => [serverId, normalizeSelectableDistrictId(districtId)])
      .filter(([, districtId]) => Boolean(districtId))
  );

  const drawPolygon = (context, polygon) => {
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return;
    }

    context.beginPath();
    context.moveTo(polygon[0].x, polygon[0].y);
    for (let index = 1; index < polygon.length; index += 1) {
      context.lineTo(polygon[index].x, polygon[index].y);
    }
    context.closePath();
  };

  const getDistrictVisuals = (districtType) => {
    switch (districtType) {
      case "downtown":
        return {
          idleFill: "rgba(255, 78, 196, 0.08)",
          idleStroke: "rgba(255, 103, 208, 0.3)",
          hoverFill: "rgba(255, 78, 196, 0.24)",
          hoverStroke: "rgba(255, 128, 220, 0.98)",
          selectedFill: "rgba(255, 78, 196, 0.34)",
          selectedStroke: "rgba(255, 181, 234, 0.98)",
          glow: "rgba(255, 78, 196, 0.62)",
          label: "#ffe2f6"
        };
      case "park":
        return {
          idleFill: "rgba(75, 214, 126, 0.08)",
          idleStroke: "rgba(98, 231, 147, 0.28)",
          hoverFill: "rgba(75, 214, 126, 0.22)",
          hoverStroke: "rgba(144, 255, 184, 0.96)",
          selectedFill: "rgba(75, 214, 126, 0.3)",
          selectedStroke: "rgba(196, 255, 214, 0.98)",
          glow: "rgba(75, 214, 126, 0.56)",
          label: "#e6ffe9"
        };
      case "industrial":
        return {
          idleFill: "rgba(156, 163, 175, 0.08)",
          idleStroke: "rgba(196, 203, 212, 0.26)",
          hoverFill: "rgba(156, 163, 175, 0.2)",
          hoverStroke: "rgba(221, 227, 234, 0.94)",
          selectedFill: "rgba(156, 163, 175, 0.28)",
          selectedStroke: "rgba(244, 247, 250, 0.98)",
          glow: "rgba(196, 203, 212, 0.44)",
          label: "#f3f6fa"
        };
      case "commercial":
        return {
          idleFill: "rgba(68, 172, 255, 0.08)",
          idleStroke: "rgba(94, 191, 255, 0.26)",
          hoverFill: "rgba(68, 172, 255, 0.22)",
          hoverStroke: "rgba(144, 216, 255, 0.96)",
          selectedFill: "rgba(68, 172, 255, 0.3)",
          selectedStroke: "rgba(212, 241, 255, 0.98)",
          glow: "rgba(68, 172, 255, 0.56)",
          label: "#e4f6ff"
        };
      case "residential":
        return {
          idleFill: "rgba(244, 196, 48, 0.08)",
          idleStroke: "rgba(255, 214, 88, 0.28)",
          hoverFill: "rgba(244, 196, 48, 0.24)",
          hoverStroke: "rgba(255, 226, 128, 0.98)",
          selectedFill: "rgba(244, 196, 48, 0.34)",
          selectedStroke: "rgba(255, 241, 187, 0.98)",
          glow: "rgba(244, 196, 48, 0.62)",
          label: "#fff2c6"
        };
      default:
        return {
          idleFill: "rgba(168, 176, 190, 0.12)",
          idleStroke: "rgba(148, 163, 184, 0.18)",
          hoverFill: "rgba(168, 176, 190, 0.2)",
          hoverStroke: "rgba(214, 221, 229, 0.92)",
          selectedFill: "rgba(201, 214, 228, 0.28)",
          selectedStroke: "rgba(244, 247, 250, 0.96)",
          glow: "rgba(201, 214, 228, 0.42)",
          label: "#f4f7fa"
        };
    }
  };

  const formatRemaining = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  };

  const getServerCountdownText = (serverId) => {
    const server = availableServers.find((entry) => entry.id === serverId);
    if (server?.full || server?.locked || server?.offline) {
      return "";
    }
    const launchAt = Number(state.launchByServerId[serverId] || 0);
    if (!launchAt) {
      return "";
    }
    const msRemaining = launchAt - Date.now();
    if (msRemaining <= 0) {
      return "Start probíhá";
    }
    return `Začíná za ${formatRemaining(msRemaining)}`;
  };

  const getDistrictTypeCounts = (server = getSelectedServer()) => {
    const map = server?.map || null;
    if (map) {
      return [
        ["downtown", map.downtownDistricts],
        ["commercial", map.commercialDistricts],
        ["industrial", map.industrialDistricts],
        ["residential", map.residentialDistricts],
        ["park", map.parkDistricts]
      ].filter(([, count]) => Number(count) > 0);
    }

    const counts = new Map();
    for (const district of geometry.districts) {
      const key = String(district.districtType || "other");
      counts.set(key, Number(counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries());
  };

  const renderTypeCountMarkup = (server = getSelectedServer()) => getDistrictTypeCounts(server).map(([type, count]) => `
    <span class="server-detail-modal__type-count is-${type}">
      <strong>${type}</strong>
      <b>${count}</b>
    </span>
  `).join("");

  const getNearestDistrict = (point) => {
    if (!point) {
      return null;
    }

    let nearestDistrict = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const district of geometry.districts) {
      const distance = ((district.centerX - point.x) ** 2) + ((district.centerY - point.y) ** 2);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDistrict = district;
      }
    }

    return nearestDistrict;
  };

  const getVisibleServers = () => {
    const matches = availableServers.filter((server) => server.mode === state.mode);
    return matches;
  };

  const getSelectedServer = () => availableServers.find((entry) => entry.id === state.serverId) || null;
  const isServerUnavailable = (server) => Boolean(server?.full || server?.locked || server?.offline);
  const getServerRiskPercent = (server) => Math.max(0, Math.min(100, Math.round(
    Number(server?.riskPercent ?? server?.riskPct ?? server?.heat ?? 0) || 0
  )));

  const isDetailModalOpen = () => detailModal instanceof HTMLElement && !detailModal.classList.contains("hidden");

  const openDetailModal = () => {
    if (detailModal instanceof HTMLElement) {
      detailModal.classList.remove("hidden");
      detailModal.setAttribute("aria-hidden", "false");
    }
    renderAllCanvases();
    window.requestAnimationFrame(renderAllCanvases);
  };

  const getDetailPanLimits = () => {
    if (!(detailCanvasShell instanceof HTMLElement)) {
      return { x: 0, y: 0 };
    }

    const rect = detailCanvasShell.getBoundingClientRect();
    const zoomOverflow = Math.max(0, state.detailZoom - 1);
    return {
      x: Math.max(0, (rect.width * zoomOverflow) / 2),
      y: Math.max(0, (rect.height * zoomOverflow) / 2)
    };
  };

  const clampDetailPan = (x, y) => {
    const limits = getDetailPanLimits();
    return {
      x: Math.min(limits.x, Math.max(-limits.x, Number(x) || 0)),
      y: Math.min(limits.y, Math.max(-limits.y, Number(y) || 0))
    };
  };

  const setCanvasScale = (shell, zoomValue) => {
    if (!(shell instanceof HTMLElement)) {
      return;
    }

    shell.style.setProperty("--server-map-zoom", String(zoomValue));
    shell.style.setProperty("--server-map-scale", String(zoomValue));
  };

  const setDetailPan = (x, y) => {
    if (!(detailCanvasShell instanceof HTMLElement)) {
      return;
    }

    const nextPan = state.detailZoom > 1.02 ? clampDetailPan(x, y) : { x: 0, y: 0 };
    state.detailPanX = nextPan.x;
    state.detailPanY = nextPan.y;
    detailCanvasShell.style.setProperty("--server-map-offset-x", `${nextPan.x}px`);
    detailCanvasShell.style.setProperty("--server-map-offset-y", `${nextPan.y}px`);
  };

  const syncDetailZoomUi = () => {
    if (detailZoomOutButton instanceof HTMLButtonElement) {
      detailZoomOutButton.disabled = state.detailZoom <= 1;
    }
    if (detailZoomInButton instanceof HTMLButtonElement) {
      detailZoomInButton.disabled = state.detailZoom >= 1.72;
    }
    if (detailCanvasShell instanceof HTMLElement) {
      detailCanvasShell.classList.toggle("is-map-draggable", state.detailZoom > 1.02);
    }
  };

  const applyDetailZoom = (zoomValue) => {
    const nextZoom = Math.min(1.72, Math.max(1, Number(zoomValue) || 1));
    state.detailZoom = nextZoom;
    setCanvasScale(detailCanvasShell, nextZoom);
    setDetailPan(state.detailPanX, state.detailPanY);
    syncDetailZoomUi();
  };

  const createReservedServer = (server, reservation) => ({
    ...(server || {}),
    id: reservation.serverInstanceId,
    serverInstanceId: reservation.serverInstanceId,
    name: reservation.displayName || server?.name || reservation.serverInstanceId,
    mode: reservation.mode || server?.mode || state.mode,
    region: reservation.region || server?.region || "EU Central",
    status: server?.status || "RESERVED",
    joinTicket: reservation.joinTicket || ""
  });

  const reserveSelectedServer = async (server) => {
    const identity = String(getRegistrationDraft()?.identity || "").trim();
    if (!server || typeof fetch !== "function" || !identity) {
      return server;
    }

    try {
      const response = await fetch(MATCHMAKING_RESERVE_ENDPOINT, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          playerId: identity,
          accountId: identity,
          mode: server.mode,
          preferredRegion: server.region,
          preferredServerInstanceId: server.serverInstanceId || server.id
        })
      });
      if (!response.ok) return server;
      const payload = await response.json();
      return payload?.accepted && payload.reservation
        ? createReservedServer(server, payload.reservation)
        : server;
    } catch (_error) {
      return server;
    }
  };

  const commitLobbySelection = async () => {
    const server = getSelectedServer();
    if (!state.serverId || !state.selectedDistrictId || isServerUnavailable(server) || state.isReservingServer) {
      return;
    }

    state.isReservingServer = true;
    updateLobbySummary();
    const reservedServer = await reserveSelectedServer(server);
    const session = saveLobbyStep({
      serverId: reservedServer.serverInstanceId || reservedServer.id || state.serverId,
      districtId: state.selectedDistrictId,
      server: reservedServer
    });
    state.isReservingServer = false;

    if (!session) {
      updateLobbySummary();
      updateDetailModal();
      return;
    }

    markLeavingLobby();
    window.location.href = getEntryDestinationHref();
  };

  const confirmDetailDistrictSelection = () => {
    const server = getSelectedServer();
    const isUnavailable = isServerUnavailable(server);
    if (!state.serverId || !state.selectedDistrictId || isUnavailable) {
      if (detailModalHint) {
        detailModalHint.textContent = !state.serverId
          ? "Vyber server"
          : isUnavailable
            ? (server?.full ? "Server je plný" : server?.offline ? "Server je offline" : "Server se připravuje")
            : "Vyber preferovanou startovní oblast";
        detailModalHint.classList.add("is-required");
      }
      return;
    }

    updateLobbySummary();
    updateDetailModal();
    closeDetailModal();
  };

  const updateCountdowns = () => {
    if (list instanceof HTMLElement) {
      list.querySelectorAll("[data-server-countdown]").forEach((node) => {
        const serverId = String(node.getAttribute("data-server-countdown") || "");
        node.textContent = getServerCountdownText(serverId);
      });
    }
    if (detailModalCountdown && state.serverId) {
      detailModalCountdown.textContent = getServerCountdownText(state.serverId);
    }
  };

  const ensureCountdownTicker = () => {
    if (state.countdownTimer) {
      return;
    }
    state.countdownTimer = window.setInterval(updateCountdowns, 1000);
  };

  const drawMapImageCover = (context, image, width, height) => {
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = width / height;
    const drawWidth = imageRatio > canvasRatio ? height * imageRatio : width;
    const drawHeight = imageRatio > canvasRatio ? height : width / imageRatio;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  };

  const renderCanvasTo = (targetCanvas) => {
    if (!(targetCanvas instanceof HTMLCanvasElement)) {
      return;
    }

    const context = targetCanvas.getContext("2d");
    if (!context) {
      return;
    }

    const selectedServer = getSelectedServer();
    const isUnavailable = isServerUnavailable(selectedServer);
    const isDisabled = !state.serverId || isUnavailable;
    context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    if (nightMapImage.complete && nightMapImage.naturalWidth > 0) {
      drawMapImageCover(context, nightMapImage, targetCanvas.width, targetCanvas.height);
    } else {
      const gradient = context.createLinearGradient(0, 0, targetCanvas.width, targetCanvas.height);
      gradient.addColorStop(0, "#07111e");
      gradient.addColorStop(0.5, "#0c1b2f");
      gradient.addColorStop(1, "#050911");
      context.fillStyle = gradient;
      context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    }
    context.fillStyle = "rgba(2, 6, 16, 0.42)";
    context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    for (const district of geometry.districts) {
      const isSelectable = isSelectableSpawnDistrict(district);
      const isSelected = district.id === state.selectedDistrictId;
      const isHovered = district.id === state.hoveredDistrictId;
      const districtVisuals = getDistrictVisuals(district.districtType);

      drawPolygon(context, district.polygon);
      context.fillStyle = isDisabled
        ? "rgba(148, 163, 184, 0.08)"
        : isSelected
          ? districtVisuals.selectedFill
          : isHovered
            ? districtVisuals.hoverFill
          : isSelectable
            ? "rgba(103, 225, 255, 0.11)"
            : districtVisuals.idleFill
              ? districtVisuals.idleFill
              : "rgba(9, 16, 28, 0.22)";
      context.fill();

      drawPolygon(context, district.polygon);
      context.strokeStyle = isDisabled
        ? "rgba(148, 163, 184, 0.24)"
        : isSelected
          ? districtVisuals.selectedStroke
          : isHovered
            ? districtVisuals.hoverStroke
          : isSelectable
            ? "rgba(245, 250, 255, 0.74)"
            : districtVisuals.idleStroke;
      context.lineWidth = isSelected ? 3 : isHovered ? 2.8 : isSelectable ? 1.15 : 0.9;
      context.shadowBlur = isHovered ? 16 : 0;
      context.shadowColor = isHovered ? districtVisuals.glow : "transparent";
      context.stroke();
      context.shadowBlur = 0;

      if (!isDisabled && isSelectable && (isSelected || isHovered)) {
        context.save();
        context.font = "700 18px Bahnschrift, Segoe UI, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = districtVisuals.label;
        context.shadowBlur = isSelected ? 18 : 14;
        context.shadowColor = districtVisuals.glow;
        context.fillText(`D${district.id}`, district.centerX, district.centerY);
        context.restore();
      }
    }

    if (isDisabled) {
      context.save();
      context.fillStyle = "rgba(4, 7, 14, 0.56)";
      context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
      context.fillStyle = "rgba(214, 244, 255, 0.86)";
      context.font = "700 34px Bahnschrift, Segoe UI, sans-serif";
      context.textAlign = "center";
      context.fillText(state.serverId ? "Server není dostupný" : "Nejdřív vyber server", targetCanvas.width / 2, targetCanvas.height / 2);
      context.restore();
    }
  };

  const renderAllCanvases = () => {
    if (isDetailModalOpen()) {
      renderCanvasTo(detailCanvas);
    }
  };

  const setHidden = (element, hidden) => {
    if (element instanceof HTMLElement) {
      element.hidden = hidden;
    }
  };

  const getEntryDestinationHref = () => {
    const target = getEntryFlowTarget(getRegistrationDraft());
    if (target === "game") {
      return GAME_ENTRY_HREF;
    }
    if (target === "faction") {
      return FACTION_ENTRY_HREF;
    }
    if (target === "login") {
      return LOGIN_ENTRY_HREF;
    }
    return "./lobby.html";
  };

  const renderActiveServerEntry = () => {
    setHidden(activeServerCard, !isActiveServerEntry);
    setHidden(modeTabsShell, isActiveServerEntry);
    setHidden(serverListShell, isActiveServerEntry);
    setHidden(lobbyRefreshCountdownShell, isActiveServerEntry);
    setHidden(detailColumn, isActiveServerEntry || activeLobbyNav !== "city");

    if (!isActiveServerEntry || !activeServerRegistration) {
      return;
    }

    if (activeServerName) {
      activeServerName.textContent = activeServerRegistration.serverName || "Server";
    }
    if (activeServerMode) {
      activeServerMode.textContent = getServerModeLabel(activeServerRegistration.serverMode || DEFAULT_PUBLIC_SERVER_MODE);
    }
    if (activeServerStatus) {
      activeServerStatus.textContent = activeServerRegistration.serverStatus || "ONLINE";
    }
    if (activeServerDistrict) {
      activeServerDistrict.textContent = activeServerRegistration.preferredStartDistrictId
        ? `Preferovaná oblast: District ${activeServerRegistration.preferredStartDistrictId}`
        : "-";
    }
    if (activeServerNote) {
      activeServerNote.textContent = hasLockedFaction(registration)
        ? "Tvoje frakce je pro tento server uzamčená. Frakci pro tento server už nejde změnit."
        : "Vyber frakci pro tuto válku.";
    }
  };

  const updateLobbySummary = () => {
    const server = getSelectedServer();
    const playerName = registration?.identity || "Host";

    if (userLabel) {
      userLabel.textContent = playerName;
    }

    if (topUserLabel) {
      topUserLabel.textContent = playerName;
    }

    if (userMeta) {
      userMeta.textContent = isActiveServerEntry
        ? "Jsi zapsaný na serveru."
        : registration?.isGuest
          ? "Host účet · po výběru serveru pokračuješ do frakce"
          : "Vyber server a preferovanou startovní oblast";
    }

    if (summaryServer) {
      summaryServer.textContent = server?.name || "Nevybrán";
    }

    if (summaryDistrict) {
      summaryDistrict.textContent = state.selectedDistrictId
        ? `Preferovaná oblast: District ${state.selectedDistrictId}`
        : "Nevybrán";
    }

    if (summaryMode) {
      summaryMode.textContent = server ? getServerModeLabel(server.mode) : getServerModeLabel(state.mode);
    }

    summaryCells.server?.setAttribute("data-summary-state", server ? "selected" : "missing");
    summaryCells.mode?.setAttribute("data-summary-state", state.mode ? "selected" : "missing");
    summaryCells.district?.setAttribute("data-summary-state", state.selectedDistrictId ? "selected" : "missing");

    profileCard?.setAttribute("data-server-state", server ? "selected" : "missing");

    if (flowNote) {
      flowNote.hidden = isActiveServerEntry || Boolean(server || state.selectedDistrictId);
      flowNote.textContent = !server
        ? "Vyber server a preferovanou startovní oblast."
        : "";
      flowNote.setAttribute("data-state", state.selectedDistrictId ? "success" : "ready");
    }

    if (lobbyDetailName) {
      lobbyDetailName.textContent = server?.name || "Detaily serveru";
    }
    if (lobbyDetailRegion) {
      lobbyDetailRegion.textContent = server?.region || "EU Central";
    }
    if (lobbyDetailStatus) {
      lobbyDetailStatus.textContent = server ? String(server.map?.totalDistricts || 0) : "-";
    }
    if (lobbyDetailMode) {
      lobbyDetailMode.textContent = getServerModeLabel(server?.mode || state.mode || DEFAULT_PUBLIC_SERVER_MODE);
    }
    if (lobbyDetailCapacity) {
      lobbyDetailCapacity.textContent = server ? `${server.players} / ${server.capacity}` : "-";
    }
    if (lobbyDetailStart) {
      lobbyDetailStart.textContent = server
        ? `${server.startLabel || server.status}. Finální spawn potvrzuje server.`
        : "-";
    }
    if (lobbyDetailDescription) {
      lobbyDetailDescription.textContent = server?.description || "Vyber server pro detail.";
    }
    if (lobbyRiskRing instanceof HTMLElement || lobbyRiskValue) {
      const riskPercent = getServerRiskPercent(server);
      if (lobbyRiskRing instanceof HTMLElement) {
        lobbyRiskRing.style.setProperty("--risk-value", `${riskPercent}%`);
        lobbyRiskRing.setAttribute("aria-label", `Riziko ${riskPercent} procent`);
      }
      if (lobbyRiskValue) {
        lobbyRiskValue.textContent = `${riskPercent} %`;
      }
    }
    if (lobbyOpenSelectedButton instanceof HTMLButtonElement) {
      lobbyOpenSelectedButton.disabled = !server || isServerUnavailable(server);
    }
    if (lobbyEnterSelectedButton instanceof HTMLButtonElement) {
      lobbyEnterSelectedButton.disabled = state.isReservingServer || !state.serverId || !state.selectedDistrictId || isServerUnavailable(server);
      if (state.isReservingServer) {
        lobbyEnterSelectedButton.textContent = "REZERVUJI SERVER...";
      } else {
        lobbyEnterSelectedButton.innerHTML = server?.mode === "war"
          ? (isServerUnavailable(server) ? "UZAVŘENO" : "VSTOUPIT DO WAR / DEV <span>›</span>")
          : "ZAČNI ZDARMA <span>›</span>";
      }
    }
    renderActiveServerEntry();
  };

  const syncLobbyNav = () => {
    navButtons.forEach((button) => {
      const isActive = button.getAttribute("data-lobby-nav-target") === activeLobbyNav;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    lobbyViews.forEach((view) => {
      view.hidden = view.getAttribute("data-lobby-view") !== activeLobbyNav;
    });
    renderActiveServerEntry();
  };

  const syncModeTabs = () => {
    if (lobbyRoot instanceof HTMLElement) {
      lobbyRoot.setAttribute("data-lobby-mode", state.mode);
    }
    document.body?.setAttribute("data-lobby-mode", state.mode);

    tabs.forEach((tab) => {
      const isActive = String(tab.getAttribute("data-server-mode-tab") || "") === state.mode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
  };

  const selectServerById = (nextServerId, { openModal = true } = {}) => {
    if (isActiveServerEntry) {
      return;
    }

    const nextServer = availableServers.find((entry) => entry.id === nextServerId);
    if (!nextServer) {
      return;
    }

    const previousServerId = state.serverId;
    state.mode = nextServer.mode;
    state.serverId = nextServer.id;
    if (isServerUnavailable(nextServer)) {
      state.selectedDistrictId = null;
      state.serverDistrictSelections.delete(nextServer.id);
    } else if (nextServer.id !== previousServerId) {
      state.selectedDistrictId = Number(state.serverDistrictSelections.get(nextServer.id) || 0) || null;
    }
    syncModeTabs();
    renderServerList();
    updateLobbySummary();
    updateDetailModal();
    applyDetailZoom(1);
    if (openModal && !isServerUnavailable(nextServer)) {
      openDetailModal();
    }
  };

  const updateDetailModal = () => {
    const server = getSelectedServer();
    if (!server) {
      if (detailModalTitle) {
        detailModalTitle.textContent = "Server detail";
      }
      if (detailModalSubtitle) {
        detailModalSubtitle.textContent = "";
      }
      if (detailModalMode) {
        detailModalMode.textContent = "";
      }
      if (detailModalCapacity) {
        detailModalCapacity.textContent = "";
      }
      if (detailModalStart) {
        detailModalStart.textContent = "";
      }
      if (detailModalCountdown) {
        detailModalCountdown.textContent = "";
      }
      if (detailContinueButton instanceof HTMLButtonElement) {
        detailContinueButton.disabled = true;
      }
      if (lobbyEnterSelectedButton instanceof HTMLButtonElement) {
        lobbyEnterSelectedButton.disabled = true;
      }
      if (detailModalHint) {
        detailModalHint.textContent = "Vyber server";
        detailModalHint.classList.add("is-required");
      }
      if (detailModalTypeCounts instanceof HTMLElement) {
        detailModalTypeCounts.innerHTML = "";
      }
      if (detailModalMaterials instanceof HTMLElement) {
        detailModalMaterials.innerHTML = "";
      }
      return;
    }

    const serverUnavailable = isServerUnavailable(server);
    if (detailModalTitle) {
      detailModalTitle.textContent = server.name;
    }
    if (detailModalSubtitle) {
      detailModalSubtitle.textContent = server.description;
    }
    if (detailModalMode) {
      detailModalMode.textContent = `Režim: ${getServerModeLabel(server.mode)}`;
    }
    if (detailModalCapacity) {
      detailModalCapacity.textContent = `Kapacita: ${server.players}/${server.capacity}`;
    }
    if (detailModalStart) {
      detailModalStart.textContent = `Status: ${server.startLabel}`;
    }
    if (detailModalCountdown) {
      detailModalCountdown.textContent = getServerCountdownText(server.id);
    }
    if (detailModalHint) {
      detailModalHint.textContent = serverUnavailable
        ? (server.full ? "Server je plný" : server.offline ? "Server je offline" : "Server se připravuje")
        : state.selectedDistrictId
          ? `District ${state.selectedDistrictId} vybrán. Finální spawn potvrdí server.`
          : "Vyber okrajový district. Finální spawn potvrdí server.";
      detailModalHint.classList.toggle("is-required", serverUnavailable || !state.selectedDistrictId);
    }
    if (detailContinueButton instanceof HTMLButtonElement) {
      detailContinueButton.disabled = !state.serverId || !state.selectedDistrictId || serverUnavailable;
    }
    if (lobbyEnterSelectedButton instanceof HTMLButtonElement) {
      lobbyEnterSelectedButton.disabled = !state.serverId || !state.selectedDistrictId || serverUnavailable;
    }
    if (detailModalTypeCounts instanceof HTMLElement) {
      detailModalTypeCounts.innerHTML = renderTypeCountMarkup(server);
    }
    if (detailModalMaterials instanceof HTMLElement) {
      detailModalMaterials.innerHTML = [
        server.mode === "war"
          ? "<li>WAR režim se připravuje.</li>"
          : "<li>FREE BR: 20 hráčů.</li>",
        "<li>Spawn potvrdí server.</li>",
        `<li>${server.map?.totalDistricts || geometry.districts.length} districtů, ${server.map?.downtownDistricts || getDistrictTypeCounts(server).find(([type]) => type === "downtown")?.[1] || 0} downtown.</li>`
      ].join("");
    }
  };

  const renderServerList = () => {
    if (!list) {
      return;
    }
    if (isActiveServerEntry) {
      list.innerHTML = "";
      return;
    }

    const servers = getVisibleServers();
    const recommendedServer = servers.find((server) => !isServerUnavailable(server)) || servers[0] || null;
    list.innerHTML = servers.map((server) => `
      <button type="button" class="auth-server-card ${server.id === state.serverId ? "is-selected" : ""} ${recommendedServer?.id === server.id ? "is-recommended" : ""} ${server.locked ? "is-locked" : ""} ${server.full ? "is-full" : ""} ${server.offline ? "is-offline" : ""}" data-server-card="${server.id}" data-server-mode="${server.mode}" ${recommendedServer?.id === server.id ? "data-recommended-server=\"true\"" : ""} data-testid="server-card-${server.id}">
        <span class="auth-server-card__label">${server.name}</span>
        <span class="auth-server-card__meta">${server.region} • ${server.players}/${server.capacity}</span>
        <span class="auth-server-card__status">${server.status || "ONLINE"}</span>
        <span class="auth-server-card__countdown" data-server-countdown="${server.id}">${getServerCountdownText(server.id)}</span>
        <span class="auth-server-card__subtitle">${server.map?.totalDistricts ? `${server.map.totalDistricts} districtů / ${server.map.downtownDistricts} downtown` : serverListSource === SERVER_LIST_FALLBACK_SOURCE ? "DEV fallback katalog" : ""}</span>
        <span class="auth-server-card__signal is-${String(server.activity || "medium").toLowerCase()}"><i></i><i></i><i></i><i></i></span>
      </button>
    `).join("");

    for (const button of list.querySelectorAll("[data-server-card]")) {
      button.addEventListener("click", () => {
        selectServerById(String(button.getAttribute("data-server-card") || ""), { openModal: false });
      });
    }
  };

  const refreshServerList = () => {
    if (isActiveServerEntry) {
      renderActiveServerEntry();
      return;
    }

    const selectedServer = getSelectedServer();
    const shouldKeepSelection = selectedServer && !isServerUnavailable(selectedServer);
    if (!shouldKeepSelection) {
      state.serverId = "";
      state.selectedDistrictId = null;
      state.hoveredDistrictId = null;
    }
    renderServerList();
    updateCountdowns();
    updateLobbySummary();
    updateDetailModal();
    renderAllCanvases();
  };

  const hydrateServerSummaries = async () => {
    if (isActiveServerEntry || typeof fetch !== "function") {
      return;
    }

    try {
      const response = await fetch(SERVER_LIST_ENDPOINT, {
        method: "GET",
        headers: {
          "accept": "application/json"
        }
      });
      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const serverSummaries = Array.isArray(payload?.servers) ? payload.servers : [];
      const nextServers = mergeServerSummariesWithFallback(serverSummaries, SERVER_CATALOG);
      if (nextServers.length < 1 || nextServers.length === availableServers.length && nextServers.every((server, index) => server === availableServers[index])) {
        return;
      }

      availableServers = nextServers;
      serverListSource = serverSummaries.length > 0 ? SERVER_LIST_SERVER_SOURCE : SERVER_LIST_FALLBACK_SOURCE;
      if (!availableServers.some((server) => server.mode === state.mode)) {
        state.mode = availableServers[0]?.mode || state.mode;
        state.serverId = "";
        state.selectedDistrictId = null;
      }
      syncModeTabs();
      refreshServerList();
    } catch (_error) {
      serverListSource = SERVER_LIST_FALLBACK_SOURCE;
    }
  };

  const renderServerRefreshCountdown = (isRefreshing = false) => {
    if (!(lobbyRefreshCountdown instanceof HTMLElement)) {
      return;
    }

    lobbyRefreshCountdown.textContent = `${state.serverRefreshSecondsRemaining} s`;
    lobbyRefreshCountdown.parentElement?.classList.toggle("is-refreshing", isRefreshing);
  };

  const startServerListAutoRefresh = () => {
    if (isActiveServerEntry) {
      setHidden(lobbyRefreshCountdownShell, true);
      return;
    }

    renderServerRefreshCountdown();
    window.setInterval(() => {
      state.serverRefreshSecondsRemaining -= 1;

      if (state.serverRefreshSecondsRemaining <= 0) {
        state.serverRefreshSecondsRemaining = SERVER_LIST_REFRESH_SECONDS;
        refreshServerList();
        renderServerRefreshCountdown(true);
        window.setTimeout(() => renderServerRefreshCountdown(false), 520);
        return;
      }

      renderServerRefreshCountdown();
    }, 1000);
  };

  const getCanvasPoint = (targetCanvas, event) => {
    if (!(targetCanvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const rect = targetCanvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const x = ((event.clientX - rect.left) / rect.width) * targetCanvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * targetCanvas.height;
    if (x < 0 || x > targetCanvas.width || y < 0 || y > targetCanvas.height) {
      return null;
    }
    return { x, y };
  };

  const selectDetailDistrictAtClientPoint = (event) => {
    if (!state.serverId) {
      return false;
    }
    if (event.target instanceof Element && event.target.closest("button")) {
      return false;
    }

    const server = getSelectedServer();
    if (isServerUnavailable(server)) {
      setHoveredDetailDistrictId(null);
      if (detailModalHint) {
        detailModalHint.textContent = server?.full ? "Server je plný" : server?.offline ? "Server je offline" : "Server se připravuje";
        detailModalHint.classList.add("is-required");
      }
      return false;
    }

    const point = getCanvasPoint(detailCanvas, event);
    if (!point) {
      return false;
    }

    const district = getDistrictAtPoint(geometry, point) || getNearestDistrict(point);
    if (!isSelectableSpawnDistrict(district)) {
      setHoveredDetailDistrictId(null);
      if (detailModalHint) {
        detailModalHint.textContent = "Jako preferenci vyber levý, pravý nebo spodní okraj";
        detailModalHint.classList.add("is-required");
      }
      return false;
    }

    state.selectedDistrictId = Number(district.id);
    state.serverDistrictSelections.set(state.serverId, state.selectedDistrictId);
    state.hoveredDistrictId = state.selectedDistrictId;
    updateLobbySummary();
    updateDetailModal();
    renderAllCanvases();
    return true;
  };

  const closeDetailModal = () => {
    if (!(detailModal instanceof HTMLElement)) {
      return;
    }
    detailModal.classList.add("hidden");
    detailModal.setAttribute("aria-hidden", "true");
    state.activePanPointerId = null;
    detailCanvasShell?.classList.remove("is-panning");
    setDetailPan(0, 0);
    applyDetailZoom(1);
    detailMapPointers.clear();
    state.detailIsPinching = false;
    state.suppressNextMapClick = false;
  };

  const setHoveredDetailDistrictId = (nextDistrictId) => {
    const normalizedDistrictId = nextDistrictId ? Number(nextDistrictId) : null;
    if (state.hoveredDistrictId === normalizedDistrictId) {
      return;
    }

    state.hoveredDistrictId = normalizedDistrictId;
    renderAllCanvases();
  };

  const handleDetailMapClick = (event) => {
    if (state.suppressNextMapClick) {
      state.suppressNextMapClick = false;
      return;
    }
    selectDetailDistrictAtClientPoint(event);
  };

  const bindCanvasInteractions = (targetCanvas) => {
    if (!(targetCanvas instanceof HTMLCanvasElement)) {
      return;
    }

    targetCanvas.width = DISTRICT_CANVAS_WIDTH;
    targetCanvas.height = DISTRICT_CANVAS_HEIGHT;

    targetCanvas.addEventListener("mousemove", (event) => {
      if (state.activePanPointerId !== null) {
        return;
      }
      if (!state.serverId) {
        setHoveredDetailDistrictId(null);
        targetCanvas.style.cursor = "default";
        return;
      }
      if (isServerUnavailable(getSelectedServer())) {
        setHoveredDetailDistrictId(null);
        targetCanvas.style.cursor = "not-allowed";
        return;
      }

      const point = getCanvasPoint(targetCanvas, event);
      const district = point ? getDistrictAtPoint(geometry, point) : null;
      const selectableDistrict = isSelectableSpawnDistrict(district) ? district : null;
      targetCanvas.style.cursor = selectableDistrict ? "pointer" : "default";
      setHoveredDetailDistrictId(selectableDistrict?.id ?? null);
    });

    targetCanvas.addEventListener("mouseleave", () => {
      targetCanvas.style.cursor = state.detailZoom > 1.02 ? "grab" : "default";
      setHoveredDetailDistrictId(null);
    });

  };

  bindCanvasInteractions(detailCanvas);
  detailCanvasShell?.addEventListener("click", handleDetailMapClick);

  const getPointerPair = () => {
    const pointers = Array.from(detailMapPointers.values());
    return pointers.length >= 2 ? pointers.slice(0, 2) : null;
  };

  const getPointerDistance = (first, second) => Math.hypot(second.x - first.x, second.y - first.y);

  const getPointerMidpoint = (first, second) => ({
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  });

  const beginDetailMapPinch = () => {
    const pair = getPointerPair();
    if (!pair) {
      return;
    }

    const [first, second] = pair;
    const midpoint = getPointerMidpoint(first, second);
    state.detailIsPinching = true;
    state.detailPinchStartDistance = Math.max(1, getPointerDistance(first, second));
    state.detailPinchStartZoom = state.detailZoom;
    state.detailPinchStartMidX = midpoint.x;
    state.detailPinchStartMidY = midpoint.y;
    state.detailPinchOriginX = state.detailPanX;
    state.detailPinchOriginY = state.detailPanY;
    state.activePanPointerId = null;
    state.suppressNextMapClick = true;
    detailCanvasShell?.classList.add("is-panning");
  };

  const updateDetailMapPinch = (event) => {
    const pair = getPointerPair();
    if (!pair) {
      return false;
    }

    event.preventDefault();
    if (!state.detailIsPinching) {
      beginDetailMapPinch();
    }

    const [first, second] = pair;
    const distance = Math.max(1, getPointerDistance(first, second));
    const midpoint = getPointerMidpoint(first, second);
    const nextZoom = state.detailPinchStartZoom * (distance / Math.max(1, state.detailPinchStartDistance));
    applyDetailZoom(nextZoom);
    setDetailPan(
      state.detailPinchOriginX + (midpoint.x - state.detailPinchStartMidX),
      state.detailPinchOriginY + (midpoint.y - state.detailPinchStartMidY)
    );
    state.suppressNextMapClick = true;
    return true;
  };

  const startDetailMapPan = (event) => {
    if (!(detailCanvasShell instanceof HTMLElement)) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }

    detailMapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    detailCanvasShell.setPointerCapture?.(event.pointerId);
    if (detailMapPointers.size >= 2) {
      beginDetailMapPinch();
      return;
    }

    if (state.detailZoom <= 1.02) {
      return;
    }

    state.activePanPointerId = event.pointerId;
    state.panStartX = event.clientX;
    state.panStartY = event.clientY;
    state.panOriginX = state.detailPanX;
    state.panOriginY = state.detailPanY;
    state.panningMoved = false;
    detailCanvasShell.classList.add("is-panning");
  };

  const moveDetailMapPan = (event) => {
    if (detailMapPointers.has(event.pointerId)) {
      detailMapPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (updateDetailMapPinch(event)) {
      return;
    }

    if (state.activePanPointerId !== event.pointerId || !(detailCanvasShell instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - state.panStartX;
    const deltaY = event.clientY - state.panStartY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      state.panningMoved = true;
    }
    setDetailPan(state.panOriginX + deltaX, state.panOriginY + deltaY);
  };

  const stopDetailMapPan = (event) => {
    if (!(detailCanvasShell instanceof HTMLElement)) {
      return;
    }

    const wasPinching = state.detailIsPinching;
    const wasDragging = state.panningMoved;
    const wasActivePanPointer = state.activePanPointerId === event.pointerId;
    detailMapPointers.delete(event.pointerId);
    if (detailCanvasShell.hasPointerCapture?.(event.pointerId)) {
      detailCanvasShell.releasePointerCapture?.(event.pointerId);
    }
    const shouldSelectDistrict = !wasPinching
      && !wasDragging
      && event.type !== "pointercancel"
      && detailMapPointers.size === 0
      && Boolean(state.serverId)
      && !(event.target instanceof Element && event.target.closest("button"));

    if (wasPinching && detailMapPointers.size < 2) {
      state.detailIsPinching = false;
      state.suppressNextMapClick = true;
    }

    if (!wasActivePanPointer) {
      if (detailMapPointers.size === 0) {
        detailCanvasShell.classList.remove("is-panning");
      }
      if (shouldSelectDistrict) {
        selectDetailDistrictAtClientPoint(event);
        state.suppressNextMapClick = true;
      }
      return;
    }

    if (wasDragging) {
      state.suppressNextMapClick = true;
    }

    state.activePanPointerId = null;
    state.panningMoved = false;
    if (detailMapPointers.size === 0) {
      detailCanvasShell.classList.remove("is-panning");
    }
    if (shouldSelectDistrict) {
      selectDetailDistrictAtClientPoint(event);
      state.suppressNextMapClick = true;
    }
  };

  detailCanvasShell?.addEventListener("pointerdown", startDetailMapPan);
  detailCanvasShell?.addEventListener("pointermove", moveDetailMapPan);
  detailCanvasShell?.addEventListener("pointerup", stopDetailMapPan);
  detailCanvasShell?.addEventListener("pointercancel", stopDetailMapPan);

  detailContinueButton?.addEventListener("click", confirmDetailDistrictSelection);
  lobbyEnterSelectedButton?.addEventListener("click", commitLobbySelection);
  activeServerContinueButton?.addEventListener("click", () => {
    markLeavingLobby();
    window.location.href = getEntryDestinationHref();
  });
  lobbyOpenSelectedButton?.addEventListener("click", () => {
    if (isActiveServerEntry) {
      return;
    }

    if (!state.serverId) {
      const visibleServers = getVisibleServers();
      const firstVisibleServer = visibleServers.find((server) => !isServerUnavailable(server)) || visibleServers[0];
      if (firstVisibleServer) {
        state.serverId = firstVisibleServer.id;
        state.selectedDistrictId = isServerUnavailable(firstVisibleServer)
          ? null
          : Number(state.serverDistrictSelections.get(firstVisibleServer.id) || 0) || null;
        renderServerList();
        updateLobbySummary();
        updateDetailModal();
      }
    }
    if (!state.serverId || isServerUnavailable(getSelectedServer())) {
      return;
    }
    applyDetailZoom(1);
    openDetailModal();
  });
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled || button.getAttribute("aria-disabled") === "true") {
        return;
      }
      const nextTarget = String(button.getAttribute("data-lobby-nav-target") || "city");
      activeLobbyNav = nextTarget;
      syncLobbyNav();
      const preview = LOBBY_NAV_PREVIEWS[nextTarget] || LOBBY_NAV_PREVIEWS.city;
      if (flowNote) {
        flowNote.textContent = preview.message;
        flowNote.setAttribute("data-state", nextTarget === "city" ? "ready" : "success");
      }
    });
  });
  detailZoomInButton?.addEventListener("click", () => applyDetailZoom(state.detailZoom + 0.18));
  detailZoomOutButton?.addEventListener("click", () => applyDetailZoom(state.detailZoom - 0.18));

  detailCloseNodes.forEach((node) => {
    node.addEventListener("click", closeDetailModal);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (isDetailModalOpen()) {
      closeDetailModal();
    }
  });

  for (const button of tabs) {
    button.addEventListener("click", () => {
      if (isActiveServerEntry) {
        return;
      }

      const nextMode = String(button.getAttribute("data-server-mode-tab") || DEFAULT_PUBLIC_SERVER_MODE);
      state.mode = nextMode;
      state.serverId = "";
      state.hoveredDistrictId = null;
      closeDetailModal();
      syncModeTabs();
      renderServerList();
      updateLobbySummary();
      updateDetailModal();
      renderAllCanvases();
    });
  }

  syncModeTabs();
  syncLobbyNav();

  applyDetailZoom(state.detailZoom);

  renderServerList();
  updateLobbySummary();
  updateDetailModal();
  renderAllCanvases();
  ensureCountdownTicker();
  updateCountdowns();
  startLobbyStatusTicker();
  startServerListAutoRefresh();
  void hydrateServerSummaries();
});

function installLobbyBackLogoutGuard() {
  if (!window.history?.pushState) {
    return;
  }

  const armBackLogoutGuard = () => {
    if (isLeavingLobby) {
      return;
    }

    try {
      const state = window.history.state;
      if (state?.empireLobby !== LOBBY_HISTORY_ACTIVE_STATE && state?.empireLobby !== LOBBY_HISTORY_GUARD_STATE) {
        window.history.replaceState({ empireLobby: LOBBY_HISTORY_ACTIVE_STATE }, "", window.location.href);
      }
      if (window.history.state?.empireLobby !== LOBBY_HISTORY_GUARD_STATE) {
        window.history.pushState({ empireLobby: LOBBY_HISTORY_GUARD_STATE }, "", window.location.href);
      }
    } catch (_error) {
      // Some mobile browsers can reject history writes during page restore. The click logout path still works.
    }
  };

  armBackLogoutGuard();

  window.addEventListener("popstate", () => {
    if (isLeavingLobby) {
      return;
    }

    armBackLogoutGuard();

    promptLobbyLogoutConfirmation().then((shouldLogout) => {
      if (!shouldLogout) {
        armBackLogoutGuard();
        return;
      }
      markLeavingLobby();
      clearAuthSession();
      window.location.replace(LOGIN_ENTRY_HREF);
    });
  });

  window.addEventListener("pageshow", () => {
    armBackLogoutGuard();
  });
}
