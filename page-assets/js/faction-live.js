import { FACTION_CATALOG } from "../../packages/game-config/src/legacy-page/faction-config.js";
import {
  createMembershipJoinTicket,
  finalizeServerSetup,
  joinGameplayMembership,
  loadLobbyOverview,
  loadMembership
} from "./app/player-entry-client.js";
import { getLivePlayerAvatarPreviews } from "./app/model/livePlayerAvatarCatalog.js";

const COLORS = ["#22d3ee", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e"];
const state = { membership: null, factionId: null, avatarId: null, gangColor: null, busy: false };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void boot(), { once: true });
else void boot();

async function boot() {
  try {
    const overview = await loadLobbyOverview();
    const requestedId = new URLSearchParams(location.search).get("membership");
    const candidate = requestedId
      ? overview.memberships.find((membership) => membership.membershipId === requestedId)
      : overview.activeBlockingMembership;
    if (!candidate) { location.replace("./lobby.html"); return; }
    state.membership = await loadMembership(candidate.membershipId);
    if (state.membership.status === "active") { location.replace("./lobby.html"); return; }
    if (!["setup_required", "finalizing_setup"].includes(state.membership.status)) { location.replace("./lobby.html"); return; }
    renderContext(overview.account, state.membership);
    bindFactionCards();
    renderColors();
    renderAvatars();
    bindAvatarControls();
    bindSubmit();
    if (state.membership.status === "finalizing_setup") {
      setStatus("Aktivace probíhá", "Worker dokončuje hráče, district a startovní zdroje právě jednou.");
      void awaitActivation();
    }
  } catch (error) {
    if (error?.status === 401) location.replace("./login.html");
    else setStatus("Setup není dostupný", error instanceof Error ? error.message : "Server setup se nepodařilo načíst.");
  }
}

function bindFactionCards() {
  document.querySelectorAll("[data-faction-id]").forEach((button) => button.addEventListener("click", () => {
    if (state.busy) return;
    const factionId = String(button.dataset.factionId || "");
    if (!FACTION_CATALOG[factionId]) return;
    state.factionId = factionId;
    state.avatarId = null;
    document.querySelectorAll("[data-faction-id]").forEach((entry) => entry.classList.toggle("is-active", entry === button));
    renderFactionDetail();
    renderAvatars();
    updateReadyState();
  }));
}

function renderFactionDetail() {
  const faction = FACTION_CATALOG[state.factionId];
  text("#faction-title", faction?.name || "Zvol frakci");
  text("[data-faction-name]", faction?.name || "Nevybráno");
  text("#faction-tagline", faction?.tagline || "");
  text("#faction-desc", faction?.description || "");
  renderFactionBenefits(faction);
  const detail = document.querySelector("#faction-detail");
  detail?.classList.toggle("is-active", Boolean(faction));
}

function renderFactionBenefits(faction) {
  const bonus = document.querySelector("#faction-bonus");
  if (!bonus || !faction) return;
  const advantages = faction.advantages?.length ? faction.advantages : ["Vyvážený frakční profil."];
  const disadvantages = faction.disadvantages?.length ? faction.disadvantages : ["Bez výrazné úvodní nevýhody."];
  bonus.replaceChildren(
    createElement("span", "faction-bonus__icon", "✦", { "aria-hidden": "true" }),
    createBenefitsList(advantages, disadvantages)
  );
}

function createBenefitsList(advantages, disadvantages) {
  const list = createElement("span", "faction-bonus__copy faction-bonus__copy--rows");
  list.append(
    createBenefitRow("Výhody", advantages, "faction-bonus__row--advantage"),
    createBenefitRow("Nevýhody", disadvantages, "faction-bonus__row--disadvantage")
  );
  return list;
}

function createBenefitRow(label, values, modifier) {
  const row = createElement("span", `faction-bonus__row ${modifier}`);
  row.append(createElement("strong", "", label), createElement("span", "", values.join(" • ")));
  return row;
}

function renderAvatars() {
  const grid = document.querySelector("#avatar-grid");
  if (!grid) return;
  const avatars = state.factionId ? getLivePlayerAvatarPreviews(state.factionId) : [];
  const marquee = document.querySelector(".avatar-marquee");
  if (marquee) marquee.scrollLeft = 0;
  if (!avatars.length) {
    grid.innerHTML = '<div class="avatar-track__hint">Nejdřív vyber frakci.</div>';
    return;
  }
  grid.innerHTML = avatars.map((source, index) => {
    const avatarId = `${state.factionId}:${index + 1}`;
    return `<button class="avatar-item ${avatarId === state.avatarId ? "is-selected" : ""}" data-live-avatar="${avatarId}" type="button">
      <img src="${escapeAttribute(source)}" alt="Avatar ${index + 1}">
    </button>`;
  }).join("");
  grid.querySelectorAll("[data-live-avatar]").forEach((button) => button.addEventListener("click", () => {
    if (state.busy) return;
    state.avatarId = button.dataset.liveAvatar;
    grid.querySelectorAll("[data-live-avatar]").forEach((entry) => entry.classList.toggle("is-selected", entry === button));
    updateReadyState();
  }));
}

function bindAvatarControls() {
  const marquee = document.querySelector(".avatar-marquee");
  if (!marquee) return;
  const move = (direction) => marquee.scrollBy({
    left: direction * Math.max(220, Math.round(marquee.clientWidth * 0.72)),
    behavior: "smooth"
  });
  document.querySelector("#avatar-left")?.addEventListener("click", () => move(-1));
  document.querySelector("#avatar-right")?.addEventListener("click", () => move(1));
}

function renderColors() {
  const grid = document.querySelector("#gang-color-grid");
  if (!grid) return;
  grid.innerHTML = COLORS.map((color) => `<button class="gang-color-swatch" type="button" data-live-color="${color}" style="--swatch:${color}" aria-label="${color}"></button>`).join("");
  grid.querySelectorAll("[data-live-color]").forEach((button) => button.addEventListener("click", () => {
    if (state.busy) return;
    state.gangColor = button.dataset.liveColor;
    grid.querySelectorAll("[data-live-color]").forEach((entry) => entry.classList.toggle("is-selected", entry === button));
    updateReadyState();
  }));
}

function bindSubmit() {
  const link = document.querySelector("#go-game");
  link?.addEventListener("click", (event) => { event.preventDefault(); void submitSetup(); });
  document.querySelector("#auth-form")?.addEventListener("submit", (event) => { event.preventDefault(); void submitSetup(); });
}

async function submitSetup() {
  if (state.busy || !state.membership || !state.factionId || !state.avatarId || !state.gangColor) return;
  state.busy = true;
  updateReadyState();
  setStatus("Potvrzuji serverovou identitu", "Čekám na authoritative worker a platný lease.");
  try {
    state.membership = await finalizeServerSetup({
      membershipId: state.membership.membershipId,
      factionId: state.factionId,
      avatarId: state.avatarId,
      gangColor: state.gangColor
    });
    await awaitActivation();
  } catch (error) {
    state.busy = false;
    updateReadyState();
    setStatus("Setup se nezdařil", error instanceof Error ? error.message : "Server setup se nepodařilo uložit.");
  }
}

async function awaitActivation() {
  state.busy = true;
  updateReadyState();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    state.membership = await loadMembership(state.membership.membershipId);
    if (state.membership.status === "active") {
      const ticketed = state.membership.joinTicket ? state.membership : await createMembershipJoinTicket(state.membership.membershipId);
      await joinGameplayMembership(ticketed);
      location.replace("./game.html");
      return;
    }
    if (state.membership.status !== "finalizing_setup") throw new Error("Server setup přešel do neočekávaného stavu.");
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  state.busy = false;
  updateReadyState();
  setStatus("Worker stále připravuje server", "Membership zůstává durable. Vrať se do lobby a použij DOKONČIT VSTUP.");
}

function renderContext(account, membership) {
  text("[data-auth-flow-title]", "Serverová frakce a avatar");
  text("[data-auth-identity]", account.username);
  text("[data-auth-kind]", "Ověřený account session");
  text("[data-auth-server]", membership.serverDisplayName);
  text("[data-auth-district]", `Serverem potvrzeno: ${membership.reservedSpawnDistrictId}`);
  text("#structure-note", "Vyber frakci, canonical avatar a serverovou barvu. Volba se uloží až po potvrzení serverem.");
}

function updateReadyState() {
  const ready = Boolean(state.factionId && state.avatarId && state.gangColor && !state.busy);
  const link = document.querySelector("#go-game");
  link?.classList.toggle("faction-link--disabled", !ready);
  link?.setAttribute("aria-disabled", String(!ready));
  if (link) link.textContent = state.busy ? "SERVER SE PŘIPRAVUJE…" : "POTVRDIT A VSTOUPIT";
}

function setStatus(title, message) {
  const node = document.querySelector("#faction-inline-status");
  if (!node) return;
  node.textContent = [title, message].filter(Boolean).join(" • ");
  node.classList.remove("hidden");
}
function createElement(tagName, className = "", content = "", attributes = {}) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = content;
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}
function text(selector, value) { const node = document.querySelector(selector); if (node) node.textContent = String(value ?? ""); }
function escapeAttribute(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
