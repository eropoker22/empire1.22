import { FACTION_CATALOG } from "../../packages/game-config/src/legacy-page/faction-config.js";
import {
  createMembershipJoinTicket,
  finalizeServerSetup,
  joinGameplayMembership,
  loadLobbyOverview,
  loadMembership
} from "./app/player-entry-client.js";

const COLORS = ["#22d3ee", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e"];
const AVATAR_PREVIEWS = Object.freeze({
  mafian: ["../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg"],
  kartel: ["../img/avatars/Kartel/0f3d68b6-79b0-4bdd-9856-2491cd66cb78.jpg"],
  kult: ["../img/avatars/kult/5f1bbe02-e437-43b6-b9ed-c453e34ca622.jpg"],
  "tajna-organizace": ["../img/avatars/Tajnaorganizace/0099fc13-4774-459a-b1a9-ea507a6c0526.jpg"],
  hackeri: ["../img/avatars/Hacker/379f566a-18b8-457e-83ee-ee9ee114cb7a.jpg"],
  "motorkarsky-gang": ["../img/avatars/Motogang/grok_image_1773621173474.jpg"],
  "soukroma-armada": ["../img/avatars/SoukromaArmada/17912d57-dfc8-49fc-9a90-44121c298975.jpg"],
  korporace: ["../img/avatars/Korporat/094f576f-646f-4ec9-9786-63019d07cdfe.jpg"]
});
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
  const detail = document.querySelector("#faction-detail");
  detail?.classList.toggle("is-active", Boolean(faction));
}

function renderAvatars() {
  const grid = document.querySelector("#avatar-grid");
  if (!grid) return;
  const avatars = state.factionId ? (AVATAR_PREVIEWS[state.factionId] || []) : [];
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
function text(selector, value) { const node = document.querySelector(selector); if (node) node.textContent = String(value ?? ""); }
function escapeAttribute(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
