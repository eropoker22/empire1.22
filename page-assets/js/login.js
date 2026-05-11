import {
  getRegistrationDraft,
  saveLoginStep
} from "./app/auth-flow.js";

const GUEST_USERNAME_KEY = "empire_guest_username";
const GUEST_GANG_KEY = "empire_gang_name";
const LOBBY_ENTRY_HREF = "./lobby.html";
const ACCESS_DENIED_MESSAGE = "ACCESS DENIED — IDENTITA NENALEZENA";
const ACTIVE_EVENTS_REFRESH_MS = 35000;

const LOGIN_LEADERBOARD_PLAYERS = Object.freeze([
  {
    id: "night-vultures",
    name: "Night Vultures",
    gangName: "Downtown cartel",
    faction: "Mafia",
    alliance: "Black Sun Pact",
    server: "WAR-01",
    rank: 1,
    score: 14820,
    districts: 18,
    influence: 1320,
    wanted: 420,
    cleanMoney: 245000,
    dirtyMoney: 388000,
    status: "Kontrolují Downtown a drží největší vliv v městském jádru."
  },
  {
    id: "blood-kings",
    name: "Blood Kings",
    gangName: "Harbor runners",
    faction: "Kartel",
    alliance: "Iron Parish",
    server: "WAR-01",
    rank: 2,
    score: 13640,
    districts: 16,
    influence: 990,
    wanted: 970,
    cleanMoney: 122000,
    dirtyMoney: 410000,
    status: "Public Enemy kandidát. Policie je sleduje po sérii krvavých přepadů."
  },
  {
    id: "iron-syndicate",
    name: "Iron Syndicate",
    gangName: "Industrial bloc",
    faction: "Soukromá armáda",
    alliance: "Iron Parish",
    server: "WAR-01",
    rank: 3,
    score: 12975,
    districts: 20,
    influence: 1190,
    wanted: 540,
    cleanMoney: 192000,
    dirtyMoney: 225000,
    status: "Těžká obrana, hodně districtů a stabilní průmyslový cashflow."
  },
  {
    id: "purple-cobras",
    name: "Purple Cobras",
    gangName: "Market pressure",
    faction: "Korporace",
    alliance: "Velvet Accord",
    server: "FREE-01",
    rank: 4,
    score: 11730,
    districts: 12,
    influence: 1040,
    wanted: 72,
    cleanMoney: 420000,
    dirtyMoney: 102000,
    status: "Tichý boss. Nebezpečný, protože nepřitahuje pozornost."
  },
  {
    id: "ghost-crew",
    name: "Ghost Crew",
    gangName: "Silent expansion",
    faction: "Tajná organizace",
    alliance: "Black Sun Pact",
    server: "WAR-01",
    rank: 5,
    score: 10420,
    districts: 8,
    influence: 590,
    wanted: 260,
    cleanMoney: 82000,
    dirtyMoney: 116000,
    status: "Rostou potichu. K TOP 3 jim chybí hlavně další distrikty."
  },
  {
    id: "neon-saints",
    name: "Neon Saints",
    gangName: "Free mode surge",
    faction: "Motogang",
    alliance: "Chrome Choir",
    server: "FREE-01",
    rank: 6,
    score: 9980,
    districts: 10,
    influence: 760,
    wanted: 880,
    cleanMoney: 72000,
    dirtyMoney: 232000,
    status: "Agresivní hráči. Nečekej klid, když se objeví vedle tvého districtu."
  },
  {
    id: "black-circuit",
    name: "Black Circuit",
    gangName: "Tech core control",
    faction: "Hackeři",
    alliance: "Chrome Choir",
    server: "FREE-02",
    rank: 7,
    score: 9260,
    districts: 12,
    influence: 1250,
    wanted: 205,
    cleanMoney: 175000,
    dirtyMoney: 98000,
    status: "Silný vliv přes tech trh. Útočí méně, ale přesně."
  },
  {
    id: "chrome-wolf",
    name: "Chrome Wolf",
    gangName: "Neon block scout",
    faction: "Hackeři",
    alliance: "Chrome Choir",
    server: "FREE-01",
    rank: 8,
    score: 8940,
    districts: 11,
    influence: 910,
    wanted: 310,
    cleanMoney: 154000,
    dirtyMoney: 187000,
    status: "Drží síť průzkumníků a prodává informace dřív, než začne přestřelka."
  },
  {
    id: "velvet-snake",
    name: "Velvet Snake",
    gangName: "Silent broker",
    faction: "Tajná organizace",
    alliance: "Velvet Accord",
    server: "FREE-01",
    rank: 9,
    score: 8510,
    districts: 6,
    influence: 1130,
    wanted: 130,
    cleanMoney: 205000,
    dirtyMoney: 77000,
    status: "Kupuje loajalitu potichu. Nízký wanted z něj dělá nebezpečný stín."
  },
  {
    id: "rust-bishop",
    name: "Rust Bishop",
    gangName: "Rusted parish",
    faction: "Kult",
    alliance: "Iron Parish",
    server: "FREE-02",
    rank: 10,
    score: 8120,
    districts: 7,
    influence: 705,
    wanted: 455,
    cleanMoney: 94000,
    dirtyMoney: 149000,
    status: "Drží staré bloky přes strach a rituální loajalitu."
  },
  {
    id: "district-rat",
    name: "District Rat",
    gangName: "Sewer kings",
    faction: "Kult",
    alliance: "Ghost Market",
    server: "FREE-02",
    rank: 11,
    score: 7880,
    districts: 9,
    influence: 520,
    wanted: 240,
    cleanMoney: 68000,
    dirtyMoney: 174000,
    status: "Není nápadný, ale jeho tunely propojují víc districtů, než policie tuší."
  },
  {
    id: "zero-prophet",
    name: "Zero Prophet",
    gangName: "Afterglow circuit",
    faction: "Hackeři",
    alliance: "Chrome Choir",
    server: "FREE-02",
    rank: 12,
    score: 7540,
    districts: 12,
    influence: 1250,
    wanted: 205,
    cleanMoney: 175000,
    dirtyMoney: 98000,
    status: "Silný vliv přes datové úniky. Když promluví, trh se pohne."
  },
  {
    id: "switch-runner",
    name: "Switch Runner",
    gangName: "Rail yard deals",
    faction: "Korporace",
    alliance: "Ghost Market",
    server: "FREE-03",
    rank: 13,
    score: 7210,
    districts: 4,
    influence: 610,
    wanted: 88,
    cleanMoney: 262000,
    dirtyMoney: 54000,
    status: "Slabší na mapě, silný v cashflow. Nikdy nevíš, komu právě prodal cestu ven."
  },
  {
    id: "ghost-dealer",
    name: "Ghost Dealer",
    gangName: "Quiet market",
    faction: "Kartel",
    alliance: "Ghost Market",
    server: "FREE-01",
    rank: 14,
    score: 6980,
    districts: 7,
    influence: 690,
    wanted: 58,
    cleanMoney: 336000,
    dirtyMoney: 92000,
    status: "Tichý boss. Vydělává bez sirén a bez zbytečných stop."
  },
  {
    id: "black-lotus",
    name: "Black Lotus",
    gangName: "Clean money front",
    faction: "Korporace",
    alliance: "Velvet Accord",
    server: "WAR-01",
    rank: 15,
    score: 6720,
    districts: 12,
    influence: 1040,
    wanted: 72,
    cleanMoney: 420000,
    dirtyMoney: 102000,
    status: "Legalizuje špinavé proudy tak čistě, že policie vidí jen účtenky."
  },
  {
    id: "iron-saint",
    name: "Iron Saint",
    gangName: "Private army",
    faction: "Soukromá armáda",
    alliance: "Iron Parish",
    server: "WAR-01",
    rank: 16,
    score: 6390,
    districts: 20,
    influence: 1190,
    wanted: 540,
    cleanMoney: 192000,
    dirtyMoney: 225000,
    status: "Těžká obrana a tvrdá disciplína. Útok na něj stojí víc, než vypadá."
  },
  {
    id: "neon-butcher",
    name: "Neon Butcher",
    gangName: "Red alley raids",
    faction: "Motogang",
    alliance: "Chrome Choir",
    server: "WAR-02",
    rank: 17,
    score: 6040,
    districts: 10,
    influence: 760,
    wanted: 880,
    cleanMoney: 72000,
    dirtyMoney: 232000,
    status: "Agresivní hráč. Nečekej klid, když se jeho jméno objeví ve feedu."
  }
]);

const SERVER_STATUS_STATES = Object.freeze([
  {
    server: "FREE-01",
    status: "ONLINE",
    players: "17/20 hráčů",
    heat: 78,
    districtsControlled: 124,
    districtsMax: 161
  },
  {
    server: "WAR-01",
    status: "RAID ALERT",
    players: "20/20 hráčů",
    heat: 92,
    districtsControlled: 151,
    districtsMax: 161
  },
  {
    server: "FREE-02",
    status: "SYNCING",
    players: "14/20 hráčů",
    heat: 46,
    districtsControlled: 89,
    districtsMax: 161
  },
  {
    server: "WAR-02",
    status: "HOT ZONE",
    players: "19/20 hráčů",
    heat: 88,
    districtsControlled: 143,
    districtsMax: 161
  }
]);

const LOGIN_ACTIVE_EVENTS = Object.freeze([
  {
    title: "POLICE RAID",
    text: "Zásahová jednotka čistí Downtown a zavírá únikové trasy.",
    time: "08:42",
    symbol: "◇",
    tone: "raid"
  },
  {
    title: "TOXIC TRAP",
    text: "Park zóna hlásí kontaminované skrýše a vyšší odměny.",
    time: "09:16",
    symbol: "☠",
    tone: "toxic"
  },
  {
    title: "GANG WAR",
    text: "Night Vultures a Purple Cobras bojují o hranici trhu.",
    time: "10:03",
    symbol: "✣",
    tone: "war"
  },
  {
    title: "BLACK MARKET",
    text: "Překupníci otevřeli krátké okno pro levnější kontraband.",
    time: "10:41",
    symbol: "$",
    tone: "market"
  },
  {
    title: "DATA LEAK",
    text: "Hackeři pustili do ulic seznam slabých skladů.",
    time: "11:09",
    symbol: "⌁",
    tone: "hack"
  },
  {
    title: "ARMS DROP",
    text: "Na Industrial okraji přistála zásilka zbraní bez majitele.",
    time: "11:52",
    symbol: "▦",
    tone: "supply"
  },
  {
    title: "SAFEHOUSE BURN",
    text: "Hoří kryt v Residential bloku. Stopy mizí rychleji než svědci.",
    time: "12:18",
    symbol: "▲",
    tone: "alert"
  },
  {
    title: "BORDER CHECK",
    text: "Policie kontroluje přejezdy mezi Commercial a Harbor.",
    time: "12:44",
    symbol: "!",
    tone: "raid"
  },
  {
    title: "NIGHT RACE",
    text: "Motogang blokuje jižní tah a bere sázky na průjezd.",
    time: "13:21",
    symbol: "◆",
    tone: "race"
  },
  {
    title: "HARBOR LOCKDOWN",
    text: "Přístav zavírá sklady po sérii falešných manifestů.",
    time: "13:58",
    symbol: "▤",
    tone: "raid"
  },
  {
    title: "DISTRICT BLACKOUT",
    text: "Výpadek proudu skrývá pohyb gangů v severním sektoru.",
    time: "14:36",
    symbol: "▧",
    tone: "blackout"
  },
  {
    title: "SPY NETWORK",
    text: "Informační síť prodává čerstvé lokace slabých hráčů.",
    time: "15:05",
    symbol: "◎",
    tone: "intel"
  },
  {
    title: "BOUNTY SIGNAL",
    text: "Na tabuli přibyla odměna za hráče s vysokým heatem.",
    time: "15:47",
    symbol: "⊕",
    tone: "bounty"
  },
  {
    title: "MARKET CRASH",
    text: "Ceny surovin kolísají po výprodeji špinavých zásob.",
    time: "16:12",
    symbol: "↯",
    tone: "market"
  },
  {
    title: "CHEM CLOUD",
    text: "Toxický mrak se drží u staré fabriky a láká riskantní loot.",
    time: "16:53",
    symbol: "☣",
    tone: "toxic"
  },
  {
    title: "TURF CLAIM",
    text: "Chrome Choir vyvěsil barvy na hranici cizího districtu.",
    time: "17:24",
    symbol: "✦",
    tone: "war"
  },
  {
    title: "CONVOY MOVE",
    text: "Ozbrojený konvoj veze materiál přes Industrial ring.",
    time: "18:08",
    symbol: "▰",
    tone: "supply"
  },
  {
    title: "CLUB FRONT",
    text: "Noční klub pere hotovost a na chvíli zvedá vliv.",
    time: "18:39",
    symbol: "◈",
    tone: "social"
  },
  {
    title: "SERVER NOISE",
    text: "Městská síť šumí. Některé falešné stopy mohou být pravé.",
    time: "19:17",
    symbol: "⌬",
    tone: "hack"
  },
  {
    title: "RED NOTICE",
    text: "Hledaný boss byl zahlédnut u hranice Downtownu.",
    time: "20:02",
    symbol: "×",
    tone: "alert"
  }
]);

const state = {
  activeMode: "war",
  activeTab: "login",
  selectedLeaderboardPlayerId: null,
  leaderboardToastTimer: null,
  activeEventsIndex: 0,
  activeEventsTimer: null,
  activeEventsEffectTimer: null,
  isSubmitting: false,
  serverStatusTimer: null,
  serverStatusApplyTimer: null,
  serverStatusEffectTimer: null,
  serverStatusTypeTimers: [],
  serverStatusIndex: 0
};

document.addEventListener("DOMContentLoaded", () => {
  const registration = getRegistrationDraft();
  state.activeMode = resolveInitialMode(registration);

  hydrateInputs(registration);
  bindServerSelectButton();
  bindModeCards();
  bindTerminalTabs();
  bindForms();
  bindGuest();
  bindPasswordToggle();
  bindSoundToggle();
  bindForgotPassword();
  bindLoginLeaderboard();
  startServerStatusCycle();
  startLoginActiveEventsCycle();
  updateModeCards();
  updateTerminalTab();
});

const resolveInitialMode = (registration) => {
  const params = new URLSearchParams(window.location.search);
  const requestedMode = normalizeMode(params.get("mode"));
  const storedMode = normalizeMode(window.localStorage.getItem("empire:active_auth_mode"))
    || normalizeMode(window.localStorage.getItem("empire:active_guest_mode"));
  return requestedMode || normalizeMode(registration?.serverMode) || storedMode || "war";
};

const normalizeMode = (mode) => {
  const normalized = String(mode || "").trim().toLowerCase();
  return normalized === "free" || normalized === "war" ? normalized : "";
};

const getModeServersUrl = (mode) => `${LOBBY_ENTRY_HREF}?mode=${normalizeMode(mode) || "war"}`;
const sanitizeGuestValue = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

function bindServerSelectButton() {
  const button = document.querySelector("[data-open-server-select]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    const identity = resolveServerSelectIdentity();
    const gangName = resolveServerSelectGangName();
    saveLoginStep({
      identity,
      gangName,
      isGuest: true,
      mode: state.activeMode
    });
    window.localStorage.setItem("empire:active_guest_mode", state.activeMode);
    window.location.href = getModeServersUrl(state.activeMode);
  });
}

function hydrateInputs(registration) {
  setInputValue("login-username", registration?.isGuest ? "" : registration?.identity);
  setInputValue("register-username", registration?.isGuest ? "" : registration?.identity);
  setInputValue("register-gang", registration?.gangName || window.localStorage.getItem(GUEST_GANG_KEY));
  setInputValue("guest-username", window.localStorage.getItem(GUEST_USERNAME_KEY) || (registration?.isGuest ? registration.identity : ""));
  setInputValue("guest-gang", window.localStorage.getItem(GUEST_GANG_KEY) || registration?.gangName);
}

function setInputValue(id, value) {
  const input = document.getElementById(id);
  if (input instanceof HTMLInputElement && value) {
    input.value = String(value).trim();
  }
}

function getInputValue(id) {
  const input = document.getElementById(id);
  return String(input instanceof HTMLInputElement ? input.value : "").trim();
}

function resolveServerSelectIdentity() {
  return [
    getInputValue("login-username"),
    getInputValue("register-username"),
    getInputValue("guest-username"),
    String(getRegistrationDraft()?.identity || "").trim()
  ].find(Boolean) || "Host";
}

function resolveServerSelectGangName() {
  return [
    getInputValue("register-gang"),
    getInputValue("guest-gang"),
    String(getRegistrationDraft()?.gangName || "").trim()
  ].find(Boolean) || "";
}

function bindModeCards() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = normalizeMode(button.dataset.mode);
      if (!mode || mode === state.activeMode) {
        return;
      }

      state.activeMode = mode;
      window.localStorage.setItem("empire:active_auth_mode", state.activeMode);
      updateModeCards();
    });
  });
}

function updateModeCards() {
  document.body.classList.toggle("auth-body--free", state.activeMode === "free");
  document.body.classList.toggle("auth-body--war", state.activeMode === "war");

  document.querySelectorAll("[data-mode]").forEach((button) => {
    const isActive = normalizeMode(button.dataset.mode) === state.activeMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function bindTerminalTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tab === "register" ? "register" : "login");
    });
  });

  document.querySelectorAll("[data-tab-link]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = state.activeTab === "register" ? "login" : "register";
      setActiveTab(nextTab);
    });
  });
}

function setActiveTab(tab) {
  state.activeTab = tab === "register" ? "register" : "login";
  hideError();
  updateTerminalTab();
}

function updateTerminalTab() {
  const isRegister = state.activeTab === "register";
  document.getElementById("login-form")?.classList.toggle("hidden", isRegister);
  document.getElementById("register-form")?.classList.toggle("hidden", !isRegister);
  document.querySelector(".guest-access")?.classList.toggle("hidden", isRegister);

  document.querySelectorAll("[data-tab]").forEach((button) => {
    const isActive = button.dataset.tab === state.activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.querySelectorAll("[data-tab-link]").forEach((button) => {
    if (!(button instanceof HTMLElement)) {
      return;
    }

    button.textContent = state.activeTab === "register" ? "▣ PŘIHLÁSIT" : "▣ ZALOŽIT GANG";
    button.setAttribute("aria-label", state.activeTab === "register" ? "Přepnout zpět na přihlášení" : "Přepnout na vytvoření gangu");
  });
}

function bindForms() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = getInputValue("login-username");
    const password = getInputValue("login-password");

    if (!username || !password) {
      showError(ACCESS_DENIED_MESSAGE);
      return;
    }

    runAccessSequence({
      form: loginForm,
      identity: username,
      gangName: `${username} Crew`,
      isGuest: false
    });
  });

  registerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = getInputValue("register-username");
    const gangName = getInputValue("register-gang");
    const password = getInputValue("register-password");

    if (!username || !gangName || !password) {
      showError(ACCESS_DENIED_MESSAGE);
      return;
    }

    window.localStorage.setItem(GUEST_GANG_KEY, gangName);
    runAccessSequence({
      form: registerForm,
      identity: username,
      gangName,
      isGuest: false
    });
  });
}

function bindGuest() {
  const button = document.getElementById("guest-btn");
  const guestUsernameInput = document.getElementById("guest-username");
  const guestGangInput = document.getElementById("guest-gang");
  if (!button || !guestUsernameInput || !guestGangInput) {
    return;
  }

  const continueAsGuest = () => {
    const username = sanitizeGuestValue(guestUsernameInput.value, 24);
    const gangName = sanitizeGuestValue(guestGangInput.value, 32);

    if (!username || !gangName) {
      showError(ACCESS_DENIED_MESSAGE);
      return;
    }

    window.localStorage.removeItem("empire_token");
    window.localStorage.removeItem("empire_structure");
    window.localStorage.setItem(GUEST_USERNAME_KEY, username);
    window.localStorage.setItem(GUEST_GANG_KEY, gangName);
    runAccessSequence({
      button,
      identity: username,
      gangName,
      isGuest: true
    });
  };

  button.addEventListener("click", continueAsGuest);
  [guestUsernameInput, guestGangInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      continueAsGuest();
    });
  });
}

function bindPasswordToggle() {
  const toggle = document.querySelector("[data-password-toggle]");
  const input = document.getElementById("login-password");
  if (!(toggle instanceof HTMLButtonElement) || !(input instanceof HTMLInputElement)) {
    return;
  }

  toggle.addEventListener("click", () => {
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    toggle.textContent = reveal ? "◉" : "◎";
    toggle.setAttribute("aria-label", reveal ? "Skrýt heslo" : "Zobrazit heslo");
  });
}

function bindSoundToggle() {
  const button = document.querySelector("[data-sound-toggle]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    const muted = button.dataset.muted !== "true";
    button.dataset.muted = muted ? "true" : "false";
    button.textContent = muted ? "Zvuk off" : "Zvuk";
  });
}

function bindForgotPassword() {
  const button = document.querySelector("[data-forgot-password]");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    showError("POLICE WARNING — RESET TERMINÁL NENÍ V MOCKU AKTIVNÍ");
  });
}

function runAccessSequence({ form = null, button = null, identity, gangName, isGuest }) {
  if (state.isSubmitting) {
    return;
  }

  const submitButton = button || form?.querySelector("button[type='submit']");
  if (!(submitButton instanceof HTMLButtonElement)) {
    return;
  }

  state.isSubmitting = true;
  hideError();
  submitButton.disabled = true;
  submitButton.classList.add("is-loading");
  submitButton.textContent = "PŘIPOJOVÁNÍ…";

  window.setTimeout(() => {
    submitButton.textContent = "ACCESS GRANTED";
  }, 520);

  window.setTimeout(() => {
    showAccessOverlay();
    saveLoginStep({
      identity,
      isGuest,
      gangName,
      mode: state.activeMode
    });
    window.localStorage.setItem(isGuest ? "empire:active_guest_mode" : "empire:active_auth_mode", state.activeMode);
    console.info("redirect to game.html");
  }, 1050);

  window.setTimeout(() => {
    window.location.href = getModeServersUrl(state.activeMode);
  }, 1700);
}

function showAccessOverlay() {
  const overlay = document.querySelector("[data-access-overlay]");
  if (overlay instanceof HTMLElement) {
    overlay.hidden = false;
  }
}

function showError(message) {
  const error = document.getElementById("auth-error");
  if (!error) {
    return;
  }

  error.textContent = message;
  error.classList.remove("hidden");
}

function hideError() {
  const error = document.getElementById("auth-error");
  if (!error) {
    return;
  }

  error.textContent = "";
  error.classList.add("hidden");
}

function getLoginLeaderboardPlayer(playerId) {
  return LOGIN_LEADERBOARD_PLAYERS.find((player) => player.id === playerId) || LOGIN_LEADERBOARD_PLAYERS[0];
}

function formatLeaderboardNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("cs-CZ");
}

function createLeaderboardStat(label, value) {
  const stat = document.createElement("span");
  stat.className = "login-leaderboard-stat";
  stat.dataset.stat = label.toLowerCase().replace(/\s+/g, "-");

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.textContent = value;

  stat.append(labelElement, valueElement);
  return stat;
}

function syncLoginLeaderboardSelection(playerId) {
  document.querySelectorAll("[data-login-leaderboard-player]").forEach((item) => {
    const isSelected = item.getAttribute("data-login-leaderboard-player") === playerId;
    item.classList.toggle("is-selected", isSelected);
    item.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function openLoginLeaderboardDetail(playerId) {
  const player = getLoginLeaderboardPlayer(playerId);
  const overlay = document.querySelector("[data-login-leaderboard-overlay]");
  const dialog = overlay?.querySelector(".login-leaderboard-detail");
  const name = document.querySelector("[data-login-leaderboard-name]");
  const meta = document.querySelector("[data-login-leaderboard-meta]");
  const stats = document.querySelector("[data-login-leaderboard-stats]");
  const status = document.querySelector("[data-login-leaderboard-status]");
  const toast = document.querySelector("[data-login-leaderboard-toast]");

  if (!(overlay instanceof HTMLElement) || !(stats instanceof HTMLElement)) {
    return;
  }

  state.selectedLeaderboardPlayerId = player.id;
  syncLoginLeaderboardSelection(player.id);

  if (name) {
    name.textContent = player.name;
  }
  if (meta) {
    meta.textContent = `${player.gangName} · ${player.faction}`;
  }
  if (status) {
    status.textContent = player.status;
  }
  if (toast instanceof HTMLElement) {
    toast.hidden = true;
  }

  stats.replaceChildren(
    createLeaderboardStat("Rank", `#${formatLeaderboardNumber(player.rank)}`),
    createLeaderboardStat("Empire Score", formatLeaderboardNumber(player.score)),
    createLeaderboardStat("Distrikty", formatLeaderboardNumber(player.districts))
  );

  overlay.hidden = false;
  if (dialog instanceof HTMLElement) {
    dialog.focus();
  }
}

function closeLoginLeaderboardDetail() {
  const overlay = document.querySelector("[data-login-leaderboard-overlay]");
  if (overlay instanceof HTMLElement) {
    overlay.hidden = true;
  }
}

function showLoginLeaderboardMockToast() {
  const toast = document.querySelector("[data-login-leaderboard-toast]");
  if (!(toast instanceof HTMLElement)) {
    return;
  }

  window.clearTimeout(state.leaderboardToastTimer);
  toast.textContent = "Funkce bude napojena později.";
  toast.hidden = false;
  state.leaderboardToastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2200);
}

function bindLoginLeaderboard() {
  document.querySelectorAll("[data-login-leaderboard-player]").forEach((item) => {
    item.addEventListener("click", () => {
      openLoginLeaderboardDetail(item.getAttribute("data-login-leaderboard-player"));
    });
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      openLoginLeaderboardDetail(item.getAttribute("data-login-leaderboard-player"));
    });
  });

  document.querySelectorAll("[data-login-leaderboard-close]").forEach((element) => {
    element.addEventListener("click", closeLoginLeaderboardDetail);
  });

  document.querySelectorAll("[data-login-leaderboard-mock-action]").forEach((button) => {
    button.addEventListener("click", showLoginLeaderboardMockToast);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLoginLeaderboardDetail();
    }
  });
}

function getVisibleLoginActiveEvents() {
  return Array.from({ length: 3 }, (_, index) => {
    const eventIndex = (state.activeEventsIndex + index) % LOGIN_ACTIVE_EVENTS.length;
    return LOGIN_ACTIVE_EVENTS[eventIndex];
  });
}

function createLoginActiveEventCard(eventData, index) {
  const card = document.createElement("article");
  card.className = "event-card";
  card.dataset.tone = eventData.tone;
  card.style.setProperty("--event-delay", `${index * 85}ms`);

  const symbol = document.createElement("span");
  symbol.className = "event-symbol";
  symbol.textContent = eventData.symbol;
  symbol.setAttribute("aria-hidden", "true");

  const body = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = eventData.title;
  const text = document.createElement("p");
  text.textContent = eventData.text;
  body.replaceChildren(title, text);

  const time = document.createElement("time");
  time.textContent = eventData.time;

  card.replaceChildren(symbol, body, time);
  return card;
}

function renderLoginActiveEvents(options = {}) {
  const panel = document.querySelector("[data-login-active-events]");
  const feed = document.querySelector("[data-login-active-events-feed]");
  const status = document.querySelector("[data-login-active-events-status]");
  if (!(panel instanceof HTMLElement) || !(feed instanceof HTMLElement)) {
    return;
  }

  const events = getVisibleLoginActiveEvents();
  if (status) {
    status.textContent = `LIVE ${String(events.length).padStart(2, "0")} / ${LOGIN_ACTIVE_EVENTS.length}`;
  }

  window.clearTimeout(state.activeEventsEffectTimer);
  panel.classList.toggle("is-switching", options.animate !== false);
  feed.replaceChildren(...events.map((eventData, index) => createLoginActiveEventCard(eventData, index)));

  state.activeEventsEffectTimer = window.setTimeout(() => {
    panel.classList.remove("is-switching");
  }, 720);
}

function startLoginActiveEventsCycle() {
  if (!document.querySelector("[data-login-active-events-feed]")) {
    return;
  }

  renderLoginActiveEvents({ animate: false });
  state.activeEventsTimer = window.setInterval(() => {
    state.activeEventsIndex = (state.activeEventsIndex + 3) % LOGIN_ACTIVE_EVENTS.length;
    renderLoginActiveEvents();
  }, ACTIVE_EVENTS_REFRESH_MS);
}

function clearServerStatusTyping() {
  state.serverStatusTypeTimers.forEach((timer) => window.clearTimeout(timer));
  state.serverStatusTypeTimers = [];
  document.querySelectorAll(".server-status .is-typing").forEach((element) => {
    element.classList.remove("is-typing");
  });
}

function setServerStatusText(element, text) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.classList.remove("is-typing");
}

function typeServerStatusText(element, text, delay = 42) {
  if (!element) {
    return;
  }

  const target = String(text);
  const chars = Array.from(target);
  element.textContent = "";
  element.classList.add("is-typing");

  if (chars.length === 0) {
    element.classList.remove("is-typing");
    return;
  }

  chars.forEach((_, index) => {
    const timer = window.setTimeout(() => {
      const prefix = chars.slice(0, index + 1).join("");
      const isDone = index === chars.length - 1;
      element.textContent = isDone ? target : prefix;

      if (isDone) {
        element.classList.remove("is-typing");
      }
    }, index * delay);

    state.serverStatusTypeTimers.push(timer);
  });
}

function renderServerStatus(status, options = {}) {
  const panel = document.querySelector(".server-status");
  const server = document.querySelector("[data-server-status-name]");
  const stateLabel = document.querySelector("[data-server-status-state]");
  const players = document.querySelector("[data-server-status-players]");
  const heat = document.querySelector("[data-server-status-heat]");
  const heatCircle = document.querySelector("[data-server-status-heat-circle]");
  const heatCircleValue = document.querySelector("[data-server-status-heat-circle-value]");
  const districts = document.querySelector("[data-server-status-districts]");
  const districtsCircle = document.querySelector("[data-server-status-districts-circle]");
  const districtsCount = document.querySelector("[data-server-status-districts-count]");

  if (!(panel instanceof HTMLElement)) {
    return;
  }

  const applyStatus = (typewrite = true) => {
    const districtsMax = Number.isFinite(status.districtsMax) ? status.districtsMax : 161;
    const districtsRatio = districtsMax > 0 ? Math.max(0, Math.min(100, (status.districtsControlled / districtsMax) * 100)) : 0;
    const serverMode = typeof status.server === "string" && status.server.startsWith("WAR") ? "war" : "free";

    panel.dataset.serverMode = serverMode;

    if (heatCircle instanceof HTMLElement) {
      heatCircle.style.setProperty("--value", `${status.heat}`);
    }
    if (districtsCircle instanceof HTMLElement) {
      districtsCircle.style.setProperty("--value", `${districtsRatio}`);
    }

    if (typewrite) {
      typeServerStatusText(server, status.server, 52);
      typeServerStatusText(stateLabel, status.status, 46);
      typeServerStatusText(players, status.players, 34);
      typeServerStatusText(heat, `${status.heat} %`, 58);
      typeServerStatusText(heatCircleValue, `${status.heat}%`, 40);
      typeServerStatusText(districts, `${status.districtsControlled} / ${districtsMax}`, 38);
      typeServerStatusText(districtsCount, `${status.districtsControlled}`, 34);
      return;
    }

    setServerStatusText(server, status.server);
    setServerStatusText(stateLabel, status.status);
    setServerStatusText(players, status.players);
    setServerStatusText(heat, `${status.heat} %`);
    setServerStatusText(heatCircleValue, `${status.heat}%`);
    setServerStatusText(districts, `${status.districtsControlled} / ${districtsMax}`);
    setServerStatusText(districtsCount, `${status.districtsControlled}`);
  };

  window.clearTimeout(state.serverStatusApplyTimer);
  window.clearTimeout(state.serverStatusEffectTimer);
  clearServerStatusTyping();

  if (options.animate === false) {
    applyStatus(false);
    return;
  }

  panel.classList.remove("is-updating");
  window.requestAnimationFrame(() => {
    panel.classList.add("is-updating");
    state.serverStatusApplyTimer = window.setTimeout(() => applyStatus(true), 520);
    state.serverStatusEffectTimer = window.setTimeout(() => {
      panel.classList.remove("is-updating");
    }, 1350);
  });
}

function startServerStatusCycle() {
  if (!document.querySelector(".server-status")) {
    return;
  }

  renderServerStatus(SERVER_STATUS_STATES[0], { animate: false });
  state.serverStatusIndex = 1;

  const nextStatus = () => {
    const status = SERVER_STATUS_STATES[state.serverStatusIndex % SERVER_STATUS_STATES.length];
    renderServerStatus(status);
    state.serverStatusIndex += 1;
  };

  state.serverStatusTimer = window.setInterval(nextStatus, 7200);
}
