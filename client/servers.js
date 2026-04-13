const SELECTED_SERVER_KEY = "empire_selected_server";
const SPAWN_SELECTION_STORAGE_KEY = "empire_server_spawn_selection_v1";
const SERVER_MAP_SCALE_MIN = 1;
const SERVER_MAP_SCALE_MAX = 2.6;
const SERVER_MAP_SCALE_STEP = 0.2;
const SERVER_MAP_PREVIEW_BY_MODE = Object.freeze({
  war: "/img/mapanoc.png",
  free: "/img/mapaden2.png"
});
const SERVER_START_MATERIALS_BY_MODE = Object.freeze({
  war: Object.freeze([
    "Clean cash: $12 000",
    "Dirty cash: $4 500",
    "Chemikálie: 60 ks",
    "Biomasa: 45 ks",
    "Stimpack: 20 ks"
  ]),
  free: Object.freeze([
    "Clean cash: $25 000",
    "Dirty cash: $10 000",
    "Chemikálie: 120 ks",
    "Biomasa: 90 ks",
    "Stimpack: 45 ks"
  ])
});

const state = {
  activeMode: window.Empire?.mode || "war",
  warLocked: false,
  launchByKey: {},
  countdownTimer: null,
  activeServerKey: null,
  serverModal: null,
  activeSpawnDistrictId: null,
  activeSpawnEligibleDistrictIds: [],
  previewMapScale: 1,
  zoomMapScale: 1,
  previewMapOffsetX: 0,
  previewMapOffsetY: 0,
  zoomMapOffsetX: 0,
  zoomMapOffsetY: 0,
  lastMapDragAt: 0
};

document.addEventListener("DOMContentLoaded", () => {
  initServerDetailModal();
  enforceModeLock();
  bindModeTabs();
  renderServers();
});

function readTokenMode() {
  const token = localStorage.getItem("empire_token");
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return window.Empire?.GameModes?.normalizeMode?.(payload?.gameMode) || null;
  } catch (error) {
    return null;
  }
}

function readTokenModeFromRawStorage() {
  const raw = window.Empire?.__storagePatch;
  if (!raw?.getItem) return null;
  const activeAuthMode = window.Empire?.GameModes?.normalizeMode?.(raw.getItem("empire:active_auth_mode") || "") || null;
  if (!activeAuthMode) return null;
  const token = raw.getItem(`empire:${activeAuthMode}:empire_token`);
  if (!token) return null;
  return readJwtMode(token);
}

function readJwtMode(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return window.Empire?.GameModes?.normalizeMode?.(payload?.gameMode) || null;
  } catch (error) {
    return null;
  }
}

function isGuestFlow() {
  if (localStorage.getItem("empire_token")) return false;
  const guestUsername = String(localStorage.getItem("empire_guest_username") || "").trim();
  const guestGang = String(localStorage.getItem("empire_gang_name") || "").trim();
  return Boolean(guestUsername || guestGang);
}

function enforceModeLock() {
  const tokenMode = readTokenMode() || readTokenModeFromRawStorage();
  state.warLocked = tokenMode === "free";

  if (state.warLocked && state.activeMode === "war") {
    state.activeMode = "free";
    window.Empire?.applyGameMode?.("free");
  }
}

function bindModeTabs() {
  document.querySelectorAll(".auth-mode-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = String(btn.dataset.mode || "war").toLowerCase();
      if (state.warLocked && mode === "war") return;
      if (mode === state.activeMode) return;
      state.activeMode = mode;
      updateModeTabs();
      renderServers();
      closeServerModal();
    });
  });
  updateModeTabs();
}

function updateModeTabs() {
  document.querySelectorAll(".auth-mode-tab").forEach((btn) => {
    const mode = String(btn.dataset.mode || "");
    const isWarLockedTab = state.warLocked && mode === "war";
    const isActive = mode === state.activeMode;
    btn.classList.toggle("is-active", isActive);
    btn.classList.toggle("is-locked", isWarLockedTab);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.setAttribute("aria-disabled", isWarLockedTab ? "true" : "false");
    btn.disabled = isWarLockedTab;
    btn.title = isWarLockedTab ? "WAR servery jsou pro tento účet zamčené." : "";
  });
  updateModeLockMessage();
  try {
    window.Empire?.applyGameMode?.(state.activeMode);
  } catch (error) {
    console.error("Mode switch UI sync failed:", error);
  }
}

function updateModeLockMessage() {
  const note = document.getElementById("mode-lock-message");
  if (!note) return;
  if (state.warLocked) {
    note.textContent = "WAR servery jsou pro tento účet zamčené. Pokračuj v režimu FREE.";
    note.classList.remove("hidden");
    return;
  }
  if (isGuestFlow()) {
    const modeLabel = state.activeMode === "free" ? "FREE" : "WAR";
    note.textContent = `Host režim: data se ukládají zvlášť podle zvolené záložky (${modeLabel}).`;
    note.classList.remove("hidden");
    return;
  }
  note.textContent = "";
  note.classList.add("hidden");
}

function renderServers() {
  const container = document.getElementById("servers-list");
  const config = window.Empire?.modeConfig || window.Empire?.GameModes?.getConfig(state.activeMode);
  if (!container || !config) return;
  ensureMockLaunches(config);

  const selectedServerKey = "";

  container.innerHTML = config.servers.map((server) => {
    const isSelected = selectedServerKey === server.key;
    const launch = state.launchByKey[server.key];
    const startLabel = launch ? formatStartLabel(launch.startAt) : "Dnes 20:00";
    return `
      <button class="auth-server-card ${isSelected ? "is-selected" : ""}" type="button" data-server-key="${server.key}">
        <span class="auth-server-card__label">${server.name}</span>
        <span class="auth-server-card__subtitle">${server.subtitle}</span>
        <span class="auth-server-card__meta">${server.capacity} slotů</span>
        <span class="auth-server-card__schedule">Start: ${startLabel}</span>
        <span class="auth-server-card__countdown" data-countdown-key="${server.key}">Začíná za --h --m --s</span>
      </button>
    `;
  }).join("");
  startCountdownTicker();
  updateCountdowns();

  container.querySelectorAll("[data-server-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const serverKey = String(button.dataset.serverKey || "").trim();
      if (!serverKey) return;
      localStorage.setItem(SELECTED_SERVER_KEY, serverKey);
      const card = config.servers.find((server) => server.key === serverKey) || null;
      renderServers();
      openServerModal(card);
    });
  });
}

function ensureMockLaunches(config) {
  const mode = window.Empire?.GameModes?.normalizeMode?.(state.activeMode) || "war";
  const offsets = mode === "free" ? [35, 95, 190] : [75, 210, 420];
  config.servers.forEach((server, index) => {
    if (state.launchByKey[server.key]) return;
    const offsetMinutes = offsets[index] || (offsets[offsets.length - 1] + ((index + 1) * 45));
    state.launchByKey[server.key] = {
      startAt: Date.now() + (offsetMinutes * 60 * 1000)
    };
  });
}

function startCountdownTicker() {
  if (state.countdownTimer) return;
  state.countdownTimer = window.setInterval(updateCountdowns, 1000);
}

function updateCountdowns() {
  document.querySelectorAll("[data-countdown-key]").forEach((node) => {
    const serverKey = String(node.getAttribute("data-countdown-key") || "");
    const launch = state.launchByKey[serverKey];
    if (!launch?.startAt) {
      node.textContent = "Začíná za --h --m --s";
      return;
    }
    const msRemaining = Number(launch.startAt) - Date.now();
    if (msRemaining <= 0) {
      node.textContent = "Start probíhá";
      return;
    }
    node.textContent = `Začíná za ${formatRemaining(msRemaining)}`;
  });
  updateServerModalCountdown();
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function formatStartLabel(timestamp) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}. ${hours}:${minutes}`;
}

function initServerDetailModal() {
  const root = document.getElementById("server-detail-modal");
  if (!(root instanceof HTMLElement)) return;
  const joinButton = document.getElementById("server-detail-join");
  state.serverModal = {
    root,
    title: document.getElementById("server-detail-title"),
    subtitle: document.getElementById("server-detail-subtitle"),
    mode: document.getElementById("server-detail-mode"),
    capacity: document.getElementById("server-detail-capacity"),
    start: document.getElementById("server-detail-start"),
    countdown: document.getElementById("server-detail-countdown"),
    map: document.getElementById("server-detail-map"),
    mapWrap: document.getElementById("server-detail-map")?.closest(".server-detail-modal__map-wrap") || null,
    mapOverlay: document.getElementById("server-detail-map-overlay"),
    mapZoomIn: document.getElementById("server-detail-map-zoom-in"),
    mapZoomOut: document.getElementById("server-detail-map-zoom-out"),
    mapZoomButton: document.getElementById("server-detail-map-zoom-btn"),
    zoomRoot: document.getElementById("server-map-zoom-modal"),
    zoomMap: document.getElementById("server-map-zoom-image"),
    zoomMapWrap: document.getElementById("server-map-zoom-image")?.closest(".server-map-zoom-modal__map-wrap") || null,
    zoomOverlay: document.getElementById("server-map-zoom-overlay"),
    zoomMapZoomIn: document.getElementById("server-map-zoom-in"),
    zoomMapZoomOut: document.getElementById("server-map-zoom-out"),
    typeCounts: document.getElementById("server-detail-type-counts"),
    spawnHint: document.getElementById("server-detail-spawn-hint"),
    materials: document.getElementById("server-detail-materials"),
    joinButton
  };
  root.querySelectorAll("[data-server-modal-close]").forEach((node) => {
    node.addEventListener("click", closeServerModal);
  });
  if (joinButton instanceof HTMLButtonElement) {
    joinButton.addEventListener("click", () => {
      if (!state.activeServerKey) return;
      if (!Number.isFinite(Number(state.activeSpawnDistrictId))) {
        updateSpawnSelectionUi(null, { required: true });
        return;
      }
      localStorage.setItem(SELECTED_SERVER_KEY, state.activeServerKey);
      persistSpawnSelection(state.activeMode, state.activeServerKey, Number(state.activeSpawnDistrictId));
      const nextUrl = `faction.html?mode=${state.activeMode}`;
      window.location.href = nextUrl;
    });
  }
  const bindSpawnClick = (rootNode, scope) => {
    if (!(rootNode instanceof HTMLElement)) return;
    rootNode.addEventListener("click", (event) => {
      if (Date.now() - Number(state.lastMapDragAt || 0) < 280) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const districtNode = target.closest("[data-spawn-selectable=\"true\"][data-district-id]");
      if (!(districtNode instanceof Element)) return;
      const districtId = Number(districtNode.getAttribute("data-district-id") || 0);
      if (!Number.isFinite(districtId) || districtId <= 0) return;
      state.activeSpawnDistrictId = districtId;
      applySpawnSelectionToOverlay(districtId);
      updateSpawnSelectionUi(districtId);
      if (scope === "zoom") {
        closeServerMapZoomModal();
      }
    });
  };
  bindSpawnClick(state.serverModal.mapOverlay, "preview");
  bindSpawnClick(state.serverModal.zoomOverlay, "zoom");
  bindMapScaleControls("preview", state.serverModal.mapZoomIn, state.serverModal.mapZoomOut, state.serverModal.mapWrap);
  bindMapScaleControls("zoom", state.serverModal.zoomMapZoomIn, state.serverModal.zoomMapZoomOut, state.serverModal.zoomMapWrap);
  if (state.serverModal.mapZoomButton instanceof HTMLButtonElement) {
    state.serverModal.mapZoomButton.addEventListener("click", () => {
      openServerMapZoomModal();
    });
  }
  if (state.serverModal.zoomRoot instanceof HTMLElement) {
    state.serverModal.zoomRoot.querySelectorAll("[data-server-map-zoom-close]").forEach((node) => {
      node.addEventListener("click", closeServerMapZoomModal);
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.serverModal?.zoomRoot instanceof HTMLElement && !state.serverModal.zoomRoot.classList.contains("hidden")) {
      closeServerMapZoomModal();
      return;
    }
    closeServerModal();
  });
}

function openServerModal(server) {
  if (!server || !state.serverModal?.root) return;
  const launch = state.launchByKey[server.key] || null;
  const modeConfig = window.Empire?.GameModes?.getConfig(state.activeMode) || null;
  const modeLabel = modeConfig?.label || String(state.activeMode || "WAR").toUpperCase();
  const mapPreview = SERVER_MAP_PREVIEW_BY_MODE[state.activeMode] || "/img/mapaden.png";
  const materials = SERVER_START_MATERIALS_BY_MODE[state.activeMode] || [];
  state.activeServerKey = server.key;
  state.activeSpawnDistrictId = null;
  state.activeSpawnEligibleDistrictIds = [];
  resetMapViewport("preview");
  resetMapViewport("zoom");
  const modal = state.serverModal;
  if (modal.title) modal.title.textContent = server.name || "Server detail";
  if (modal.subtitle) modal.subtitle.textContent = server.subtitle || "";
  if (modal.mode) modal.mode.textContent = `Režim: ${modeLabel}`;
  if (modal.capacity) modal.capacity.textContent = `Kapacita: ${server.capacity || 0} hráčů`;
  if (modal.start) modal.start.textContent = `Start: ${launch ? formatStartLabel(launch.startAt) : "Dnes 20:00"}`;
  if (modal.map instanceof HTMLImageElement) {
    modal.map.src = mapPreview;
    modal.map.alt = `Náhled mapy ${server.name || "serveru"}`;
  }
  if (modal.zoomMap instanceof HTMLImageElement) {
    modal.zoomMap.src = mapPreview;
    modal.zoomMap.alt = `Zvětšený náhled mapy ${server.name || "serveru"}`;
  }
  if (modal.mapOverlay) {
    const districtCount = Math.max(1, Math.floor(Number(server.capacity || 0)) || 1);
    const overlay = renderServerDistrictOverlaySvg({
      serverKey: server.key,
      mode: state.activeMode,
      districtCount
    });
    modal.mapOverlay.innerHTML = overlay.svg;
    if (modal.zoomOverlay) {
      modal.zoomOverlay.innerHTML = overlay.svg;
    }
    state.activeSpawnEligibleDistrictIds = Array.isArray(overlay.spawnEligibleIds)
      ? overlay.spawnEligibleIds.slice()
      : [];
    const persistedSpawnId = readPersistedSpawnSelection(state.activeMode, server.key);
    const initialSpawnId = state.activeSpawnEligibleDistrictIds.includes(persistedSpawnId)
      ? persistedSpawnId
      : null;
    state.activeSpawnDistrictId = initialSpawnId;
    applySpawnSelectionToOverlay(initialSpawnId);
    updateSpawnSelectionUi(initialSpawnId);
    if (modal.typeCounts) {
      modal.typeCounts.innerHTML = renderDistrictTypeCountsHtml(overlay.typeCounts);
    }
  }
  if (!modal.mapOverlay) {
    updateSpawnSelectionUi(null);
  }
  if (modal.materials) {
    modal.materials.innerHTML = materials.map((item) => `<li>${item}</li>`).join("");
  }
  updateServerModalCountdown();
  modal.root.classList.remove("hidden");
  modal.root.setAttribute("aria-hidden", "false");
}

function closeServerModal() {
  const modal = state.serverModal;
  if (!modal?.root) return;
  closeServerMapZoomModal();
  modal.root.classList.add("hidden");
  modal.root.setAttribute("aria-hidden", "true");
  state.activeSpawnDistrictId = null;
  state.activeSpawnEligibleDistrictIds = [];
}

function updateServerModalCountdown() {
  const modal = state.serverModal;
  if (!modal?.root || modal.root.classList.contains("hidden") || !modal.countdown) return;
  const launch = state.launchByKey[state.activeServerKey || ""] || null;
  if (!launch?.startAt) {
    modal.countdown.textContent = "Odpočet: --h --m --s";
    return;
  }
  const msRemaining = Number(launch.startAt) - Date.now();
  if (msRemaining <= 0) {
    modal.countdown.textContent = "Odpočet: Start probíhá";
    return;
  }
  modal.countdown.textContent = `Odpočet: ${formatRemaining(msRemaining)}`;
}

function renderServerDistrictOverlaySvg(options) {
  const districtCount = Math.max(1, Math.floor(Number(options?.districtCount || 1)));
  const mode = window.Empire?.GameModes?.normalizeMode?.(options?.mode) || "war";
  const seed = hashServerPreviewSeed(`${mode}:${String(options?.serverKey || "")}:${districtCount}`);
  const width = 960;
  const height = 640;
  const city = window.Empire?.CityGen?.generate
    ? window.Empire.CityGen.generate({ seed, width, height, districtCount })
    : null;
  const districts = Array.isArray(city?.districts) ? city.districts : [];
  if (!districts.length) return { svg: "", typeCounts: {}, spawnEligibleIds: [] };
  const downtownIds = resolveDowntownDistrictIds(districts, width, height);
  const spawnEligibleIds = [];
  const paths = districts
    .map((district) => {
      const polygon = Array.isArray(district?.polygon) ? district.polygon : [];
      if (polygon.length < 3) return "";
      const path = polygonToSvgPath(polygon);
      const isDowntown = downtownIds.has(Number(district?.id || 0));
      const districtId = Number(district?.id || 0);
      const isSpawnSelectable = isSpawnSelectableDistrict(district, width, height);
      if (isSpawnSelectable) spawnEligibleIds.push(districtId);
      return `<path d="${path}" class="server-map-district${isDowntown ? " is-downtown" : ""}${isSpawnSelectable ? " is-spawn-selectable" : ""}" data-district-id="${districtId}" data-spawn-selectable="${isSpawnSelectable ? "true" : "false"}" />`;
    })
    .filter(Boolean)
    .join("");
  return {
    svg: `<svg class="server-map-overlay-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`,
    typeCounts: computeDistrictTypeCounts(districts),
    spawnEligibleIds
  };
}

function polygonToSvgPath(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return "";
  const [firstX, firstY] = polygon[0];
  const moveTo = `M ${formatSvgNumber(firstX)} ${formatSvgNumber(firstY)}`;
  const lines = polygon
    .slice(1)
    .map(([x, y]) => `L ${formatSvgNumber(x)} ${formatSvgNumber(y)}`)
    .join(" ");
  return `${moveTo} ${lines} Z`;
}

function formatSvgNumber(value) {
  return Number(value || 0).toFixed(2);
}

function resolveDowntownDistrictIds(districts, width, height) {
  const fromType = (Array.isArray(districts) ? districts : [])
    .filter((entry) => String(entry?.type || "").toLowerCase() === "downtown")
    .map((entry) => Number(entry?.id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (fromType.length) return new Set(fromType);
  const centerX = width / 2;
  const centerY = height / 2;
  let bestId = Number(districts[0]?.id || 1);
  let bestDist = Number.POSITIVE_INFINITY;
  districts.forEach((district) => {
    const polygon = Array.isArray(district?.polygon) ? district.polygon : [];
    if (polygon.length < 3) return;
    const [cx, cy] = polygonCentroid(polygon);
    const dist = Math.hypot(cx - centerX, cy - centerY);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = Number(district?.id || bestId);
    }
  });
  return new Set([bestId]);
}

function polygonCentroid(poly) {
  const safePoly = Array.isArray(poly) ? poly : [];
  if (safePoly.length < 3) return [0, 0];
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < safePoly.length; i += 1) {
    const [x0, y0] = safePoly[i];
    const [x1, y1] = safePoly[(i + 1) % safePoly.length];
    const a = (x0 * y1) - (x1 * y0);
    area += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }
  area *= 0.5;
  if (!Number.isFinite(area) || Math.abs(area) < 1e-7) return safePoly[0];
  return [cx / (6 * area), cy / (6 * area)];
}

function hashServerPreviewSeed(input) {
  const text = String(input || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) || 1;
}

function computeDistrictTypeCounts(districts) {
  const safeDistricts = Array.isArray(districts) ? districts : [];
  const counts = {
    downtown: 0,
    residential: 0,
    industrial: 0,
    commercial: 0,
    park: 0,
    other: 0
  };
  safeDistricts.forEach((district) => {
    const type = String(district?.type || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, type)) {
      counts[type] += 1;
      return;
    }
    counts.other += 1;
  });
  return counts;
}

function renderDistrictTypeCountsHtml(typeCounts) {
  const counts = typeCounts || {};
  const items = [
    { key: "downtown", label: "Downtown" },
    { key: "residential", label: "Rezidenční" },
    { key: "industrial", label: "Industriální" },
    { key: "commercial", label: "Komerční" },
    { key: "park", label: "Park" }
  ];
  return items
    .map((item) => {
      const value = Math.max(0, Math.floor(Number(counts[item.key] || 0)));
      return `<span class="server-detail-modal__type-count${item.key === "downtown" ? " is-downtown" : ""}"><strong>${item.label}</strong><b>${value}</b></span>`;
    })
    .join("");
}

function isSpawnSelectableDistrict(district, width, height) {
  const polygon = Array.isArray(district?.polygon) ? district.polygon : [];
  if (polygon.length < 3) return false;
  const bounds = polygonBounds(polygon);
  const edgeTolerance = 5;
  const touchesLeft = bounds.minX <= edgeTolerance;
  const touchesRight = bounds.maxX >= (Number(width || 0) - edgeTolerance);
  const touchesBottom = bounds.maxY >= (Number(height || 0) - edgeTolerance);
  return touchesLeft || touchesRight || touchesBottom;
}

function polygonBounds(polygon) {
  const safe = Array.isArray(polygon) ? polygon : [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  safe.forEach((point) => {
    const x = Number(Array.isArray(point) ? point[0] : 0);
    const y = Number(Array.isArray(point) ? point[1] : 0);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

function applySpawnSelectionToOverlay(selectedDistrictId) {
  const overlays = [state.serverModal?.mapOverlay, state.serverModal?.zoomOverlay];
  overlays.forEach((overlayRoot) => {
    if (!(overlayRoot instanceof HTMLElement)) return;
    overlayRoot.querySelectorAll("[data-district-id]").forEach((node) => {
      if (!(node instanceof Element)) return;
      const nodeDistrictId = Number(node.getAttribute("data-district-id") || 0);
      const isSelected = Number.isFinite(Number(selectedDistrictId))
        && Number(nodeDistrictId) === Number(selectedDistrictId);
      node.classList.toggle("is-spawn-selected", isSelected);
    });
  });
}

function updateSpawnSelectionUi(selectedDistrictId, options = {}) {
  const selectedNode = state.serverModal?.spawnHint;
  const joinButton = state.serverModal?.joinButton;
  const required = Boolean(options.required);
  if (selectedNode instanceof HTMLElement) {
    if (Number.isFinite(Number(selectedDistrictId)) && Number(selectedDistrictId) > 0) {
      selectedNode.textContent = `District #${Math.floor(Number(selectedDistrictId))}`;
      selectedNode.classList.remove("is-required");
    } else {
      selectedNode.textContent = "Vyber district";
      selectedNode.classList.toggle("is-required", required);
    }
  }
  if (joinButton instanceof HTMLButtonElement) {
    const hasSelection = Number.isFinite(Number(selectedDistrictId)) && Number(selectedDistrictId) > 0;
    joinButton.disabled = !hasSelection;
    joinButton.title = hasSelection ? "" : "Nejdřív vyber spawn district.";
  }
}

function readPersistedSpawnSelection(mode, serverKey) {
  const storageKey = resolveSpawnSelectionStorageKey(mode, serverKey);
  try {
    const parsed = JSON.parse(localStorage.getItem(SPAWN_SELECTION_STORAGE_KEY) || "{}");
    const value = Number(parsed?.[storageKey] || 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
  } catch (error) {
    return null;
  }
}

function persistSpawnSelection(mode, serverKey, districtId) {
  const storageKey = resolveSpawnSelectionStorageKey(mode, serverKey);
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem(SPAWN_SELECTION_STORAGE_KEY) || "{}");
  } catch (error) {
    parsed = {};
  }
  parsed[storageKey] = Math.max(1, Math.floor(Number(districtId) || 1));
  localStorage.setItem(SPAWN_SELECTION_STORAGE_KEY, JSON.stringify(parsed));
}

function resolveSpawnSelectionStorageKey(mode, serverKey) {
  const normalizedMode = window.Empire?.GameModes?.normalizeMode?.(mode) || "war";
  return `${normalizedMode}:${String(serverKey || "").trim()}`;
}

function openServerMapZoomModal() {
  const zoomRoot = state.serverModal?.zoomRoot;
  if (!(zoomRoot instanceof HTMLElement)) return;
  setMapScale("zoom", state.previewMapScale || 1);
  zoomRoot.classList.remove("hidden");
  zoomRoot.setAttribute("aria-hidden", "false");
}

function closeServerMapZoomModal() {
  const zoomRoot = state.serverModal?.zoomRoot;
  if (!(zoomRoot instanceof HTMLElement)) return;
  zoomRoot.classList.add("hidden");
  zoomRoot.setAttribute("aria-hidden", "true");
}

function bindMapScaleControls(scope, zoomInBtn, zoomOutBtn, mapWrap) {
  if (!(mapWrap instanceof HTMLElement)) return;
  bindMapDragPan(scope, mapWrap);
  if (zoomInBtn instanceof HTMLButtonElement) {
    zoomInBtn.addEventListener("click", () => {
      adjustMapScale(scope, SERVER_MAP_SCALE_STEP);
    });
  }
  if (zoomOutBtn instanceof HTMLButtonElement) {
    zoomOutBtn.addEventListener("click", () => {
      adjustMapScale(scope, -SERVER_MAP_SCALE_STEP);
    });
  }
  mapWrap.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = Number(event.deltaY || 0);
    if (delta === 0) return;
    adjustMapScale(scope, delta < 0 ? SERVER_MAP_SCALE_STEP : -SERVER_MAP_SCALE_STEP);
  }, { passive: false });
}

function adjustMapScale(scope, delta) {
  const current = scope === "zoom" ? state.zoomMapScale : state.previewMapScale;
  const next = clampMapScale(current + Number(delta || 0));
  setMapScale(scope, next);
}

function setMapScale(scope, value) {
  const safe = clampMapScale(value);
  if (scope === "zoom") {
    state.zoomMapScale = safe;
    if (safe <= 1) {
      state.zoomMapOffsetX = 0;
      state.zoomMapOffsetY = 0;
    }
  } else {
    state.previewMapScale = safe;
    if (safe <= 1) {
      state.previewMapOffsetX = 0;
      state.previewMapOffsetY = 0;
    }
  }
  applyMapViewportTransform(scope);
}

function applyMapViewportTransform(scope) {
  const wrap = scope === "zoom" ? state.serverModal?.zoomMapWrap : state.serverModal?.mapWrap;
  const scale = scope === "zoom" ? state.zoomMapScale : state.previewMapScale;
  let offsetX = scope === "zoom" ? state.zoomMapOffsetX : state.previewMapOffsetX;
  let offsetY = scope === "zoom" ? state.zoomMapOffsetY : state.previewMapOffsetY;
  if (wrap instanceof HTMLElement) {
    const clamped = clampMapOffsetsForWrap(scale, offsetX, offsetY, wrap);
    offsetX = clamped.x;
    offsetY = clamped.y;
    if (scope === "zoom") {
      state.zoomMapOffsetX = offsetX;
      state.zoomMapOffsetY = offsetY;
    } else {
      state.previewMapOffsetX = offsetX;
      state.previewMapOffsetY = offsetY;
    }
    wrap.style.setProperty("--server-map-scale", String(scale));
    wrap.style.setProperty("--server-map-offset-x", `${Math.round(offsetX)}px`);
    wrap.style.setProperty("--server-map-offset-y", `${Math.round(offsetY)}px`);
    wrap.classList.toggle("is-map-draggable", scale > 1.001);
  }
}

function clampMapScale(value) {
  const numeric = Number(value || 1);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(SERVER_MAP_SCALE_MAX, Math.max(SERVER_MAP_SCALE_MIN, numeric));
}

function bindMapDragPan(scope, mapWrap) {
  if (!(mapWrap instanceof HTMLElement)) return;
  mapWrap.setAttribute("draggable", "false");
  mapWrap.querySelectorAll("img, svg, path").forEach((node) => {
    if (node instanceof HTMLElement || node instanceof SVGElement) {
      node.setAttribute("draggable", "false");
    }
  });
  mapWrap.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });
  const dragState = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false
  };
  mapWrap.addEventListener("pointerdown", (event) => {
    const scale = scope === "zoom" ? state.zoomMapScale : state.previewMapScale;
    if (scale <= 1.001) return;
    event.preventDefault();
    dragState.active = true;
    dragState.pointerId = event.pointerId;
    dragState.startX = event.clientX;
    dragState.startY = event.clientY;
    dragState.moved = false;
    mapWrap.classList.add("is-panning");
    try {
      mapWrap.setPointerCapture(event.pointerId);
    } catch (error) {
      // noop
    }
  });
  mapWrap.addEventListener("pointermove", (event) => {
    if (!dragState.active || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = Number(event.clientX || 0) - dragState.startX;
    const dy = Number(event.clientY || 0) - dragState.startY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      dragState.moved = true;
    }
    if (scope === "zoom") {
      state.zoomMapOffsetX += dx;
      state.zoomMapOffsetY += dy;
    } else {
      state.previewMapOffsetX += dx;
      state.previewMapOffsetY += dy;
    }
    dragState.startX = Number(event.clientX || 0);
    dragState.startY = Number(event.clientY || 0);
    applyMapViewportTransform(scope);
  });
  const stopDrag = (event) => {
    if (!dragState.active) return;
    if (event && dragState.pointerId != null && dragState.pointerId !== event.pointerId) return;
    if (dragState.moved) {
      state.lastMapDragAt = Date.now();
    }
    dragState.active = false;
    dragState.pointerId = null;
    dragState.moved = false;
    mapWrap.classList.remove("is-panning");
  };
  mapWrap.addEventListener("pointerup", stopDrag);
  mapWrap.addEventListener("pointercancel", stopDrag);
  mapWrap.addEventListener("pointerleave", stopDrag);
}

function resetMapViewport(scope) {
  if (scope === "zoom") {
    state.zoomMapScale = 1;
    state.zoomMapOffsetX = 0;
    state.zoomMapOffsetY = 0;
  } else {
    state.previewMapScale = 1;
    state.previewMapOffsetX = 0;
    state.previewMapOffsetY = 0;
  }
  applyMapViewportTransform(scope);
}

function clampMapOffsetsForWrap(scale, offsetX, offsetY, wrap) {
  const safeScale = clampMapScale(scale);
  if (!(wrap instanceof HTMLElement) || safeScale <= 1.001) {
    return { x: 0, y: 0 };
  }
  const width = Math.max(1, wrap.clientWidth);
  const height = Math.max(1, wrap.clientHeight);
  const maxX = ((safeScale - 1) * width) / 2;
  const maxY = ((safeScale - 1) * height) / 2;
  return {
    x: Math.min(maxX, Math.max(-maxX, Number(offsetX || 0))),
    y: Math.min(maxY, Math.max(-maxY, Number(offsetY || 0)))
  };
}
