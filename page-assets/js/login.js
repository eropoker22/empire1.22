import {
  DEFAULT_PUBLIC_SERVER_MODE,
  getRegistrationDraft,
  saveLoginStep
} from "./app/auth-flow.js";
import { isExplicitLocalDemoEnabled } from "./app/local-demo-gate.js";
import { STORAGE_KEYS } from "./config.js";
import { LOGIN_ACTIVE_EVENTS } from "./data/events.js";

const GUEST_USERNAME_KEY = STORAGE_KEYS.guestUsername;
const GUEST_GANG_KEY = STORAGE_KEYS.guestGangName;
const TOKEN_STORAGE_KEY = STORAGE_KEYS.token;
const STRUCTURE_STORAGE_KEY = STORAGE_KEYS.structure;
const ACTIVE_AUTH_MODE_KEY = STORAGE_KEYS.activeAuthMode;
const ACTIVE_GUEST_MODE_KEY = STORAGE_KEYS.activeGuestMode;
const LOBBY_ENTRY_HREF = "./lobby.html";
const LOGIN_REQUIRED_MESSAGE = "Vyplň přístupové údaje.";
const RESET_UNAVAILABLE_MESSAGE = "Reset terminál zatím není aktivní.";
const ACTIVE_EVENTS_REFRESH_MS = 35000;

const LOGIN_LEADERBOARD_PLAYERS = Object.freeze([
  {
    id: "kr-vlado",
    name: "KrVlado",
    subtitle: "Black Harbor",
    server: "WAR-01",
    rank: 1,
    score: 14820,
    districts: 18,
    influence: 1320,
    wanted: 420,
    cleanMoney: 245000,
    dirtyMoney: 388000,
    status: "Drží tlak na Downtown a sbírá respekt rychleji než zbytek lobby."
  },
  {
    id: "neon-boss",
    name: "NeonBoss",
    subtitle: "Chrome Royals",
    server: "WAR-01",
    rank: 2,
    score: 13640,
    districts: 16,
    influence: 990,
    wanted: 970,
    cleanMoney: 122000,
    dirtyMoney: 410000,
    status: "Točí čistý cash ve velkém a drží tempo i pod vysokým Heat tlakem."
  },
  {
    id: "street-wolf",
    name: "StreetWolf",
    subtitle: "Wolf District",
    server: "WAR-01",
    rank: 3,
    score: 12975,
    districts: 20,
    influence: 1190,
    wanted: 540,
    cleanMoney: 192000,
    dirtyMoney: 225000,
    status: "Agresivní postup a tlak na hranice z něj dělají nejhlasitější jméno sezony."
  },
  {
    id: "toxic-king",
    name: "ToxicKing",
    subtitle: "Toxic Crown",
    server: "FREE-01",
    rank: 4,
    score: 11730,
    districts: 12,
    influence: 1040,
    wanted: 72,
    cleanMoney: 420000,
    dirtyMoney: 102000,
    status: "Rozšiřuje se rychle, bere volné distrikty a zbytečně neztrácí tahy."
  },
  {
    id: "ghost-dealer",
    name: "GhostDealer",
    subtitle: "Ghost Exchange",
    server: "WAR-01",
    rank: 5,
    score: 10420,
    districts: 8,
    influence: 590,
    wanted: 260,
    cleanMoney: 82000,
    dirtyMoney: 116000,
    status: "Na black marketu vydělává bez hluku a posouvá se vzhůru přes ekonomiku."
  },
  {
    id: "iron-mike",
    name: "IronMike",
    subtitle: "Iron Chapel",
    server: "FREE-01",
    rank: 6,
    score: 9980,
    districts: 10,
    influence: 760,
    wanted: 880,
    cleanMoney: 72000,
    dirtyMoney: 232000,
    status: "Bere sousední území potichu a nechává za sebou minimum stop."
  },
  {
    id: "cyber-saint",
    name: "CyberSaint",
    subtitle: "Saint Protocol",
    server: "FREE-02",
    rank: 7,
    score: 9260,
    districts: 12,
    influence: 1250,
    wanted: 205,
    cleanMoney: 175000,
    dirtyMoney: 98000,
    status: "Hraje na hraně Heat limitu a pořád drží stabilní růst bez kolapsu."
  },
  {
    id: "black-mamba",
    name: "BlackMamba",
    subtitle: "Mamba Circle",
    server: "FREE-01",
    rank: 8,
    score: 8940,
    districts: 11,
    influence: 910,
    wanted: 310,
    cleanMoney: 154000,
    dirtyMoney: 187000,
    status: "Vyhledává slabé distrikty a trestá každou díru v obraně."
  },
  {
    id: "vulture-x",
    name: "VultureX",
    subtitle: "Vanta Vultures",
    server: "FREE-01",
    rank: 9,
    score: 8510,
    districts: 6,
    influence: 1130,
    wanted: 130,
    cleanMoney: 205000,
    dirtyMoney: 77000,
    status: "Leze žebříčkem ve Free modu čistě přes tempo, scouting a přesné načasování."
  },
  {
    id: "district-zero",
    name: "DistrictZero",
    subtitle: "Zero Block",
    server: "FREE-02",
    rank: 10,
    score: 8120,
    districts: 7,
    influence: 705,
    wanted: 455,
    cleanMoney: 94000,
    dirtyMoney: 149000,
    status: "Veterán z WAR lobby, který body tahá hlavně z disciplíny a obranné hry."
  },
  {
    id: "cash-reaper",
    name: "CashReaper",
    subtitle: "Cash Syndics",
    server: "FREE-02",
    rank: 11,
    score: 7880,
    districts: 9,
    influence: 520,
    wanted: 240,
    cleanMoney: 68000,
    dirtyMoney: 174000,
    status: "Noční raidy mu vydělávají body i zdroje, aniž by přepálil celé kolo."
  },
  {
    id: "zero-shade",
    name: "ZeroShade",
    subtitle: "Shade Wire",
    server: "FREE-02",
    rank: 12,
    score: 7540,
    districts: 12,
    influence: 1250,
    wanted: 205,
    cleanMoney: 175000,
    dirtyMoney: 98000,
    status: "Rád hraje přes informace a rušení, takže protivníci často reagují pozdě."
  },
  {
    id: "switch-runner",
    name: "SwitchRunner",
    subtitle: "Rail Switch",
    server: "FREE-03",
    rank: 13,
    score: 7210,
    districts: 4,
    influence: 610,
    wanted: 88,
    cleanMoney: 262000,
    dirtyMoney: 54000,
    status: "Body tahá přes rail line loot a chytré rotace mezi slabšími bloky."
  },
  {
    id: "silent-ace",
    name: "SilentAce",
    subtitle: "Ace Division",
    server: "FREE-01",
    rank: 14,
    score: 6980,
    districts: 7,
    influence: 690,
    wanted: 58,
    cleanMoney: 336000,
    dirtyMoney: 92000,
    status: "Tlačí bez hluku, nedává protivníkům čitelný pattern a sbírá stabilní rating."
  },
  {
    id: "black-lotus",
    name: "BlackLotus",
    subtitle: "Lotus Noir",
    server: "WAR-01",
    rank: 15,
    score: 6720,
    districts: 12,
    influence: 1040,
    wanted: 72,
    cleanMoney: 420000,
    dirtyMoney: 102000,
    status: "Když trefí slabý vault, umí během pár tahů otočit celé pořadí."
  },
  {
    id: "iron-saint",
    name: "IronSaint",
    subtitle: "Iron Saints",
    server: "WAR-01",
    rank: 16,
    score: 6390,
    districts: 20,
    influence: 1190,
    wanted: 540,
    cleanMoney: 192000,
    dirtyMoney: 225000,
    status: "Drží linii pod tlakem a ztrácí minimum districtů i v dlouhých výměnách."
  },
  {
    id: "neon-reaper",
    name: "NeonReaper",
    subtitle: "Afterglow Crew",
    server: "WAR-02",
    rank: 17,
    score: 6040,
    districts: 10,
    influence: 760,
    wanted: 880,
    cleanMoney: 72000,
    dirtyMoney: 232000,
    status: "Dohrává rozjeté konflikty a bere body tam, kde už ostatní krvácí."
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

const state = {
  activeMode: DEFAULT_PUBLIC_SERVER_MODE,
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

const initializeLoginPage = () => {
  const registration = getRegistrationDraft();
  state.activeMode = resolveInitialMode(registration);

  hydrateInputs(registration);
  bindModeCards();
  bindTerminalTabs();
  bindForms();
  bindGuest();
  bindPasswordToggle();
  bindSoundToggle();
  bindForgotPassword();
  bindLoginAboutModal();
  bindLoginInfoModals();
  bindLoginLeaderboard();
  startServerStatusCycle();
  startLoginActiveEventsCycle();
  updateModeCards();
  updateTerminalTab();
};

const resolveInitialMode = (registration) => {
  const params = new URLSearchParams(window.location.search);
  const requestedMode = normalizeMode(params.get("mode"));
  return requestedMode || normalizeMode(registration?.serverMode) || DEFAULT_PUBLIC_SERVER_MODE;
};

const normalizeMode = (mode) => {
  const normalized = String(mode || "").trim().toLowerCase();
  return normalized === "free" || normalized === "war" ? normalized : "";
};

const getModeServersUrl = (mode) => `${LOBBY_ENTRY_HREF}?mode=${normalizeMode(mode) || DEFAULT_PUBLIC_SERVER_MODE}`;
const sanitizeGuestValue = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

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

function bindModeCards() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = normalizeMode(button.dataset.mode);
      if (!mode || mode === state.activeMode) {
        return;
      }

      state.activeMode = mode;
      window.localStorage.setItem(ACTIVE_AUTH_MODE_KEY, state.activeMode);
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
      showError(LOGIN_REQUIRED_MESSAGE);
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
      showError(LOGIN_REQUIRED_MESSAGE);
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

  if (isExplicitLocalDemoEnabled()) {
    guestUsernameInput.value ||= "DemoBoss";
    guestGangInput.value ||= "Neon Demo Crew";
    button.textContent = "VSTOUPIT DO DEMO";
  }

  const continueAsGuest = () => {
    const username = sanitizeGuestValue(guestUsernameInput.value, 24);
    const gangName = sanitizeGuestValue(guestGangInput.value, 32);

    if (!username || !gangName) {
      showError(LOGIN_REQUIRED_MESSAGE);
      return;
    }

    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STRUCTURE_STORAGE_KEY);
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
    showError(RESET_UNAVAILABLE_MESSAGE);
  });
}

function bindLoginAboutModal() {
  const openButton = document.querySelector("[data-login-about-open]");
  const overlay = document.querySelector("[data-login-about-overlay]");
  const dialog = overlay?.querySelector(".login-about-dialog");
  if (!(openButton instanceof HTMLButtonElement) || !(overlay instanceof HTMLElement)) {
    return;
  }

  const openAbout = () => {
    overlay.hidden = false;
    if (dialog instanceof HTMLElement) {
      dialog.focus();
    }
  };
  const closeAbout = () => {
    overlay.hidden = true;
    openButton.focus();
  };

  openButton.addEventListener("click", openAbout);
  document.querySelectorAll("[data-login-about-close]").forEach((element) => {
    element.addEventListener("click", closeAbout);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) {
      closeAbout();
    }
  });
}

function bindLoginInfoModals() {
  document.querySelectorAll("[data-login-info-open]").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const modalId = String(button.getAttribute("data-login-info-open") || "");
    const overlay = document.querySelector(`[data-login-info-overlay="${modalId}"]`);
    const dialog = overlay?.querySelector(".login-about-dialog");
    if (!(overlay instanceof HTMLElement)) {
      return;
    }

    const openModal = () => {
      overlay.hidden = false;
      if (dialog instanceof HTMLElement) {
        dialog.focus();
      }
    };
    const closeModal = () => {
      overlay.hidden = true;
      button.focus();
    };

    button.addEventListener("click", openModal);
    overlay.querySelectorAll("[data-login-info-close]").forEach((element) => {
      element.addEventListener("click", closeModal);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) {
        closeModal();
      }
    });
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
    submitButton.textContent = "VSTUP POVOLEN";
  }, 520);

  window.setTimeout(() => {
    showAccessOverlay();
    saveLoginStep({
      identity,
      isGuest,
      gangName,
      mode: state.activeMode
    });
    window.localStorage.setItem(isGuest ? ACTIVE_GUEST_MODE_KEY : ACTIVE_AUTH_MODE_KEY, state.activeMode);
    console.info("redirect to lobby.html");
  }, 1050);

  window.setTimeout(() => {
    window.location.href = getModeServersUrl(state.activeMode);
  }, 1700);
}

function showAccessOverlay() {
  const overlay = document.querySelector("[data-access-overlay]");
  if (overlay instanceof HTMLElement) {
    overlay.dataset.mode = state.activeMode === "war" ? "war" : "free";
    overlay.hidden = false;
  }
}

function showError(message) {
  const error = document.getElementById("auth-error");
  if (!error) {
    return;
  }

  error.textContent = message;
  error.dataset.state = "error";
  error.classList.remove("hidden");
}

function hideError() {
  const error = document.getElementById("auth-error");
  if (!error) {
    return;
  }

  error.textContent = "";
  delete error.dataset.state;
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
    meta.textContent = `${player.subtitle} · ${player.server}`;
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
  const stateLabels = Array.from(document.querySelectorAll("[data-server-status-state]"));
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
      stateLabels.forEach((stateLabel) => typeServerStatusText(stateLabel, status.status, 46));
      typeServerStatusText(players, status.players, 34);
      typeServerStatusText(heat, `${status.heat} %`, 58);
      typeServerStatusText(heatCircleValue, `${status.heat}%`, 40);
      typeServerStatusText(districts, `${status.districtsControlled} / ${districtsMax}`, 38);
      typeServerStatusText(districtsCount, `${status.districtsControlled}`, 34);
      return;
    }

    setServerStatusText(server, status.server);
    stateLabels.forEach((stateLabel) => setServerStatusText(stateLabel, status.status));
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeLoginPage, { once: true });
} else {
  initializeLoginPage();
}
