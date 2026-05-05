import {
  getRegistrationDraft,
  saveLoginStep
} from "./app/auth-flow.js";

const GUEST_USERNAME_KEY = "empire_guest_username";
const GUEST_GANG_KEY = "empire_gang_name";
const LOBBY_ENTRY_HREF = "./lobby.html";
const ACCESS_DENIED_MESSAGE = "ACCESS DENIED — IDENTITA NENALEZENA";

const state = {
  activeMode: "war",
  activeTab: "login",
  isSubmitting: false,
  feedTimer: null
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
  startCityFeedPulse();
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
      setActiveTab(button.dataset.tabLink === "register" ? "register" : "login");
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

  document.querySelectorAll("[data-tab]").forEach((button) => {
    const isActive = button.dataset.tab === state.activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
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

function startCityFeedPulse() {
  const items = Array.from(document.querySelectorAll("[data-city-feed] .feed-item"));
  if (items.length === 0) {
    return;
  }

  const pulse = () => {
    items.forEach((item) => item.classList.remove("is-flashing"));
    const item = items[Math.floor(Math.random() * items.length)];
    item?.classList.add("is-flashing");
    window.setTimeout(() => item?.classList.remove("is-flashing"), 1250);
  };

  pulse();
  state.feedTimer = window.setInterval(pulse, 3600);
}
