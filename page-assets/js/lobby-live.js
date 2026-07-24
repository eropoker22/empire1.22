import { createDistrictGeometry, getDistrictAtPoint } from "./app/district-geometry.js";
import {
  confirmSpawnDistrict,
  createMembershipJoinTicket,
  joinGameplayMembership,
  loadLobbyOverview,
  loadSpawnDistricts,
  logoutAccount
} from "./app/player-entry-client.js";
import { isLocalDemoAccessAvailable } from "./app/local-demo-gate.js";
import {
  createHostedRegistrationTicker,
  hostedRegistrationCtaLabel,
  hostedRegistrationDisabledCopy,
  resolveHostedRegistrationPresentation
} from "./app/hosted-registration-ui.js";

const POLL_MS = 15_000;
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 980;
const geometry = createDistrictGeometry(CANVAS_WIDTH, CANVAS_HEIGHT, 0, 48, 0);
const state = { overview: null, mode: "free", selectedServerId: null, spawn: null, selectedDistrictId: null, busy: false };
const registrationRefreshes = new Set();
const registrationTicker = createHostedRegistrationTicker({ onTick: updateRegistrationCountdowns });

const initialize = () => {
  bindNavigation();
  bindModal();
  bindModeTabs();
  void refresh(true);
  registrationTicker.start();
  window.setInterval(() => { if (!document.hidden && !state.busy) void refresh(false); }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) registrationTicker.stop();
    else {
      registrationTicker.start();
      void refresh(false);
    }
  });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
else initialize();

async function refresh(initial) {
  try {
    state.overview = await loadLobbyOverview();
    registrationTicker.syncServerTime(state.overview.generatedAt);
    const requested = new URLSearchParams(location.search).get("mode");
    if (initial && ["free", "war"].includes(requested)) state.mode = requested;
    if (!state.selectedServerId) state.selectedServerId = visibleServers()[0]?.serverInstanceId || null;
    render();
  } catch (error) {
    if (error?.code === "ACCOUNT_SESSION_REQUIRED" || error?.status === 401) {
      location.replace("./login.html");
      return;
    }
    setFlowMessage(error instanceof Error ? error.message : "Lobby teď není dostupná.", true);
  }
}

function render() {
  const overview = state.overview;
  if (!overview) return;
  text("[data-lobby-user]", overview.account.username);
  text("[data-lobby-top-user]", overview.account.username);
  text("[data-lobby-user-meta]", overview.gangProfile.gangName);
  text("[data-lobby-status-count]", `${overview.availableServers.reduce((sum, server) => sum + server.committedPlayers, 0)} aktivních hráčů`);
  text("[data-lobby-refresh-countdown]", "LIVE / 15 s");
  renderGang(overview);
  renderActiveMembership(overview.activeBlockingMembership);
  renderServers();
  renderSelectedServer();
  document.querySelectorAll("[data-server-mode-tab]").forEach((button) => {
    const active = button.dataset.serverModeTab === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function renderGang(overview) {
  text("[data-live-gang-name]", overview.gangProfile.gangName);
  text("[data-live-gang-user]", overview.account.username);
  const active = overview.activeBlockingMembership;
  text("[data-live-gang-server]", active ? active.serverDisplayName : "Žádný rozehraný server");
  text("[data-live-gang-membership]", active ? statusLabel(active.status) : "Připraven vybrat server");
  const identity = active?.factionId
    ? `${active.factionId} · ${active.avatarId || "avatar čeká"}`
    : active ? "Serverová identita čeká na dokončení" : "Bez serverové identity";
  text("[data-live-gang-identity]", identity);
  text("[data-live-gang-district]", active?.reservedSpawnDistrictId || "Bez rezervovaného districtu");
  const history = document.querySelector("[data-live-gang-history]");
  if (history) {
    const completed = overview.memberships.filter((membership) => membership.status === "completed");
    history.innerHTML = completed.length
      ? completed.map((membership) => {
        const result = membership.finalRank === null
          ? "výsledek se načítá"
          : `#${membership.finalRank} · ${membership.finalScore === null ? "—" : Math.round(membership.finalScore).toLocaleString("cs-CZ")} Empire Score`;
        return `<li><strong>${escapeHtml(membership.serverDisplayName)}</strong><span>${escapeHtml(result)}</span></li>`;
      }).join("")
      : "<li>Žádný dokončený server.</li>";
  }
}

function renderActiveMembership(membership) {
  const card = document.querySelector("[data-lobby-active-server-card]");
  if (!card) return;
  card.hidden = !membership;
  if (!membership) return;
  text("[data-active-server-name]", membership.serverDisplayName);
  text("[data-active-server-mode]", membership.factionId || "SETUP");
  text("[data-active-server-status]", statusLabel(membership.status));
  text("[data-active-server-district]", membership.reservedSpawnDistrictId);
  text("[data-active-server-note]", membership.status === "setup_required" || membership.status === "finalizing_setup"
    ? "District i kapacita jsou potvrzené serverem. Dokonči serverovou identitu."
    : "Návrat do lobby membership nemění.");
  const button = document.querySelector("[data-lobby-continue-active]");
  if (!(button instanceof HTMLButtonElement)) return;
  button.disabled = membership.status === "defeated" || membership.status === "leave_pending";
  button.textContent = membership.status === "setup_required" || membership.status === "finalizing_setup"
    ? "DOKONČIT VSTUP" : membership.status === "active" ? "POKRAČOVAT VE HŘE" : "VÝSLEDKY";
  button.onclick = () => void continueMembership(membership);
}

function renderServers() {
  const list = document.querySelector("[data-server-list]");
  if (!list) return;
  const blocking = state.overview.activeBlockingMembership;
  const servers = visibleServers();
  list.innerHTML = servers.length ? servers.map((server) => {
    const selected = server.serverInstanceId === state.selectedServerId;
    const presentation = registrationPresentation(server);
    const disabled = Boolean(blocking) || !presentation.locallyJoinable;
    const cta = blocking ? "ROZEHRANÝ SERVER BLOKUJE VSTUP" : hostedRegistrationCtaLabel(server, registrationTicker.nowMs());
    const disabledTitle = blocking ? "Nejdřív dokonči rozehraný server." : hostedRegistrationDisabledCopy(server.disabledReason);
    return `<article class="auth-server-card live-server-card ${selected ? "is-selected" : ""} ${disabled ? "is-locked" : ""}"
      data-live-server="${escapeHtml(server.serverInstanceId)}" data-server-mode="${escapeHtml(server.mode)}">
      <button type="button" class="live-server-card__main" data-select-live-server="${escapeHtml(server.serverInstanceId)}">
        <span class="auth-server-card__meta">${escapeHtml(server.region)} · ${escapeHtml(server.mode.toUpperCase())}</span>
        <strong class="auth-server-card__label">${escapeHtml(server.displayName)}</strong>
        <small class="auth-server-card__subtitle">${server.committedPlayers} hráčů + ${server.reservedSlots} rezervací / ${server.capacity}</small>
        <span class="auth-server-card__status" data-live-registration-status="${escapeHtml(server.serverInstanceId)}">${escapeHtml(presentation.statusLabel)}</span>
        <span class="auth-server-card__schedule" data-live-registration-schedule="${escapeHtml(server.serverInstanceId)}">${escapeHtml(presentation.scheduleLabel)}</span>
        <span class="auth-server-card__countdown" data-live-registration-countdown="${escapeHtml(server.serverInstanceId)}">${escapeHtml(presentation.countdownLabel)}</span>
      </button>
      <button type="button" class="lobby-primary-cta" data-open-live-server="${escapeHtml(server.serverInstanceId)}"
        ${disabled ? `disabled title="${escapeHtml(disabledTitle)}"` : ""}>${escapeHtml(cta)}</button>
    </article>`;
  }).join("") : '<p class="lobby-empty-state">Herní servery zatím nejsou spuštěné.</p>';
  list.querySelectorAll("[data-select-live-server]").forEach((button) => button.addEventListener("click", () => selectServer(button.dataset.selectLiveServer)));
  list.querySelectorAll("[data-open-live-server]").forEach((button) => button.addEventListener("click", () => void openSpawnModal(button.dataset.openLiveServer)));
}

function renderSelectedServer() {
  const server = selectedServer();
  text("[data-lobby-detail-name]", server?.displayName || "Nevybrán");
  text("[data-lobby-detail-region]", server?.region || "-");
  text("[data-lobby-detail-status]", server ? server.status.toUpperCase() : "-");
  text("[data-lobby-detail-mode]", server?.mode?.toUpperCase() || "-");
  text("[data-lobby-detail-capacity]", server ? `${server.committedPlayers} + ${server.reservedSlots} / ${server.capacity}` : "-");
  const presentation = server ? registrationPresentation(server) : null;
  text("[data-lobby-detail-registration-status]", presentation?.statusLabel || "-");
  text("[data-lobby-detail-registration-countdown]", presentation ? `${presentation.scheduleLabel}${presentation.countdownLabel ? ` · ${presentation.countdownLabel}` : ""}` : "");
  text("[data-lobby-detail-description]", server ? `Durable hosted server · ${server.disabledReason ? hostedRegistrationDisabledCopy(server.disabledReason) : "vstup je otevřený"}` : "Vyber server pro detail.");
  text("[data-lobby-summary-server]", server?.displayName || "Nevybrán");
  text("[data-lobby-summary-mode]", state.mode.toUpperCase());
  text("[data-lobby-summary-district]", state.selectedDistrictId || "Nevybrán");
  const open = document.querySelector("[data-lobby-open-selected]");
  if (open instanceof HTMLButtonElement) {
    open.disabled = !presentation?.locallyJoinable || Boolean(state.overview?.activeBlockingMembership);
    open.textContent = state.overview?.activeBlockingMembership ? "ROZEHRANÝ SERVER BLOKUJE VSTUP"
      : server ? hostedRegistrationCtaLabel(server, registrationTicker.nowMs()) : "VYBRAT DISTRICT";
    open.onclick = () => void openSpawnModal(server?.serverInstanceId);
  }
}

function bindModeTabs() {
  document.querySelectorAll("[data-server-mode-tab]").forEach((button) => button.addEventListener("click", () => {
    state.mode = button.dataset.serverModeTab === "war" ? "war" : "free";
    state.selectedServerId = visibleServers()[0]?.serverInstanceId || null;
    render();
  }));
}

function bindNavigation() {
  document.querySelectorAll("[data-lobby-nav-target]").forEach((button) => button.addEventListener("click", () => {
    if (button.disabled) return;
    const target = button.dataset.lobbyNavTarget;
    document.querySelectorAll("[data-lobby-view]").forEach((view) => { view.hidden = view.dataset.lobbyView !== target; });
    document.querySelectorAll("[data-lobby-nav-target]").forEach((item) => item.classList.toggle("is-active", item === button));
  }));
  document.querySelector("[data-live-account-logout]")?.addEventListener("click", () => void performLogout());
  const demoAccess = document.querySelector("[data-local-demo-access]");
  const openDemo = document.querySelector("[data-open-local-demo]");
  if (demoAccess instanceof HTMLElement && isLocalDemoAccessAvailable()) {
    demoAccess.hidden = false;
    openDemo?.addEventListener("click", () => location.assign("./login.html?runtimeMode=local-demo"));
  }
}

function bindModal() {
  document.querySelectorAll("[data-server-detail-close]").forEach((node) => node.addEventListener("click", closeSpawnModal));
  document.querySelector("[data-server-detail-continue]")?.addEventListener("click", () => void commitSpawn());
  const canvas = document.querySelector("[data-server-detail-map]");
  canvas?.addEventListener("click", (event) => {
    if (!state.spawn || state.busy) return;
    const rect = canvas.getBoundingClientRect();
    const district = getDistrictAtPoint(geometry, {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
    });
    const canonicalId = district ? `district:${district.id}` : null;
    const option = state.spawn.districts.find((entry) => entry.districtId === canonicalId);
    if (!option?.available) return;
    state.selectedDistrictId = option.districtId;
    text("[data-server-detail-hint]", `${option.label} · VYBRANÝ V NÁHLEDU`);
    renderSpawnCanvas();
    updateConfirmButton();
  });
}

async function openSpawnModal(serverInstanceId) {
  const server = state.overview?.availableServers.find((entry) => entry.serverInstanceId === serverInstanceId);
  if (!server || !registrationPresentation(server).locallyJoinable || state.overview.activeBlockingMembership) return;
  state.busy = true;
  state.selectedServerId = serverInstanceId;
  state.selectedDistrictId = null;
  setFlowMessage("Načítám aktuální spawn distrikty…");
  try {
    state.spawn = await loadSpawnDistricts(serverInstanceId);
    const modal = document.querySelector("[data-server-detail-modal]");
    modal?.classList.remove("hidden");
    modal?.setAttribute("aria-hidden", "false");
    text("[data-server-detail-title]", server.displayName);
    text("[data-server-detail-subtitle]", "Kliknutí pouze označí district. Rezervaci provede až POTVRDIT.");
    text("[data-server-detail-capacity]", `${state.spawn.capacity.committedPlayers} + ${state.spawn.capacity.reservedSlots} / ${state.spawn.capacity.maximum}`);
    text("[data-server-detail-countdown]", registrationPresentation(server).countdownLabel);
    text("[data-server-detail-hint]", "Vyber jeden serverem povolený district");
    renderSpawnCanvas();
  } catch (error) {
    setFlowMessage(messageFor(error), true);
  } finally {
    state.busy = false;
    updateConfirmButton();
    renderSelectedServer();
  }
}

function closeSpawnModal() {
  const modal = document.querySelector("[data-server-detail-modal]");
  modal?.classList.add("hidden");
  modal?.setAttribute("aria-hidden", "true");
  state.spawn = null;
  state.selectedDistrictId = null;
}

function renderSpawnCanvas() {
  const canvas = document.querySelector("[data-server-detail-map]");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#050713";
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const options = new Map((state.spawn?.districts || []).map((entry) => [entry.districtId, entry]));
  for (const district of geometry.districts) {
    const option = options.get(`district:${district.id}`);
    const selected = option?.districtId === state.selectedDistrictId;
    context.beginPath();
    district.polygon.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
    context.closePath();
    context.fillStyle = selected ? "rgba(255,43,214,.52)" : option?.available ? "rgba(34,211,238,.26)" : "rgba(71,85,105,.12)";
    context.strokeStyle = selected ? "#ff2bd6" : option?.available ? "#22d3ee" : "rgba(100,116,139,.25)";
    context.lineWidth = selected ? 5 : option?.available ? 2 : 1;
    context.fill();
    context.stroke();
  }
}

async function commitSpawn() {
  if (!state.spawn || !state.selectedDistrictId || state.busy) return;
  state.busy = true;
  updateConfirmButton();
  try {
    const membership = await confirmSpawnDistrict({
      serverInstanceId: state.spawn.serverInstanceId,
      districtId: state.selectedDistrictId,
      expectedAvailabilityRevision: state.spawn.availabilityRevision
    });
    location.assign(`./faction.html?membership=${encodeURIComponent(membership.membershipId)}`);
  } catch (error) {
    text("[data-server-detail-hint]", messageFor(error));
    if (["SPAWN_ALREADY_RESERVED", "SPAWN_SELECTION_STALE", "SERVER_FULL"].includes(error?.code)) {
      state.spawn = await loadSpawnDistricts(state.spawn.serverInstanceId).catch(() => state.spawn);
      state.selectedDistrictId = null;
      renderSpawnCanvas();
    }
    if (["SERVER_REGISTRATION_CLOSED", "SERVER_REGISTRATION_CLOSED_EARLY", "SERVER_REGISTRATION_NOT_OPEN"].includes(error?.code)) {
      state.selectedDistrictId = null;
      void refresh(false);
    }
  } finally {
    state.busy = false;
    updateConfirmButton();
  }
}

async function continueMembership(membership) {
  if (["setup_required", "finalizing_setup"].includes(membership.status)) {
    location.assign(`./faction.html?membership=${encodeURIComponent(membership.membershipId)}`);
    return;
  }
  if (membership.status !== "active") return;
  state.busy = true;
  try {
    const ticketed = await createMembershipJoinTicket(membership.membershipId);
    await joinGameplayMembership(ticketed);
    location.assign("./game.html");
  } catch (error) {
    setFlowMessage(messageFor(error), true);
  } finally {
    state.busy = false;
  }
}

async function performLogout() {
  try {
    await fetch("/api/gameplay-slice/logout", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
    await logoutAccount();
  } finally {
    location.replace("./login.html");
  }
}

function selectServer(serverId) { state.selectedServerId = serverId; state.selectedDistrictId = null; render(); }
function selectedServer() { return state.overview?.availableServers.find((server) => server.serverInstanceId === state.selectedServerId) || null; }
function visibleServers() { return (state.overview?.availableServers || []).filter((server) => server.mode === state.mode); }
function updateConfirmButton() {
  const button = document.querySelector("[data-server-detail-continue]");
  if (button instanceof HTMLButtonElement) {
    const server = state.overview?.availableServers.find((entry) => entry.serverInstanceId === state.spawn?.serverInstanceId);
    button.disabled = state.busy || !state.selectedDistrictId || !server || !registrationPresentation(server).locallyJoinable;
    button.textContent = state.busy ? "POTVRZUJI…" : "POTVRDIT";
  }
}
function setFlowMessage(message, error = false) {
  const node = document.querySelector("[data-lobby-flow-note]");
  if (!node) return;
  node.textContent = message;
  node.dataset.state = error ? "error" : "info";
}
function statusLabel(status) { return ({ setup_required: "DOKONČIT VSTUP", finalizing_setup: "AKTIVACE PROBÍHÁ", active: "AKTIVNÍ", leave_pending: "ODCHOD PROBÍHÁ", defeated: "PORAŽEN", completed: "DOKONČENO", left_early: "OPUŠTĚNO" })[status] || String(status).toUpperCase(); }
function messageFor(error) { return ({ SPAWN_ALREADY_RESERVED: "Tento district mezitím získal jiný hráč. Vyber si jiný.", SERVER_FULL: "Server se mezitím zaplnil.", SERVER_REGISTRATION_NOT_OPEN: "Registrace na tento server ještě nezačala.", SERVER_REGISTRATION_CLOSED: "Registrační okno tohoto serveru už skončilo.", SERVER_REGISTRATION_CLOSED_EARLY: "Registrace na tento server byla nouzově ukončena.", ACTIVE_MEMBERSHIP_EXISTS: "Nejdřív musíš dokončit nebo opustit svůj současný server.", SERVER_OFFLINE: "Server teď není dostupný. Tvoje předchozí membershipy zůstávají zachované." })[error?.code] || (error instanceof Error ? error.message : "Operace se nezdařila."); }
function text(selector, value) { const node = document.querySelector(selector); if (node) node.textContent = String(value ?? ""); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }

function registrationPresentation(server) {
  return resolveHostedRegistrationPresentation(server, registrationTicker.nowMs());
}

function updateRegistrationCountdowns(nowMs) {
  if (!state.overview) return;
  for (const server of state.overview.availableServers) {
    const presentation = resolveHostedRegistrationPresentation(server, nowMs);
    text(`[data-live-registration-status="${cssEscape(server.serverInstanceId)}"]`, presentation.statusLabel);
    text(`[data-live-registration-schedule="${cssEscape(server.serverInstanceId)}"]`, presentation.scheduleLabel);
    text(`[data-live-registration-countdown="${cssEscape(server.serverInstanceId)}"]`, presentation.countdownLabel);
    const button = document.querySelector(`[data-open-live-server="${cssEscape(server.serverInstanceId)}"]`);
    if (button instanceof HTMLButtonElement && !state.overview.activeBlockingMembership) {
      button.disabled = !presentation.locallyJoinable;
      button.textContent = hostedRegistrationCtaLabel(server, nowMs);
      button.title = presentation.locallyJoinable ? "" : hostedRegistrationDisabledCopy(server.disabledReason);
    }
    if (presentation.needsRefresh && !state.busy) {
      const key = `${server.serverInstanceId}:${server.registrationState}:${server.registrationOpensAt}:${server.registrationClosesAt}`;
      if (!registrationRefreshes.has(key)) {
        registrationRefreshes.add(key);
        void refresh(false);
      }
    }
  }
  renderSelectedRegistration(nowMs);
  updateConfirmButton();
}

function renderSelectedRegistration(nowMs) {
  const server = selectedServer();
  if (!server) return;
  const presentation = resolveHostedRegistrationPresentation(server, nowMs);
  text("[data-lobby-detail-registration-status]", presentation.statusLabel);
  text("[data-lobby-detail-registration-countdown]", `${presentation.scheduleLabel}${presentation.countdownLabel ? ` · ${presentation.countdownLabel}` : ""}`);
  if (state.spawn?.serverInstanceId === server.serverInstanceId) text("[data-server-detail-countdown]", presentation.countdownLabel);
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(String(value)) : String(value).replace(/([:\\.])/g, "\\$1");
}
