import { accountSession, loginAccount, registerAccount } from "./app/player-entry-client.js";

const state = { activeTab: "login", submitting: false };

const initialize = () => {
  document.querySelector(".guest-access")?.setAttribute("hidden", "");
  bindTabs();
  bindPasswordToggle();
  bindForms();
  void accountSession().then(() => window.location.replace("./lobby.html")).catch(() => {});
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
else initialize();

function bindTabs() {
  document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  document.querySelectorAll("[data-tab-link]").forEach((button) => button.addEventListener("click", () => setTab(state.activeTab === "login" ? "register" : "login")));
}

function setTab(tab) {
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
