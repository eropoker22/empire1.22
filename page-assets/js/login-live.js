import {
  accountSession,
  loadAccountRegistrationPolicy,
  loginAccount,
  registerAccount
} from "./app/player-entry-client.js";
import { bindLoginAboutModal, bindLoginInfoModals } from "./app/login-about-modal.js";
import { bindLoginRegistrationModal } from "./app/login-registration-modal.js";
import { isLocalDemoAccessAvailable } from "./app/local-demo-gate.js";
import { STORAGE_KEYS } from "./config.js";

const state = {
  submitting: false,
  registrationEnabled: false,
  activeMode: "free"
};

const initialize = () => {
  state.activeMode = resolveInitialMode();
  bindModeCards();
  updateModeCards();
  bindLocalDemoGuestAccess();
  bindPasswordToggle();
  bindForms();
  bindLoginRegistrationModal({ onOpen: () => showRegistrationError("") });
  bindLoginAboutModal();
  bindLoginInfoModals();
  void loadRegistrationPolicy();
  void accountSession().then(() => window.location.replace(lobbyHref())).catch(() => {});
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
else initialize();

function normalizeMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return mode === "free" || mode === "war" ? mode : "";
}

function resolveInitialMode() {
  const requestedMode = normalizeMode(new URLSearchParams(window.location.search).get("mode"));
  const storedMode = normalizeMode(window.localStorage.getItem(STORAGE_KEYS.activeAuthMode));
  return requestedMode || storedMode || "free";
}

function lobbyHref() {
  return `./lobby.html?mode=${state.activeMode}`;
}

function bindModeCards() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = normalizeMode(button.getAttribute("data-mode"));
      if (!mode || mode === state.activeMode) return;
      state.activeMode = mode;
      window.localStorage.setItem(STORAGE_KEYS.activeAuthMode, mode);
      updateModeCards();
    });
  });
}

function updateModeCards() {
  document.body.classList.toggle("auth-body--free", state.activeMode === "free");
  document.body.classList.toggle("auth-body--war", state.activeMode === "war");
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const isActive = normalizeMode(button.getAttribute("data-mode")) === state.activeMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function bindLocalDemoGuestAccess() {
  const guestAccess = document.querySelector(".guest-access");
  const guestButton = document.querySelector("#guest-btn");
  if (!(guestAccess instanceof HTMLElement) || !(guestButton instanceof HTMLButtonElement)) return;
  if (!isLocalDemoAccessAvailable()) {
    guestAccess.hidden = true;
    guestAccess.setAttribute("aria-hidden", "true");
    guestAccess.querySelectorAll("input, button").forEach((control) => control.setAttribute("tabindex", "-1"));
    return;
  }
  guestAccess.hidden = false;
  guestAccess.setAttribute("aria-hidden", "false");
  guestButton.textContent = "SPUSTIT LOKÁLNÍ DEMO";
  guestButton.addEventListener("click", () => location.assign(`./login.html?runtimeMode=local-demo&mode=${state.activeMode}`));
}

async function loadRegistrationPolicy() {
  try {
    const policy = await loadAccountRegistrationPolicy();
    state.registrationEnabled = policy?.registrationEnabled === true;
    applyRegistrationAvailability(policy);
  } catch (_error) {
    state.registrationEnabled = false;
    applyRegistrationAvailability(null);
    renderRegistrationPolicy(
      "STAV REGISTRACE NENÍ DOSTUPNÝ",
      "Stav registrace se nepodařilo ověřit. Přihlášení existujícího účtu zůstává dostupné."
    );
  }
}

function applyRegistrationAvailability(policy) {
  const enabled = policy?.registrationEnabled === true;
  document.querySelectorAll("#register-form input, #register-form button[type='submit']").forEach((control) => {
    if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) control.disabled = !enabled;
  });
  const minimumLength = Number(policy?.passwordMinimumLength) || 12;
  ["register-password", "register-password-confirmation"].forEach((id) => {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) {
      input.minLength = minimumLength;
      input.placeholder = id === "register-password" ? `Alespoň ${minimumLength} znaků` : "Zopakuj heslo";
    }
  });
  const minimumAge = Number(policy?.minimumAgeYears) || 16;
  const birthDate = document.getElementById("register-birth-date");
  if (birthDate instanceof HTMLInputElement) birthDate.max = latestEligibleBirthDate(minimumAge);
  renderRegistrationPolicy(
    enabled ? "REGISTRACE ÚČTŮ JE OTEVŘENÁ" : "REGISTRACE JE MOMENTÁLNĚ UZAVŘENA",
    enabled
      ? `Pozvánku nepotřebuješ. Zadej nick, jméno gangu, datum narození a heslo dvakrát. Minimální věk je ${minimumAge} let.`
      : "Nový účet teď nelze založit. Přihlášení existujícího účtu zůstává dostupné."
  );
}

function renderRegistrationPolicy(title, message) {
  const node = document.querySelector("[data-registration-policy-status]");
  if (!node) return;
  const titleNode = node.querySelector("strong");
  const messageNode = node.querySelector("span");
  if (titleNode) titleNode.textContent = title;
  if (messageNode) messageNode.textContent = message;
}

function bindPasswordToggle() {
  document.querySelector("[data-password-toggle]")?.addEventListener("click", () => {
    const input = document.querySelector("#login-password");
    if (!(input instanceof HTMLInputElement)) return;
    input.type = input.type === "password" ? "text" : "password";
  });
}

function bindForms() {
  document.querySelector("#login-form")?.addEventListener("submit", (event) => void submit({
    event,
    operation: () => loginAccount({ username: value("login-username"), password: rawValue("login-password") }),
    showFailure: showLoginError
  }));
  document.querySelector("#register-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.registrationEnabled) {
      showRegistrationError("Registrace nových účtů není právě dostupná.");
      return;
    }
    const password = rawValue("register-password");
    const passwordConfirmation = rawValue("register-password-confirmation");
    if (password !== passwordConfirmation) {
      showRegistrationError("Zadaná hesla se neshodují.");
      return;
    }
    void submit({
      event,
      operation: () => registerAccount({
        username: value("register-username"),
        gangName: value("register-gang"),
        dateOfBirth: value("register-birth-date"),
        password,
        passwordConfirmation
      }),
      showFailure: showRegistrationError
    });
  });
}

async function submit({ event, operation, showFailure }) {
  event.preventDefault();
  if (state.submitting) return;
  const form = event.currentTarget;
  if (form instanceof HTMLFormElement && !form.reportValidity()) return;
  const button = form?.querySelector?.("button[type='submit']");
  state.submitting = true;
  if (button) button.disabled = true;
  showFailure("");
  try {
    await operation();
    window.location.replace(lobbyHref());
  } catch (error) {
    showFailure(error instanceof Error ? error.message : "Operace se nezdařila.");
    state.submitting = false;
    if (button) button.disabled = form?.id === "register-form" ? !state.registrationEnabled : false;
  }
}

const latestEligibleBirthDate = (minimumAgeYears) => {
  const now = new Date();
  const year = now.getFullYear() - minimumAgeYears;
  return `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const value = (id) => rawValue(id).trim();
const rawValue = (id) => String(document.getElementById(id)?.value || "");

function showLoginError(message) {
  const node = document.querySelector("#auth-error");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("hidden", !message);
}

function showRegistrationError(message) {
  const node = document.querySelector("#register-error");
  if (!node) return;
  node.textContent = message;
  node.hidden = !message;
}
