import {
  getRegistrationDraft,
  saveLoginStep
} from "./app/auth-flow.js";

const GUEST_USERNAME_KEY = "empire_guest_username";
const GUEST_GANG_KEY = "empire_gang_name";
const LOBBY_ENTRY_HREF = "./lobby.html";

const state = {
  activeTab: "login",
  activeMode: "war",
  requestMobileLoginFit: null
};

document.addEventListener("DOMContentLoaded", () => {
  const registration = getRegistrationDraft();
  state.activeMode = resolveInitialMode(registration);

  hydrateInputs(registration);
  bindModeTabs();
  bindTabs();
  bindForms();
  bindGuest();
  bindAboutGameLink();
  initMobileLoginFit();
  updateModeTabs();
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

const hydrateInputs = (registration) => {
  setInputValue("login-username", registration?.isGuest ? "" : registration?.identity);
  setInputValue("login-password", registration?.isGuest ? "" : registration?.password);
  setInputValue("register-username", registration?.isGuest ? "" : registration?.identity);
  setInputValue("register-gang", registration?.gangName || window.localStorage.getItem(GUEST_GANG_KEY));
  setInputValue("guest-username", window.localStorage.getItem(GUEST_USERNAME_KEY) || (registration?.isGuest ? registration.identity : ""));
  setInputValue("guest-gang", window.localStorage.getItem(GUEST_GANG_KEY) || registration?.gangName);
};

const setInputValue = (id, value) => {
  const input = document.getElementById(id);
  if (input instanceof HTMLInputElement && value) {
    input.value = String(value).trim();
  }
};

const getModeServersUrl = (mode) => `${LOBBY_ENTRY_HREF}?mode=${normalizeMode(mode) || "war"}`;

const getAboutGameUrl = () => "./about-game.html";

function bindAboutGameLink() {
  const aboutLink = document.querySelector(".about-game-copy__link");
  if (!(aboutLink instanceof HTMLAnchorElement)) return;
  const targetUrl = getAboutGameUrl();
  aboutLink.setAttribute("href", targetUrl);
  aboutLink.setAttribute("target", "_blank");
  aboutLink.setAttribute("rel", "noopener noreferrer");
  aboutLink.addEventListener("click", (event) => {
    event.preventDefault();
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  });
}

function bindModeTabs() {
  const tabs = document.querySelectorAll(".auth-mode-tab");
  const aboutCopy = document.getElementById("about-game-copy");
  const authTabsDetached = document.querySelector(".auth-tabs--detached");

  tabs.forEach((button) => {
    button.addEventListener("click", () => {
      const mode = normalizeMode(button.dataset.mode);
      if (!mode) return;
      if (mode === state.activeMode) return;
      state.activeMode = mode;
      window.localStorage.setItem("empire:active_auth_mode", state.activeMode);
      aboutCopy?.classList.add("hidden");
      authTabsDetached?.classList.remove("hidden");
      document.body.classList.remove("about-view-active");
      updateModeTabs();
      state.requestMobileLoginFit?.();
    });
  });

  const aboutButton = document.getElementById("about-game-btn");
  aboutButton?.addEventListener("click", () => {
    if (!aboutCopy) return;
    const shouldShow = aboutCopy.classList.contains("hidden");
    aboutCopy.classList.toggle("hidden", !shouldShow);
    authTabsDetached?.classList.toggle("hidden", shouldShow);
    document.body.classList.toggle("about-view-active", shouldShow);
    state.requestMobileLoginFit?.();
  });
}

function updateModeTabs() {
  document.querySelectorAll(".auth-mode-tab").forEach((button) => {
    const mode = normalizeMode(button.dataset.mode);
    if (!mode) {
      button.classList.remove("is-active");
      button.removeAttribute("aria-selected");
      return;
    }
    const isActive = mode === state.activeMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      state.activeTab = tab === "register" ? "register" : "login";
      document.querySelectorAll(".tab-btn").forEach((tabButton) =>
        tabButton.classList.toggle("tab-btn--active", tabButton.dataset.tab === state.activeTab)
      );
      document.getElementById("login-form")?.classList.toggle("hidden", state.activeTab !== "login");
      document.getElementById("register-form")?.classList.toggle("hidden", state.activeTab !== "register");
      state.requestMobileLoginFit?.();
    });
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
      showError("Přihlášení se nezdařilo. Zkontroluj údaje.");
      return;
    }

    hideError();
    window.localStorage.removeItem(GUEST_USERNAME_KEY);
    saveLoginStep({
      identity: username,
      password,
      isGuest: false,
      gangName: `${username} Crew`,
      mode: state.activeMode
    });
    window.localStorage.setItem("empire:active_auth_mode", state.activeMode);
    window.location.href = getModeServersUrl(state.activeMode);
  });

  registerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = getInputValue("register-username");
    const gangName = getInputValue("register-gang");
    const password = getInputValue("register-password");

    if (!username || !gangName || !password) {
      showError("Registrace se nezdařila. Vyplň jméno, gang i heslo.");
      return;
    }

    hideError();
    window.localStorage.removeItem(GUEST_USERNAME_KEY);
    window.localStorage.setItem(GUEST_GANG_KEY, gangName);
    saveLoginStep({
      identity: username,
      password,
      isGuest: false,
      gangName,
      mode: state.activeMode
    });
    window.localStorage.setItem("empire:active_auth_mode", state.activeMode);
    window.location.href = getModeServersUrl(state.activeMode);
  });
}

function bindGuest() {
  const button = document.getElementById("guest-btn");
  const guestUsernameInput = document.getElementById("guest-username");
  const guestGangInput = document.getElementById("guest-gang");
  if (!button || !guestUsernameInput || !guestGangInput) return;

  const continueAsGuest = () => {
    const username = sanitizeGuestValue(guestUsernameInput.value, 24);
    const gangName = sanitizeGuestValue(guestGangInput.value, 32);

    if (!username || !gangName) {
      showError("Pro hosta vyplň nick i název gangu.");
      return;
    }

    hideError();
    window.localStorage.removeItem("empire_token");
    window.localStorage.removeItem("empire_structure");
    window.localStorage.setItem(GUEST_USERNAME_KEY, username);
    window.localStorage.setItem(GUEST_GANG_KEY, gangName);
    saveLoginStep({
      identity: username,
      password: "",
      isGuest: true,
      gangName,
      mode: state.activeMode
    });
    window.localStorage.setItem("empire:active_guest_mode", state.activeMode);
    window.location.href = getModeServersUrl(state.activeMode);
  };

  button.addEventListener("click", continueAsGuest);
  [guestUsernameInput, guestGangInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      continueAsGuest();
    });
  });
}

const getInputValue = (id) => {
  const input = document.getElementById(id);
  return String(input instanceof HTMLInputElement ? input.value : "").trim();
};

const sanitizeGuestValue = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

function showError(message) {
  const error = document.getElementById("auth-error");
  if (!error) return;
  error.textContent = message;
  error.classList.remove("hidden");
  state.requestMobileLoginFit?.();
}

function hideError() {
  const error = document.getElementById("auth-error");
  if (!error) return;
  error.textContent = "";
  error.classList.add("hidden");
  state.requestMobileLoginFit?.();
}

function initMobileLoginFit() {
  const body = document.body;
  const footer = document.querySelector(".auth-footer");
  const stack = document.querySelector(".auth-mobile-fit-stack");
  const media = window.matchMedia("(max-width: 900px)");
  if (!body || !footer || !stack) return;

  let frame = 0;
  const fitClasses = ["login-mobile-fit-compact", "login-mobile-fit-tight", "login-mobile-fit-ultra"];
  let keyboardEditingLock = false;

  const getOuterHeight = (element) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
    const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
    return rect.height + marginTop + marginBottom;
  };

  const measure = () => {
    frame = 0;
    if (keyboardEditingLock) return;
    fitClasses.forEach((className) => body.classList.remove(className));
    body.style.removeProperty("--login-mobile-fit-scale");
    if (!media.matches) return;

    const availableHeight = Math.max(
      0,
      Math.floor(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0)
    );
    if (!availableHeight) return;

    const fitsViewport = () => getOuterHeight(stack) <= availableHeight - 4;
    if (fitsViewport()) return;

    body.classList.add("login-mobile-fit-compact");
    if (fitsViewport()) return;

    body.classList.add("login-mobile-fit-tight");
    if (fitsViewport()) return;

    body.classList.add("login-mobile-fit-ultra");
    if (fitsViewport()) return;

    const totalHeight = getOuterHeight(stack);
    if (totalHeight > 0) {
      const scale = Math.max(0.72, Math.min(1, (availableHeight - 4) / totalHeight));
      body.style.setProperty("--login-mobile-fit-scale", scale.toFixed(4));
    }
  };

  const requestMeasure = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(measure);
  };

  state.requestMobileLoginFit = requestMeasure;

  const isEditableField = (element) =>
    element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || Boolean(element instanceof HTMLElement && element.isContentEditable);

  document.addEventListener("focusin", (event) => {
    if (!media.matches || !isEditableField(event.target)) return;
    keyboardEditingLock = true;
    body.classList.add("login-mobile-keyboard-lock");
  });

  document.addEventListener("focusout", () => {
    if (!media.matches) return;
    window.setTimeout(() => {
      const stillEditing = isEditableField(document.activeElement);
      keyboardEditingLock = stillEditing;
      body.classList.toggle("login-mobile-keyboard-lock", stillEditing);
      if (!stillEditing) {
        requestMeasure();
      }
    }, 40);
  });

  requestMeasure();
  window.addEventListener("resize", requestMeasure);
  window.addEventListener("orientationchange", requestMeasure);
  window.visualViewport?.addEventListener("resize", requestMeasure);
  window.visualViewport?.addEventListener("scroll", requestMeasure);
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", requestMeasure);
  } else if (typeof media.addListener === "function") {
    media.addListener(requestMeasure);
  }
}
