const API_BASE = "http://localhost:3000";
const GUEST_USERNAME_KEY = "empire_guest_username";
const GUEST_GANG_KEY = "empire_gang_name";

const state = {
  activeTab: "login",
  activeMode: window.Empire?.mode || "war"
};

function getModeServersUrl(mode) {
  const normalizedMode = window.Empire?.GameModes?.normalizeMode?.(mode) || "war";
  return `servers.html?mode=${normalizedMode}`;
}

document.addEventListener("DOMContentLoaded", () => {
  bindModeTabs();
  bindTabs();
  bindForms();
  bindGuest();
  bindAboutGameLink();
  initMobileLoginFit();

  if (localStorage.getItem("empire_token")) {
    window.location.href = window.Empire?.getGameModeUrl?.("faction", state.activeMode) || "/faction.html?mode=war";
    return;
  }
});

function getAboutGameUrl() {
  const path = String(window.location.pathname || "").toLowerCase();
  if (path.includes("/war/") || path.includes("/free/")) {
    return "../about-game.html";
  }
  return "about-game.html";
}

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
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const modeRaw = btn.dataset.mode;
      if (!modeRaw) return;
      const mode = String(modeRaw).toLowerCase();
      if (mode === state.activeMode) return;
      state.activeMode = mode;
      if (aboutCopy) {
        aboutCopy.classList.add("hidden");
      }
      if (authTabsDetached) {
        authTabsDetached.classList.remove("hidden");
      }
      document.body.classList.remove("about-view-active");
      updateModeTabs();
    });
  });

  const aboutButton = document.getElementById("about-game-btn");
  if (aboutButton) {
    aboutButton.addEventListener("click", () => {
      if (!aboutCopy) return;
      const shouldShow = aboutCopy.classList.contains("hidden");
      aboutCopy.classList.toggle("hidden", !shouldShow);
      if (authTabsDetached) {
        authTabsDetached.classList.toggle("hidden", shouldShow);
      }
      document.body.classList.toggle("about-view-active", shouldShow);
    });
  }

  updateModeTabs();
}

function updateModeTabs() {
  document.querySelectorAll(".auth-mode-tab").forEach((btn) => {
    const modeRaw = btn.dataset.mode;
    if (!modeRaw) {
      btn.classList.remove("is-active");
      btn.removeAttribute("aria-selected");
      return;
    }
    const isActive = String(modeRaw) === state.activeMode;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  const serversLink = document.getElementById("servers-link");
  if (serversLink) {
    serversLink.href = getModeServersUrl(state.activeMode);
  }
  try {
    window.Empire?.applyGameMode?.(state.activeMode);
  } catch (error) {
    console.error("Mode switch UI sync failed:", error);
  }
}

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      state.activeTab = tab;
      document.querySelectorAll(".tab-btn").forEach((b) =>
        b.classList.toggle("tab-btn--active", b.dataset.tab === tab)
      );
      document.getElementById("login-form").classList.toggle("hidden", tab !== "login");
      document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
      state.requestMobileLoginFit?.();
    });
  });
}

function bindForms() {
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    const result = await post(`${API_BASE}/auth/login`, { username, password, mode: state.activeMode });
    if (result?.token) {
      hideError();
      localStorage.removeItem(GUEST_USERNAME_KEY);
      localStorage.removeItem(GUEST_GANG_KEY);
      localStorage.setItem("empire_token", result.token);
      window.Empire?.__storagePatch?.setItem?.("empire:active_auth_mode", state.activeMode);
      window.location.href = window.Empire?.getGameModeUrl?.("faction", state.activeMode) || `/faction.html?mode=${state.activeMode}`;
    } else {
      showError("Přihlášení se nezdařilo. Zkontroluj údaje.");
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("register-username").value.trim();
    const gangName = document.getElementById("register-gang").value.trim();
    const password = document.getElementById("register-password").value.trim();

    const result = await post(`${API_BASE}/auth/register`, { username, gangName, password, mode: state.activeMode });
    if (result?.token) {
      hideError();
      localStorage.removeItem(GUEST_USERNAME_KEY);
      localStorage.setItem(GUEST_GANG_KEY, gangName);
      localStorage.setItem("empire_token", result.token);
      window.Empire?.__storagePatch?.setItem?.("empire:active_auth_mode", state.activeMode);
      window.location.href = window.Empire?.getGameModeUrl?.("faction", state.activeMode) || `/faction.html?mode=${state.activeMode}`;
    } else {
      showError("Registrace se nezdařila. Zkus jiné jméno.");
    }
  });
}

function bindGuest() {
  const btn = document.getElementById("guest-btn");
  const guestUsernameInput = document.getElementById("guest-username");
  const guestGangInput = document.getElementById("guest-gang");
  if (!btn || !guestUsernameInput || !guestGangInput) return;

  const continueAsGuest = () => {
    const username = sanitizeGuestValue(guestUsernameInput.value, 24);
    const gangName = sanitizeGuestValue(guestGangInput.value, 32);

    if (!username || !gangName) {
      showError("Pro hosta vyplň nick i název gangu.");
      return;
    }

    hideError();
    localStorage.removeItem("empire_token");
    localStorage.removeItem("empire_structure");
    localStorage.setItem(GUEST_USERNAME_KEY, username);
    localStorage.setItem(GUEST_GANG_KEY, gangName);
    window.Empire?.__storagePatch?.setItem?.("empire:active_guest_mode", state.activeMode);
    window.location.href = getModeServersUrl(state.activeMode);
  };

  btn.addEventListener("click", () => {
    continueAsGuest();
  });
  [guestUsernameInput, guestGangInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      continueAsGuest();
    });
  });
}

function sanitizeGuestValue(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Game-Mode": state.activeMode
    },
    body: JSON.stringify(body)
  });
  return res.json();
}

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
  const shell = document.querySelector(".auth-shell");
  const footer = document.querySelector(".auth-footer");
  const stack = document.querySelector(".auth-mobile-fit-stack");
  const media = window.matchMedia("(max-width: 900px)");
  if (!body || !shell || !footer || !stack) return;

  let frame = 0;
  const fitClasses = ["login-mobile-fit-compact", "login-mobile-fit-tight", "login-mobile-fit-ultra"];
  let keyboardEditingLock = false;

  const getOuterHeight = (element) => {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const marginTop = parseFloat(styles.marginTop || "0") || 0;
    const marginBottom = parseFloat(styles.marginBottom || "0") || 0;
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

  const isEditableField = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    return (
      element instanceof HTMLInputElement
      || element instanceof HTMLTextAreaElement
      || element.isContentEditable
    );
  };

  document.addEventListener("focusin", (event) => {
    if (!media.matches) return;
    if (!isEditableField(event.target)) return;
    keyboardEditingLock = true;
    body.classList.add("login-mobile-keyboard-lock");
  });

  document.addEventListener("focusout", () => {
    if (!media.matches) return;
    window.setTimeout(() => {
      const active = document.activeElement;
      const stillEditing = isEditableField(active);
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
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", requestMeasure);
    window.visualViewport.addEventListener("scroll", requestMeasure);
  }
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", requestMeasure);
  } else if (typeof media.addListener === "function") {
    media.addListener(requestMeasure);
  }
}
