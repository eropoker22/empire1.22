import {
  createDistrictGeometry,
  getDistrictAtPoint
} from "./app/district-geometry.js";
import {
  ensureIdentity,
  getRegistrationDraft,
  saveLobbyStep,
  SERVER_CATALOG
} from "./app/auth-flow.js";

const FACTION_ENTRY_HREF = "./faction.html";
const LOGIN_ENTRY_HREF = "./login.html";
const DISTRICT_CANVAS_WIDTH = 1600;
const DISTRICT_CANVAS_HEIGHT = 980;
const DEMO_SERVER_CATALOG = Object.freeze([
  {
    id: "war-demo-01",
    name: "Vortex City WAR-01",
    mode: "war",
    region: "EU Central",
    players: 64,
    capacity: 120,
    startLabel: "Live server",
    badge: "HOT",
    description: "Tvrdý válečný shard s rychlou expanzí, hustší konkurencí a tlakem na obranu districtů."
  },
  {
    id: "war-demo-02",
    name: "Black Harbor WAR-02",
    mode: "war",
    region: "EU Central",
    players: 41,
    capacity: 120,
    startLabel: "Start za 12 min",
    badge: "QUEUE",
    description: "Čerstvě otevíraná instance, vhodná pro nový náběh a rychlé obsazení startovní pozice."
  },
  {
    id: "free-demo-01",
    name: "Neon Drift FREE-01",
    mode: "free",
    region: "EU Central",
    players: 29,
    capacity: 80,
    startLabel: "Volný vstup",
    badge: "FREE",
    description: "Volnější režim pro test buildů, economy loopu a klidnější rozjezdy gangu."
  },
  {
    id: "free-demo-02",
    name: "Afterglow FREE-02",
    mode: "free",
    region: "EU West",
    players: 52,
    capacity: 80,
    startLabel: "Live server",
    badge: "ACTIVE",
    description: "Rozjetý free shard s vyšší ekonomikou a otevřeným onboardingem pro nové hráče."
  }
]);
const SERVER_COUNTDOWN_OFFSETS_MINUTES = Object.freeze({
  "war-eu-02": 12,
  "war-demo-02": 12
});
const START_PACKAGES = Object.freeze({
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

document.addEventListener("DOMContentLoaded", () => {
  if (!ensureIdentity()) {
    window.location.href = LOGIN_ENTRY_HREF;
    return;
  }

  const registration = getRegistrationDraft();
  const tabs = Array.from(document.querySelectorAll("[data-server-mode-tab]"));
  const list = document.querySelector("[data-server-list]");
  const userLabel = document.querySelector("[data-lobby-user]");
  const userMeta = document.querySelector("[data-lobby-user-meta]");
  const summaryServer = document.querySelector("[data-lobby-summary-server]");
  const summaryDistrict = document.querySelector("[data-lobby-summary-district]");
  const summaryMode = document.querySelector("[data-lobby-summary-mode]");
  const flowNote = document.querySelector("[data-lobby-flow-note]");

  const detailModal = document.querySelector("[data-server-detail-modal]");
  const detailModalTitle = document.querySelector("[data-server-detail-title]");
  const detailModalSubtitle = document.querySelector("[data-server-detail-subtitle]");
  const detailModalMode = document.querySelector("[data-server-detail-mode]");
  const detailModalCapacity = document.querySelector("[data-server-detail-capacity]");
  const detailModalStart = document.querySelector("[data-server-detail-start]");
  const detailModalCountdown = document.querySelector("[data-server-detail-countdown]");
  const detailModalHint = document.querySelector("[data-server-detail-hint]");
  const detailModalSelection = document.querySelector("[data-server-detail-selection]");
  const detailModalTypeCounts = document.querySelector("[data-server-detail-type-counts]");
  const detailModalMaterials = document.querySelector("[data-server-detail-materials]");
  const detailCanvas = document.querySelector("[data-server-detail-map]");
  const detailCanvasShell = document.querySelector("[data-server-detail-map-shell]");
  const detailContinueButton = document.querySelector("[data-server-detail-continue]");
  const detailZoomInButton = document.querySelector("[data-server-detail-zoom-in]");
  const detailZoomOutButton = document.querySelector("[data-server-detail-zoom-out]");
  const detailZoomToggleButton = document.querySelector("[data-server-detail-zoom-toggle]");
  const detailCloseNodes = Array.from(document.querySelectorAll("[data-server-detail-close]"));

  const geometry = createDistrictGeometry(DISTRICT_CANVAS_WIDTH, DISTRICT_CANVAS_HEIGHT, 0, 0, 0);
  const selectableSpawnDistrictIds = new Set(
    geometry.districts
      .filter((district) => district.columnIndex >= 21 || (district.columnIndex <= 1 && district.rowIndex >= 5))
      .map((district) => district.id)
  );
  const availableServers = Array.isArray(SERVER_CATALOG) && SERVER_CATALOG.length > 0 ? SERVER_CATALOG : DEMO_SERVER_CATALOG;
  const state = {
    mode: registration?.serverMode || "war",
    serverId: registration?.serverId || "",
    hoveredDistrictId: null,
    selectedDistrictId: Number.parseInt(String(registration?.startDistrictId || ""), 10) || null,
    serverDistrictSelections: new Map(
      registration?.serverId && registration?.startDistrictId
        ? [[registration.serverId, Number.parseInt(String(registration.startDistrictId), 10)]]
        : []
    ),
    launchByServerId: Object.fromEntries(
      Object.entries(SERVER_COUNTDOWN_OFFSETS_MINUTES).map(([serverId, minutes]) => [
        serverId,
        Date.now() + (minutes * 60 * 1000)
      ])
    ),
    countdownTimer: null,
    detailZoom: 1
  };

  const normalizeSelectableDistrictId = (districtId) => {
    const normalizedDistrictId = Number.parseInt(String(districtId || ""), 10) || 0;
    return selectableSpawnDistrictIds.has(normalizedDistrictId) ? normalizedDistrictId : null;
  };

  const isSelectableSpawnDistrict = (district) => Boolean(district && selectableSpawnDistrictIds.has(Number(district.id || 0)));

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

  const getDistrictBaseColor = (districtType) => {
    if (districtType === "downtown") return "rgba(255, 78, 196, 0.28)";
    return "rgba(168, 176, 190, 0.16)";
  };

  const formatRemaining = (ms) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  };

  const getServerCountdownText = (serverId) => {
    const launchAt = Number(state.launchByServerId[serverId] || 0);
    if (!launchAt) {
      return "Online";
    }
    const msRemaining = launchAt - Date.now();
    if (msRemaining <= 0) {
      return "Start probíhá";
    }
    return `Začíná za ${formatRemaining(msRemaining)}`;
  };

  const getDistrictTypeCounts = () => {
    const counts = new Map();
    for (const district of geometry.districts) {
      const key = String(district.districtType || "other");
      counts.set(key, Number(counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries());
  };

  const renderTypeCountMarkup = () => getDistrictTypeCounts().map(([type, count]) => `
    <span class="server-detail-modal__type-count ${type === "downtown" ? "is-downtown" : ""}">
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
    return matches.length > 0 ? matches : DEMO_SERVER_CATALOG.filter((server) => server.mode === state.mode);
  };

  const getSelectedServer = () => availableServers.find((entry) => entry.id === state.serverId) || null;

  const isDetailModalOpen = () => detailModal instanceof HTMLElement && !detailModal.classList.contains("hidden");

  const setCanvasScale = (shell, zoomValue) => {
    if (!(shell instanceof HTMLElement)) {
      return;
    }

    shell.style.setProperty("--server-map-zoom", String(zoomValue));
    shell.style.setProperty("--server-map-scale", String(zoomValue));
  };

  const syncDetailZoomUi = () => {
    if (detailZoomToggleButton instanceof HTMLButtonElement) {
      detailZoomToggleButton.textContent = state.detailZoom > 1.02 ? "Zmenšit mapu" : "Zvětšit mapu";
    }
    if (detailZoomOutButton instanceof HTMLButtonElement) {
      detailZoomOutButton.disabled = state.detailZoom <= 1;
    }
    if (detailZoomInButton instanceof HTMLButtonElement) {
      detailZoomInButton.disabled = state.detailZoom >= 1.72;
    }
  };

  const applyDetailZoom = (zoomValue) => {
    const nextZoom = Math.min(1.72, Math.max(1, Number(zoomValue) || 1));
    state.detailZoom = nextZoom;
    setCanvasScale(detailCanvasShell, nextZoom);
    syncDetailZoomUi();
  };

  const commitLobbySelection = () => {
    if (!state.serverId || !state.selectedDistrictId) {
      return;
    }

    saveLobbyStep({
      serverId: state.serverId,
      districtId: state.selectedDistrictId
    });

    window.location.href = FACTION_ENTRY_HREF;
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

  const renderCanvasTo = (targetCanvas) => {
    if (!(targetCanvas instanceof HTMLCanvasElement)) {
      return;
    }

    const context = targetCanvas.getContext("2d");
    if (!context) {
      return;
    }

    const isDisabled = !state.serverId;
    const gradient = context.createLinearGradient(0, 0, targetCanvas.width, targetCanvas.height);
    gradient.addColorStop(0, "#07111e");
    gradient.addColorStop(0.5, "#0c1b2f");
    gradient.addColorStop(1, "#050911");
    context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    context.fillStyle = gradient;
    context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    for (const district of geometry.districts) {
      const isSelectable = isSelectableSpawnDistrict(district);
      const isSelected = district.id === state.selectedDistrictId;
      const isHovered = district.id === state.hoveredDistrictId;

      drawPolygon(context, district.polygon);
      context.fillStyle = isDisabled
        ? "rgba(148, 163, 184, 0.08)"
        : isSelected
          ? "rgba(255, 154, 61, 0.34)"
          : isHovered
            ? "rgba(103, 225, 255, 0.3)"
            : isSelectable
              ? getDistrictBaseColor(district.districtType)
              : district.districtType === "downtown"
                ? "rgba(255, 78, 196, 0.12)"
                : "rgba(120, 130, 144, 0.08)";
      context.fill();

      drawPolygon(context, district.polygon);
      context.strokeStyle = isDisabled
        ? "rgba(148, 163, 184, 0.24)"
        : isSelected
          ? "rgba(255, 154, 61, 0.96)"
          : isHovered
            ? "rgba(103, 225, 255, 0.96)"
            : isSelectable
              ? "rgba(245, 250, 255, 0.74)"
              : district.districtType === "downtown"
                ? "rgba(255, 103, 208, 0.28)"
                : "rgba(148, 163, 184, 0.18)";
      context.lineWidth = isSelected ? 3 : isHovered ? 2.4 : isSelectable ? 1.15 : 0.9;
      context.stroke();

      if (!isDisabled && isSelectable && (isSelected || isHovered)) {
        context.save();
        context.font = "700 18px Bahnschrift, Segoe UI, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = isSelected ? "#ffd7c2" : "#dff9ff";
        context.shadowBlur = 18;
        context.shadowColor = isSelected ? "rgba(255, 154, 61, 0.65)" : "rgba(103, 225, 255, 0.65)";
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
      context.fillText("Nejdřív vyber server", targetCanvas.width / 2, targetCanvas.height / 2);
      context.restore();
    }
  };

  const renderAllCanvases = () => {
    if (isDetailModalOpen()) {
      renderCanvasTo(detailCanvas);
    }
  };

  const updateLobbySummary = () => {
    const server = getSelectedServer();

    if (userLabel) {
      userLabel.textContent = registration?.identity || "Host";
    }

    if (userMeta) {
      userMeta.textContent = registration?.isGuest
        ? "Host účet · po výběru serveru pokračuješ do frakce"
        : "Přihlášený hráč · vyber server a startovní district";
    }

    if (summaryServer) {
      summaryServer.textContent = server?.name || "Nevybrán";
    }

    if (summaryDistrict) {
      summaryDistrict.textContent = state.selectedDistrictId ? `District ${state.selectedDistrictId}` : "Nevybrán";
    }

    if (summaryMode) {
      summaryMode.textContent = server ? server.mode.toUpperCase() : state.mode.toUpperCase();
    }

    if (flowNote) {
      flowNote.textContent = !server
        ? "Klikni na server, otevři detail a vyber startovní district."
        : state.selectedDistrictId
          ? `${server.name} • District ${state.selectedDistrictId} je připravený pro vstup do frakce.`
          : `${server.name} • otevři detail a zvol district vlevo dole nebo na pravém okraji.`;
      flowNote.setAttribute("data-state", state.selectedDistrictId ? "success" : "ready");
    }
  };

  const updateDetailModal = () => {
    const server = getSelectedServer();
    if (!server) {
      if (detailContinueButton instanceof HTMLButtonElement) {
        detailContinueButton.disabled = true;
      }
      if (detailModalHint) {
        detailModalHint.textContent = "Vyber server";
        detailModalHint.classList.add("is-required");
      }
      if (detailModalSelection) {
        detailModalSelection.textContent = "Vyber server pro aktivaci mapy.";
      }
      return;
    }

    if (detailModalTitle) {
      detailModalTitle.textContent = server.name;
    }
    if (detailModalSubtitle) {
      detailModalSubtitle.textContent = server.description;
    }
    if (detailModalMode) {
      detailModalMode.textContent = `Režim: ${server.mode.toUpperCase()}`;
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
      detailModalHint.textContent = state.selectedDistrictId ? `Start: District ${state.selectedDistrictId}` : "Edge district";
      detailModalHint.classList.toggle("is-required", !state.selectedDistrictId);
    }
    if (detailModalSelection) {
      detailModalSelection.textContent = state.selectedDistrictId
        ? `Vybraný start: District ${state.selectedDistrictId}`
        : "Vyber jen district vlevo dole nebo na pravém okraji mapy.";
    }
    if (detailContinueButton instanceof HTMLButtonElement) {
      detailContinueButton.disabled = !state.serverId || !state.selectedDistrictId;
    }
    if (detailModalTypeCounts instanceof HTMLElement) {
      detailModalTypeCounts.innerHTML = renderTypeCountMarkup();
    }
    if (detailModalMaterials instanceof HTMLElement) {
      const materials = START_PACKAGES[server.mode] || START_PACKAGES.war;
      detailModalMaterials.innerHTML = materials.map((item) => `<li>${item}</li>`).join("");
    }
  };

  const renderServerList = () => {
    if (!list) {
      return;
    }

    const servers = getVisibleServers();
    list.innerHTML = servers.map((server) => `
      <button type="button" class="auth-server-card ${server.id === state.serverId ? "is-selected" : ""}" data-server-card="${server.id}">
        <span class="auth-server-card__label">${server.name}</span>
        <span class="auth-server-card__subtitle">${server.description}</span>
        <span class="auth-server-card__meta">${server.region} • ${server.mode.toUpperCase()} • ${server.players}/${server.capacity}</span>
        <span class="auth-server-card__schedule">Start: ${server.startLabel}</span>
        <span class="auth-server-card__countdown" data-server-countdown="${server.id}">${getServerCountdownText(server.id)}</span>
      </button>
    `).join("");

    for (const button of list.querySelectorAll("[data-server-card]")) {
      button.addEventListener("click", () => {
        const nextServerId = String(button.getAttribute("data-server-card") || "");
        const previousServerId = state.serverId;
        state.serverId = nextServerId;
        if (nextServerId !== previousServerId) {
          state.selectedDistrictId = Number(state.serverDistrictSelections.get(nextServerId) || 0) || null;
        }
        updateLobbySummary();
        updateDetailModal();
        renderServerList();
        renderAllCanvases();
        applyDetailZoom(1);
        if (detailModal instanceof HTMLElement) {
          detailModal.classList.remove("hidden");
          detailModal.setAttribute("aria-hidden", "false");
        }
      });
    }
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
    return { x, y };
  };

  const closeDetailModal = () => {
    if (!(detailModal instanceof HTMLElement)) {
      return;
    }
    detailModal.classList.add("hidden");
    detailModal.setAttribute("aria-hidden", "true");
    applyDetailZoom(1);
  };

  const bindCanvasInteractions = (targetCanvas) => {
    if (!(targetCanvas instanceof HTMLCanvasElement)) {
      return;
    }

    targetCanvas.width = DISTRICT_CANVAS_WIDTH;
    targetCanvas.height = DISTRICT_CANVAS_HEIGHT;

    targetCanvas.addEventListener("mousemove", (event) => {
      if (!state.serverId) {
        state.hoveredDistrictId = null;
        renderAllCanvases();
        return;
      }

      const point = getCanvasPoint(targetCanvas, event);
      const district = point ? getDistrictAtPoint(geometry, point) : null;
      const selectableDistrict = isSelectableSpawnDistrict(district) ? district : null;
      state.hoveredDistrictId = selectableDistrict?.id ?? null;
      renderAllCanvases();
    });

    targetCanvas.addEventListener("mouseleave", () => {
      state.hoveredDistrictId = null;
      renderAllCanvases();
    });

    targetCanvas.addEventListener("click", (event) => {
      if (!state.serverId) {
        return;
      }

      const point = getCanvasPoint(targetCanvas, event);
      const district = point ? getDistrictAtPoint(geometry, point) : null;
      if (!district) {
        return;
      }
      if (!isSelectableSpawnDistrict(district)) {
        state.hoveredDistrictId = null;
        if (detailModalSelection) {
          detailModalSelection.textContent = "Vyber jen district vlevo dole nebo na pravém okraji mapy.";
        }
        if (detailModalHint) {
          detailModalHint.textContent = "Jen edge distrikty";
          detailModalHint.classList.add("is-required");
        }
        renderAllCanvases();
        return;
      }

      state.selectedDistrictId = district.id;
      if (state.serverId) {
        state.serverDistrictSelections.set(state.serverId, district.id);
      }
      updateLobbySummary();
      updateDetailModal();
      renderAllCanvases();
    });
  };

  bindCanvasInteractions(detailCanvas);

  detailContinueButton?.addEventListener("click", commitLobbySelection);
  detailZoomInButton?.addEventListener("click", () => applyDetailZoom(state.detailZoom + 0.18));
  detailZoomOutButton?.addEventListener("click", () => applyDetailZoom(state.detailZoom - 0.18));
  detailZoomToggleButton?.addEventListener("click", () => applyDetailZoom(state.detailZoom > 1.02 ? 1 : 1.55));

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
      const nextMode = String(button.getAttribute("data-server-mode-tab") || "war");
      state.mode = nextMode;
      state.serverId = "";
      state.hoveredDistrictId = null;
      closeDetailModal();
      tabs.forEach((tab) => {
        const isActive = tab === button;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });
      renderServerList();
      updateLobbySummary();
      updateDetailModal();
      renderAllCanvases();
    });
  }

  tabs.forEach((tab) => {
    const isActive = String(tab.getAttribute("data-server-mode-tab") || "") === state.mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  applyDetailZoom(state.detailZoom);

  renderServerList();
  updateLobbySummary();
  updateDetailModal();
  renderAllCanvases();
  ensureCountdownTicker();
  updateCountdowns();
});
