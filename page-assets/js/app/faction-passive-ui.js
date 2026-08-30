import { FACTION_CATALOG } from "../../../packages/game-config/src/legacy-page/faction-config.js";

let latestFactionView = null;

const CONTEXT_PATTERNS = Object.freeze({
  attack: [/útok/iu, /boj/iu, /vybavení/iu],
  robbery: [/vykrád/iu, /loupež/iu],
  defense: [/obrann/iu, /obrana/iu, /kamer/iu, /alarm/iu, /pasti/iu],
  spy: [/špehov/iu, /informac/iu, /drb/iu, /pasti/iu, /kamer/iu, /alarm/iu],
  occupy: [/obsaz/iu]
});

export function resolveFactionPassiveEffects(factionId = "", context = "profile", activeEffects = null) {
  const faction = FACTION_CATALOG[String(factionId || "").trim()];
  const effects = Array.isArray(activeEffects) ? [...activeEffects] : [...(faction?.coreBackedEffects || [])];
  if (!faction && !Array.isArray(activeEffects)) return [];

  if (context === "profile") return effects;

  const patterns = CONTEXT_PATTERNS[context] || [];
  return effects.filter((effect) => patterns.some((pattern) => pattern.test(effect)));
}

export function resolveFactionPassiveCopy(factionId = "", context = "profile", factionView = null) {
  const faction = FACTION_CATALOG[String(factionId || "").trim()];
  const authoritativeView = factionView?.factionId === factionId ? factionView : null;
  if (!faction && !authoritativeView) return "";

  const effects = resolveFactionPassiveEffects(
    factionId,
    context,
    authoritativeView?.activePassiveEffects
  );
  if (context === "profile") {
    return effects.length > 0
      ? `Aktivní pasivy: ${effects.join(" · ")}`
      : "Aktivní pasivy: bez přímých úprav.";
  }

  return effects.length > 0
    ? `${authoritativeView?.name || faction.name}: ${effects.join(" · ")}`
    : `${authoritativeView?.name || faction.name}: bez přímé úpravy této akce.`;
}

export function renderFactionPassiveUi(documentRef = document, factionView = latestFactionView) {
  const root = documentRef?.querySelector?.("[data-gameplay-slice-client]");
  const factionId = String(factionView?.factionId || root?.dataset?.factionId || "").trim();

  for (const element of documentRef?.querySelectorAll?.("[data-faction-passive-context]") || []) {
    const context = String(element.dataset?.factionPassiveContext || "profile");
    const copy = resolveFactionPassiveCopy(factionId, context, factionView);
    element.textContent = copy;
    element.hidden = !copy;
    element.classList?.toggle?.("hidden", !copy);
    if (copy) element.title = copy;
    else element.removeAttribute?.("title");
  }
}

export function mountFactionPassiveUi(documentRef = document) {
  const root = documentRef?.querySelector?.("[data-gameplay-slice-client]");
  renderFactionPassiveUi(documentRef);
  documentRef?.addEventListener?.("empire:gameplay-slice-rendered", (event) => {
    latestFactionView = event.detail?.playerView?.faction || null;
    renderFactionPassiveUi(documentRef, latestFactionView);
  });
  if (!root) return null;

  const Observer = documentRef?.defaultView?.MutationObserver || globalThis.MutationObserver;
  if (typeof Observer !== "function") return null;

  const observer = new Observer(() => renderFactionPassiveUi(documentRef));
  observer.observe(root, { attributes: true, attributeFilter: ["data-faction-id"] });
  return observer;
}

function initializeFactionPassiveUi() {
  mountFactionPassiveUi(document);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeFactionPassiveUi, { once: true });
  } else {
    initializeFactionPassiveUi();
  }
}
