import {
  accountSession,
  loadAccountRegistrationPolicy,
  loginAccount,
  registerAccount
} from "./app/player-entry-client.js";
import { bindLoginAboutModal, bindLoginInfoModals } from "./app/login-about-modal.js";
import { isLocalDemoAccessAvailable } from "./app/local-demo-gate.js";

const state = { activeTab: "login", submitting: false, registrationEnabled: false };

const initialize = () => {
  bindLocalDemoGuestAccess();
  bindTabs();
  bindPasswordToggle();
  bindForms();
  bindLoginAboutModal();
  bindLoginInfoModals();
  void loadRegistrationPolicy();
  void accountSession().then(() => window.location.replace("./lobby.html")).catch(() => {});
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
else initialize();

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
  guestButton.textContent = "LOKÁLNÍ UI DEMO";
  guestButton.addEventListener("click", () => location.assign("./login.html?runtimeMode=local-demo"));
}

function bindTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  document.querySelectorAll("[data-tab-link]").forEach((button) => button.addEventListener("click", () => setTab(state.activeTab === "login" ? "register" : "login")));
}

function setTab(tab) {
  if (tab === "register" && !state.registrationEnabled) {
    renderRegistrationPolicy("REGISTRACE JE MOMENTÁLNĚ UZAVŘENA", "Do closed alpha se nyní mohou přihlásit pouze existující účty.");
    return;
  }
  state.activeTab = tab === "register" ? "register" : "login";
  document.querySelector("#login-form")?.classList.toggle("hidden", state.activeTab !== "login");
  document.querySelector("#register-form")?.classList.toggle("hidden", state.activeTab !== "register");
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const active = button.dataset.tab === state.activeTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  showError("");
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
  const registerTab = document.querySelector('[data-tab="register"]');
  const registerLink = document.querySelector('[data-tab-link="register"]');
  [registerTab, registerLink].forEach((control) => {
    if (!(control instanceof HTMLButtonElement)) return;
    control.disabled = !enabled;
    control.setAttribute("aria-disabled", String(!enabled));
  });
  document.querySelectorAll("#register-form input, #register-form button").forEach((control) => {
    if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) control.disabled = !enabled;
  });
  const invite = document.querySelector("#register-invite");
  if (invite instanceof HTMLInputElement) {
    invite.required = policy?.inviteRequired === true;
    invite.placeholder = policy?.inviteRequired === true ? "Povinný closed alpha invite" : "Closed alpha invite";
  }
  if (!enabled && state.activeTab === "register") setTab("login");
  renderRegistrationPolicy(
    enabled ? "INVITE-ONLY REGISTRACE JE OTEVŘENÁ" : "REGISTRACE JE MOMENTÁLNĚ UZAVŘENA",
    enabled
      ? `Pro vstup potřebuješ platný invite. Heslo musí mít alespoň ${policy.passwordMinimumLength} znaků.`
      : "Do closed alpha se nyní mohou přihlásit pouze existující účty."
  );
}

function renderRegistrationPolicy(title, message) {
  const node = document.querySelector("[data-registration-policy-status]");
  if (!node) return;
  node.innerHTML = `<strong>${escapeText(title)}</strong><span>${escapeText(message)}</span>`;
}

const escapeText = (value) => String(value || "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);

function bindPasswordToggle() {
  document.querySelector("[data-password-toggle]")?.addEventListener("click", () => {
    const input = document.querySelector("#login-password");
    if (!(input instanceof HTMLInputElement)) return;
    input.type = input.type === "password" ? "text" : "password";
  });
}

function bindForms() {
  document.querySelector("#login-form")?.addEventListener("submit", (event) => void submit(event, async () => loginAccount({
    username: value("login-username"), password: value("login-password")
  })));
  document.querySelector("#register-form")?.addEventListener("submit", (event) => void submit(event, async () => registerAccount({
    username: value("register-username"), gangName: value("register-gang"), password: value("register-password"),
    inviteCode: value("register-invite")
  })));
}

async function submit(event, operation) {
  event.preventDefault();
  if (state.submitting) return;
  const button = event.currentTarget.querySelector("button[type='submit']");
  state.submitting = true;
  if (button) button.disabled = true;
  showError("");
  try {
    await operation();
    window.location.replace("./lobby.html");
  } catch (error) {
    showError(error instanceof Error ? error.message : "Přihlášení se nezdařilo.");
    state.submitting = false;
    if (button) button.disabled = false;
  }
}

const value = (id) => String(document.getElementById(id)?.value || "").trim();
function showError(message) {
  const node = document.querySelector("#auth-error");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("hidden", !message);
}
