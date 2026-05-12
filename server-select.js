import { STORAGE_KEYS } from "./page-assets/js/config.js";

const ENABLE_FAKE_REDIRECT = false;
const STORAGE_KEY = STORAGE_KEYS.selectedServer;

const mockPlayer = {
  id: "guest-5470",
  name: "Host-5470",
  accountType: "guest",
  level: 1,
  xp: 0,
  xpMax: 100,
  credits: 0,
  selectedServerId: null,
  selectedMode: "WAR",
  selectedDistrictId: null
};

const mockGlobalState = {
  onlinePlayers: 17120,
  heatLevel: 78,
  marketVolatility: "VERY HIGH",
  events: [
    {
      id: "police-raid",
      type: "raid",
      title: "POLICE RAID",
      description: "Zvýšená aktivita policie v sektoru Downtown a Industrial.",
      time: "08:42",
      icon: "◇"
    },
    {
      id: "toxic-trap",
      type: "toxic",
      title: "TOXIC TRAP",
      description: "Toxické pasti jsou aktivní v Park zóně. Vyšší riziko, vyšší odměna.",
      time: "18:27",
      icon: "☠"
    },
    {
      id: "gang-war",
      type: "war",
      title: "GANG WAR",
      description: "Probíhá válka o území mezi gangy Night Vultures a Purple Cobras.",
      time: "21:15",
      icon: "✣"
    }
  ]
};

const mockNavModules = {
  city: {
    title: "VÝBĚR MĚSTA",
    toast: "Server selection protocol aktivní."
  },
  gang: {
    icon: "♟",
    kicker: "GANG DOSSIER",
    title: "MOJE GANG",
    subtitle: "Gang karta bude dostupná po vstupu na server.",
    lines: ["ČLENOVÉ: 1", "RESPEKT: 0", "AKTIVNÍ BONUSY: žádné"]
  },
  market: {
    icon: "▱",
    kicker: "BLACK MARKET LINK",
    title: "OBCHOD",
    subtitle: "Market modul čeká na výběr města a server sync.",
    lines: ["KREDITY: 0", "VOLATILITY: VERY HIGH", "LUXURY DEALER: signál zachycen"]
  },
  settings: {
    icon: "⚙",
    kicker: "TERMINAL CONFIG",
    title: "NASTAVENÍ",
    subtitle: "Nastavení účtu a zvuku bude napojené v další části launcheru.",
    lines: ["ZVUK: připraveno", "JAZYK: CS", "REŽIM: HOST"]
  }
};

const mockServers = [
  {
    id: "war-01",
    name: "Vortex City WAR-01",
    mode: "WAR",
    region: "EU CENTRAL",
    players: 64,
    maxPlayers: 150,
    status: "ONLINE",
    badge: "DOPORUČENO",
    risk: "HIGH",
    heat: 78,
    activity: "HIGH",
    description: "Tvrdý válečný shard s rychlou expanzí, hustší konkurencí a tlakem na obranu districtů.",
    liveInfo: "Live server",
    locked: false,
    full: false
  },
  {
    id: "war-02",
    name: "Black Harbor WAR-02",
    mode: "WAR",
    region: "EU CENTRAL",
    players: 41,
    maxPlayers: 150,
    status: "ONLINE",
    badge: null,
    risk: "MEDIUM",
    heat: 52,
    activity: "MEDIUM",
    description: "Čerstvě otevřená instance, vhodná pro nový náběh a rychlé obsazení startovní pozice.",
    liveInfo: "Začíná za 00h 11m 48s",
    locked: false,
    full: false
  },
  {
    id: "war-03",
    name: "Red Sector WAR-03",
    mode: "WAR",
    region: "EU CENTRAL",
    players: 22,
    maxPlayers: 150,
    status: "VYSOKÁ",
    badge: null,
    risk: "HIGH",
    heat: 69,
    activity: "HIGH",
    description: "Vyvážený server s aktivní komunitou a častými bitvami.",
    liveInfo: "Live server",
    locked: false,
    full: false
  },
  {
    id: "war-04",
    name: "Iron Gate WAR-04",
    mode: "WAR",
    region: "EU CENTRAL",
    players: 0,
    maxPlayers: 150,
    status: "PŘIPRAVUJEME",
    badge: null,
    risk: "UNKNOWN",
    heat: 0,
    activity: "LOW",
    description: "Připravujeme spuštění serveru. Sleduj oznámení.",
    liveInfo: "Locked",
    locked: true,
    full: false
  },
  {
    id: "war-05",
    name: "Kingmaker WAR-05",
    mode: "WAR",
    region: "EU CENTRAL",
    players: 5,
    maxPlayers: 150,
    status: "LOCKED",
    badge: "PREMIUM",
    risk: "UNKNOWN",
    heat: 0,
    activity: "LOW",
    description: "Nový válečný shard pro elitní gangy.",
    liveInfo: "Premium required",
    locked: true,
    full: false
  },
  {
    id: "free-01",
    name: "Neon Docks FREE-01",
    mode: "FREE",
    region: "EU CENTRAL",
    players: 17,
    maxPlayers: 20,
    status: "ONLINE",
    badge: "NEJLEPŠÍ START",
    risk: "MEDIUM",
    heat: 42,
    activity: "MEDIUM",
    description: "Rychlá válka o město. Ideální pro první vstup do Empire Streets.",
    liveInfo: "Končí za 01h 18m",
    locked: false,
    full: false
  },
  {
    id: "free-02",
    name: "Lowtown Riot FREE-02",
    mode: "FREE",
    region: "EU CENTRAL",
    players: 20,
    maxPlayers: 20,
    status: "FULL",
    badge: null,
    risk: "EXTREME",
    heat: 81,
    activity: "HIGH",
    description: "Krátká session plná chaosu. Server je momentálně plný.",
    liveInfo: "Končí za 00h 47m",
    locked: false,
    full: true
  },
  {
    id: "free-03",
    name: "Rain Market FREE-03",
    mode: "FREE",
    region: "EU CENTRAL",
    players: 12,
    maxPlayers: 20,
    status: "ONLINE",
    badge: null,
    risk: "LOW",
    heat: 28,
    activity: "LOW",
    description: "Vyvážená ekonomika, rychlý start, nízký heat.",
    liveInfo: "Končí za 01h 42m",
    locked: false,
    full: false
  }
];

const mockDistricts = [
  {
    id: "residential",
    name: "Residential",
    label: "RESIDENTIAL",
    color: "yellow",
    description: "Bezpečnější start s lepší populací a stabilnější obranou.",
    icon: "⌂",
    path: "M72,95 L210,50 L326,88 L302,205 L168,232 L74,178 Z",
    labelX: 188,
    labelY: 145
  },
  {
    id: "downtown",
    name: "Downtown",
    label: "DOWNTOWN",
    color: "pink",
    description: "Bohaté centrum s vysokým income, ale vysokým police heatem.",
    icon: "▥",
    path: "M318,74 L540,58 L676,118 L624,290 L458,312 L318,222 Z",
    labelX: 502,
    labelY: 168
  },
  {
    id: "park",
    name: "Park",
    label: "PARK",
    color: "green",
    description: "Riziková zóna s pastmi, dealery a rychlými příležitostmi.",
    icon: "♟",
    path: "M242,238 L396,214 L482,318 L424,438 L264,420 L188,318 Z",
    labelX: 338,
    labelY: 332
  },
  {
    id: "industrial",
    name: "Industrial",
    label: "INDUSTRIAL",
    color: "gray",
    description: "Výroba, továrny a tvrdá ekonomika pro dlouhou válku.",
    icon: "▦",
    path: "M78,282 L204,246 L278,412 L220,532 L82,490 L34,360 Z",
    labelX: 154,
    labelY: 405
  },
  {
    id: "commercial",
    name: "Commercial",
    label: "COMMERCIAL",
    color: "blue",
    description: "Obchod, cashflow a dobrý přístup k marketu.",
    icon: "▥",
    path: "M446,348 L632,302 L722,416 L650,542 L482,500 Z",
    labelX: 590,
    labelY: 430
  }
];

const selectionState = {
  mode: "WAR",
  selectedServerId: null,
  selectedDistrictId: null
};

const navState = {
  active: "city"
};

const zoneColors = {
  yellow: "#d6a84f",
  green: "#39ff88",
  pink: "#ff2bd6",
  gray: "#b0bac8",
  blue: "#2196ff",
  red: "#ff3347"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function getPlayer() {
  return mockPlayer;
}

function getGlobalState() {
  return mockGlobalState;
}

function getServers() {
  return mockServers;
}

function getDistricts() {
  return mockDistricts;
}

function getVisibleServers() {
  return getServers().filter((server) => server.mode === selectionState.mode);
}

function getSelectedServer() {
  return getServers().find((server) => server.id === selectionState.selectedServerId) || null;
}

function getSelectedDistrict() {
  return getDistricts().find((district) => district.id === selectionState.selectedDistrictId) || null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("cs-CZ").format(Number(value) || 0);
}

function activityBars(activity) {
  const count = activity === "HIGH" ? 4 : activity === "MEDIUM" ? 3 : 1;
  return `<span class="signal" aria-label="Aktivita ${escapeHtml(activity)}">${[1, 2, 3, 4].map((index) => (
    `<i style="opacity:${index <= count ? 1 : 0.28}"></i>`
  )).join("")}</span>`;
}

function renderApp() {
  renderTopbar();
  renderNavigationPanel();
  renderSidebar();
  renderPlayerSummary();
  renderModeTabs();
  renderServerList();
  renderDistrictMap();
  renderServerDetails();
}

function renderTopbar() {
  const player = getPlayer();
  const mount = $("[data-player-topbar]");
  renderTopbarNavigation();
  if (!mount) return;
  const xp = Number(player.xp) || 0;
  const xpMax = Number(player.xpMax) || 100;
  const xpPercent = Math.max(0, Math.min(100, (xp / xpMax) * 100));
  mount.innerHTML = `
    <div class="top-player__avatar" aria-hidden="true"></div>
    <div>
      <span class="top-player__name">${escapeHtml(player.name)}</span>
      <span class="top-player__meta">ÚROVEŇ ${player.level}</span>
      <div class="xp-bar" aria-label="${xp} z ${xpMax} XP"><i style="width:${xpPercent}%"></i></div>
      <span class="top-player__meta">${xp} / ${xpMax} XP</span>
    </div>
    <strong class="top-player__credits">🟡 ${player.credits} kreditů</strong>
  `;
}

function renderTopbarNavigation() {
  $$("[data-nav]").forEach((button) => {
    const isActive = button.getAttribute("data-nav") === navState.active;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function bindNavigation() {
  $$("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPanel = button.getAttribute("data-nav") || "city";
      if (nextPanel === navState.active) return;
      navState.active = nextPanel;
      renderTopbarNavigation();
      renderNavigationPanel();
      const module = mockNavModules[nextPanel];
      showToast(module?.toast || `${module?.title || "Modul"} připraven.`, nextPanel === "city" ? "success" : "info");
    });
  });
}

function renderNavigationPanel() {
  const mount = $("[data-nav-panel]");
  if (!mount) return;
  if (navState.active === "city") {
    mount.hidden = true;
    mount.innerHTML = "";
    return;
  }

  const module = mockNavModules[navState.active] || mockNavModules.gang;
  mount.hidden = false;
  mount.innerHTML = `
    <div class="nav-module-card">
      <span class="nav-module-card__icon" aria-hidden="true">${escapeHtml(module.icon)}</span>
      <div>
        <span class="panel-kicker">${escapeHtml(module.kicker)}</span>
        <h2>${escapeHtml(module.title)}</h2>
        <p>${escapeHtml(module.subtitle)}</p>
        <div class="nav-module-card__lines">
          ${(module.lines || []).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
        </div>
      </div>
      <button type="button" data-return-city>VRÁTIT NA VÝBĚR MĚSTA</button>
    </div>
  `;
  mount.querySelector("[data-return-city]")?.addEventListener("click", () => {
    navState.active = "city";
    renderTopbarNavigation();
    renderNavigationPanel();
  });
}

function renderSidebar() {
  const state = getGlobalState();
  const mount = $("[data-sidebar]");
  if (!mount) return;
  mount.innerHTML = `
    <section class="hud-card logo-card">
      <strong>EMPIRE<br><span>STREETS</span></strong>
    </section>
    <section class="hud-card status-card">
      <h2>SERVER STATUS</h2>
      <strong class="hud-card__big">● ONLINE</strong>
      <p>${formatNumber(state.onlinePlayers)} hráčů online</p>
    </section>
    <section class="hud-card heat-card">
      <h2>HEAT LEVEL</h2>
      <strong class="hud-card__big">${state.heatLevel} %</strong>
      <div class="meter heat-meter"><i style="width:${state.heatLevel}%"></i></div>
    </section>
    <section class="hud-card market-card">
      <h2>MARKET VOLATILITY</h2>
      <strong class="hud-card__big">${escapeHtml(state.marketVolatility)}</strong>
      <svg class="sparkline" viewBox="0 0 180 48" aria-hidden="true">
        <polyline points="0,35 12,30 20,36 34,25 44,31 55,18 66,32 76,17 88,29 100,20 114,35 128,19 142,24 154,13 166,27 180,18"></polyline>
      </svg>
    </section>
    <section class="hud-card events-card">
      <h2>AKTIVNÍ UDÁLOSTI</h2>
      ${state.events.map((event) => `
        <article class="event-item event-item--${escapeHtml(event.type)}">
          <span class="event-item__icon">${escapeHtml(event.icon)}</span>
          <div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.description)}</p></div>
          <time>${escapeHtml(event.time)}</time>
        </article>
      `).join("")}
    </section>
    <section class="hud-card promo-card">
      <strong>TRUST NOBODY.<br>CONTROL EVERYTHING.</strong>
    </section>
  `;
}

function renderPlayerSummary() {
  const player = getPlayer();
  const server = getSelectedServer();
  const district = getSelectedDistrict();
  const mount = $("[data-player-summary]");
  if (!mount) return;
  mount.innerHTML = `
    <div class="player-summary__avatar" aria-hidden="true"></div>
    <div>
      <span class="panel-kicker">PŘIHLÁŠENÝ HRÁČ</span>
      <h2>${escapeHtml(player.name)}</h2>
      <p>Host účet • po výběru serveru pokračuješ do hry</p>
    </div>
    <div class="summary-grid">
      <div class="summary-box ${server ? "is-filled" : ""}"><span>SERVER</span><strong>${escapeHtml(server?.name || "Nevybrán")}</strong></div>
      <div class="summary-box is-filled"><span>REŽIM</span><strong>${escapeHtml(selectionState.mode)}</strong></div>
      <div class="summary-box ${district ? "is-filled" : ""}"><span>DISTRICT</span><strong>${escapeHtml(district?.label || "Nevybrán")}</strong></div>
    </div>
  `;
}

function renderModeTabs() {
  const mount = $("[data-mode-tabs]");
  if (!mount) return;
  mount.innerHTML = ["WAR", "FREE"].map((mode) => `
    <button class="mode-tab ${selectionState.mode === mode ? "is-active" : ""}" type="button" data-mode="${mode}">
      ${mode === "WAR" ? "☠ WAR SERVERS" : "🪽 FREE SERVERS"}
    </button>
  `).join("");
  mount.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextMode = button.getAttribute("data-mode");
      if (!nextMode || nextMode === selectionState.mode) return;
      const firstAvailable = getServers().find((server) => server.mode === nextMode && !server.full && !server.locked);
      updateSelection({
        mode: nextMode,
        selectedServerId: firstAvailable?.id || null,
        selectedDistrictId: null
      });
      showToast(`Režim přepnut na ${nextMode}.`, "info");
    });
  });
}

function renderServerList() {
  const mount = $("[data-server-list]");
  if (!mount) return;
  mount.innerHTML = getVisibleServers().map((server) => {
    const ratio = Math.max(0, Math.min(100, (server.players / server.maxPlayers) * 100));
    const disabled = server.full || server.locked;
    return `
      <button class="server-card ${selectionState.selectedServerId === server.id ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}"
        type="button" data-server-id="${escapeHtml(server.id)}" data-mode="${escapeHtml(server.mode)}">
        <span class="server-card__icon">${server.locked ? "▣" : server.mode === "WAR" ? "☠" : "🪽"}</span>
        <span class="server-card__body">
          <h3>${escapeHtml(server.name)}</h3>
          <span class="server-card__meta">${escapeHtml(server.region)} • ${escapeHtml(server.mode)} • ${server.players} / ${server.maxPlayers}</span>
          <p>${escapeHtml(server.description)}</p>
          <span class="player-fill"><i style="width:${ratio}%"></i></span>
        </span>
        <span class="server-card__side">
          ${server.badge ? `<span class="badge">${escapeHtml(server.badge)}</span>` : ""}
          <span class="status ${server.full ? "is-full" : ""} ${server.locked ? "is-locked" : ""}">${escapeHtml(server.status)}</span>
          ${activityBars(server.activity)}
        </span>
      </button>
    `;
  }).join("");

  mount.querySelectorAll("[data-server-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const server = getServers().find((entry) => entry.id === button.getAttribute("data-server-id"));
      if (!server) return;
      if (server.full) {
        showToast("SERVER PLNÝ — TADY UŽ NENÍ MÍSTO PRO DALŠÍHO BOSSE.", "error");
        return;
      }
      if (server.locked) {
        showToast("SERVER ZAMČENÝ — VSTUP ZATÍM NENÍ DOSTUPNÝ.", "warning");
        return;
      }
      updateSelection({ selectedServerId: server.id });
      showToast(`${server.name} vybrán.`, "success");
    });
  });
}

function renderDistrictMap() {
  const mount = $("[data-district-map]");
  const legend = $("[data-district-legend]");
  if (!mount) return;
  mount.innerHTML = `
    <svg class="district-svg" viewBox="0 0 760 580" role="img" aria-label="Mapa districtů">
      ${getDistricts().map((district) => {
        const color = zoneColors[district.color] || zoneColors.blue;
        return `
          <g class="district-zone ${selectionState.selectedDistrictId === district.id ? "is-selected" : ""}"
             data-district-id="${escapeHtml(district.id)}" style="--zone:${color}" role="button" tabindex="0" aria-label="${escapeHtml(district.label)}">
            <path d="${escapeHtml(district.path)}"></path>
            <text x="${district.labelX}" y="${district.labelY - 14}">${escapeHtml(district.icon)}</text>
            <text x="${district.labelX}" y="${district.labelY + 18}">${escapeHtml(district.label)}</text>
          </g>
        `;
      }).join("")}
      <g class="map-marker" style="color:${zoneColors.red}" transform="translate(404 122)">
        <circle r="20" fill="none" stroke="currentColor" stroke-width="4"></circle><circle r="7" fill="currentColor"></circle>
      </g>
      <g class="map-marker" style="color:${zoneColors.green}" transform="translate(348 336)">
        <circle r="18" fill="none" stroke="currentColor" stroke-width="4"></circle><circle r="6" fill="currentColor"></circle>
      </g>
      <g class="map-marker" style="color:${zoneColors.pink}" transform="translate(500 382)">
        <circle r="20" fill="none" stroke="currentColor" stroke-width="4"></circle><circle r="7" fill="currentColor"></circle>
      </g>
    </svg>
  `;
  mount.querySelectorAll("[data-district-id]").forEach((zone) => {
    const select = () => updateSelection({ selectedDistrictId: zone.getAttribute("data-district-id") });
    zone.addEventListener("click", select);
    zone.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      select();
    });
  });

  if (legend) {
    legend.innerHTML = [
      ...getDistricts().map((district) => ({ label: district.label, color: zoneColors[district.color] })),
      { label: "Police Raid", color: zoneColors.red },
      { label: "Toxic Trap", color: zoneColors.green },
      { label: "Gang Control", color: zoneColors.pink }
    ].map((item) => `<span><i style="--legend-color:${item.color}"></i>${escapeHtml(item.label)}</span>`).join("");
  }
}

function renderServerDetails() {
  const mount = $("[data-server-details]");
  if (!mount) return;
  const server = getSelectedServer();
  const district = getSelectedDistrict();
  if (!server) {
    mount.innerHTML = `
      <h2>DETAILY SERVERU</h2>
      <p class="detail-description">Vyber server pro zobrazení detailů.</p>
      <button class="confirm-button" type="button" disabled>VYBRAT SERVER A DISTRICT</button>
      <p class="cta-hint">Vyber server a startovní district.</p>
    `;
    return;
  }

  const playersRatio = Math.max(0, Math.min(100, (server.players / server.maxPlayers) * 100));
  mount.innerHTML = `
    <div class="detail-head">
      <div><h2>DETAILY SERVERU</h2><strong>${escapeHtml(server.name)}</strong></div>
      ${server.badge ? `<span class="badge">${escapeHtml(server.badge)}</span>` : ""}
    </div>
    <div class="detail-grid">
      <span>REGION <strong>${escapeHtml(server.region)}</strong></span>
      <span>REŽIM <strong>${escapeHtml(server.mode)}</strong></span>
      <span>HRÁČŮ ONLINE <strong>${server.players} / ${server.maxPlayers}</strong></span>
      <span>STATUS <strong>${escapeHtml(server.status)}</strong></span>
      <span>HEAT LEVEL <strong>${server.heat} %</strong></span>
      <span>START / LIVE <strong>${escapeHtml(server.liveInfo)}</strong></span>
    </div>
    <div>
      <div class="detail-meter-label"><span>HEAT</span><strong>${server.heat}%</strong></div>
      <div class="meter heat-meter"><i style="width:${server.heat}%"></i></div>
    </div>
    <div>
      <div class="detail-meter-label"><span>CAPACITY</span><strong>${Math.round(playersRatio)}%</strong></div>
      <div class="meter"><i style="width:${playersRatio}%"></i></div>
    </div>
    <p class="detail-description">${escapeHtml(server.description)}</p>
    <p class="district-description">${district
      ? `Startovní district: ${escapeHtml(district.name)} — ${escapeHtml(district.description)}`
      : "Startovní district: Nevybrán."}</p>
    <button class="confirm-button" type="button" ${canConfirmSelection() ? "" : "disabled"} data-confirm-selection>
      VYBRAT SERVER A DISTRICT
    </button>
    <p class="cta-hint">${canConfirmSelection() ? "Po výběru již nelze district změnit." : "Vyber server a startovní district."}</p>
  `;
  mount.querySelector("[data-confirm-selection]")?.addEventListener("click", confirmSelection);
}

function updateSelection(partialState) {
  const nextMode = partialState.mode || selectionState.mode;
  selectionState.mode = nextMode;
  if ("selectedServerId" in partialState) {
    selectionState.selectedServerId = partialState.selectedServerId;
  }
  if ("selectedDistrictId" in partialState) {
    selectionState.selectedDistrictId = partialState.selectedDistrictId;
  }

  const selectedServer = getSelectedServer();
  if (selectedServer && selectedServer.mode !== selectionState.mode) {
    selectionState.selectedServerId = null;
  }

  renderPlayerSummary();
  renderModeTabs();
  renderServerList();
  renderDistrictMap();
  renderServerDetails();
}

function canConfirmSelection() {
  const server = getSelectedServer();
  return Boolean(server && getSelectedDistrict() && !server.full && !server.locked);
}

function confirmSelection() {
  if (!canConfirmSelection()) {
    if (!selectionState.selectedDistrictId) {
      showToast("VYBER STARTOVNÍ DISTRICT.", "warning");
    }
    return;
  }

  const finalSelection = {
    playerId: getPlayer().id,
    mode: selectionState.mode,
    serverId: selectionState.selectedServerId,
    districtId: selectionState.selectedDistrictId,
    createdAt: new Date().toISOString()
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(finalSelection));
  } catch (error) {
    console.warn("Server selection could not be saved.", error);
    showToast("Výběr se nepodařilo uložit lokálně, pokračuji v mock režimu.", "warning");
  }
  fakeConnect(finalSelection);
}

function fakeConnect(finalSelection) {
  const overlay = $("[data-connect-overlay]");
  const kicker = $("[data-connect-kicker]");
  const message = $("[data-connect-message]");
  if (overlay) overlay.hidden = false;
  if (kicker) kicker.textContent = "CONNECTING";
  if (message) message.textContent = "PŘIPOJOVÁNÍ K SERVERU…";

  window.setTimeout(() => {
    if (kicker) kicker.textContent = "ACCESS GRANTED";
    if (message) message.textContent = "SERVER ACCESS POVOLEN";
    showToast("ACCESS GRANTED", "success");
  }, 800);

  window.setTimeout(() => {
    console.log("Redirect to game.html", finalSelection);
    if (ENABLE_FAKE_REDIRECT) {
      window.location.href = "game.html";
    }
  }, 1500);
}

function showToast(message, type = "info") {
  const stack = $("[data-toast-stack]");
  if (!stack) return;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  stack.append(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

document.addEventListener("DOMContentLoaded", () => {
  selectionState.mode = mockPlayer.selectedMode || "WAR";
  const firstAvailable = getVisibleServers().find((server) => !server.full && !server.locked);
  selectionState.selectedServerId = mockPlayer.selectedServerId || firstAvailable?.id || null;
  selectionState.selectedDistrictId = mockPlayer.selectedDistrictId;
  bindNavigation();
  renderApp();
});
