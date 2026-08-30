import { FACTION_CATALOG } from "../../../packages/game-config/src/legacy-page/faction-config.js";

let latestFactionView = null;

const CONTEXT_PATTERNS = Object.freeze({
  attack: [/útok/iu, /boj/iu, /vybavení/iu],
  robbery: [/vykrád/iu, /loupež/iu],
  defense: [/obrann/iu, /obrana/iu, /kamer/iu, /alarm/iu, /pasti/iu],
  spy: [/špehov/iu, /informac/iu, /drb/iu, /pasti/iu, /kamer/iu, /alarm/iu],
  occupy: [/obsaz/iu]
});

const INLINE_CONTEXT_PATTERNS = Object.freeze({
  attack: [/síla útoku/iu, /doba čekání na útoky/iu, /délka útoků/iu, /ztráty vybavení/iu],
  "attack-strength": [/síla útoku/iu],
  "attack-duration": [/doba čekání na útoky/iu, /délka útoků/iu],
  robbery: [/peníze z vykrádání/iu, /kořist z vykrádání/iu, /doba čekání na vykrádání/iu, /heat z útoků, obsazování a vykrádání/iu, /heat z útoků, loupeží/iu],
  "robbery-loot": [/peníze z vykrádání/iu, /kořist z vykrádání/iu],
  "robbery-duration": [/doba čekání na vykrádání/iu],
  "robbery-heat": [/heat z útoků, obsazování a vykrádání/iu, /heat z útoků, loupeží/iu],
  defense: [/síla obrany/iu, /obrana districtů/iu, /základní obrana/iu, /účinnost kamer/iu, /účinnost alarmů/iu],
  "defense-strength": [/síla obrany/iu, /obrana districtů/iu, /základní obrana/iu],
  spy: [/šance na úspěšné špehování/iu, /šance odhalit pasti/iu],
  "spy-success": [/šance na úspěšné špehování/iu],
  occupy: [/doba čekání na obsazování/iu, /síla při obsazování/iu]
});

const STAT_EFFECT_PATTERNS = Object.freeze([
  { stat: /clean|čist/iu, effect: /čistý příjem/iu },
  { stat: /dirty|špin/iu, effect: /špinavý příjem/iu },
  { stat: /populace|population/iu, effect: /tvorba populace/iu },
  { stat: /síla útoku|attack power/iu, effect: /síla útoku/iu },
  { stat: /síla obrany|defense power/iu, effect: /síla obrany|obrana districtů|základní obrana/iu }
]);

const PRODUCTION_EFFECT_BY_BUILDING = Object.freeze({
  factory: /produkce technologií/iu,
  "drug-lab": /produkce v podporovaných ilegálních budovách/iu,
  drug_lab: /produkce v podporovaných ilegálních budovách/iu,
  "smuggling-tunnel": /produkce v podporovaných ilegálních budovách/iu,
  smuggling_tunnel: /produkce v podporovaných ilegálních budovách/iu,
  "street-dealers": /produkce v podporovaných ilegálních budovách/iu,
  street_dealers: /produkce v podporovaných ilegálních budovách/iu
});

function resolveActiveEffects(factionId = "", factionView = null) {
  const faction = FACTION_CATALOG[String(factionId || "").trim()];
  const authoritativeView = factionView?.factionId === factionId ? factionView : null;
  if (!faction && !authoritativeView) return [];
  return Array.isArray(authoritativeView?.activePassiveEffects)
    ? [...authoritativeView.activePassiveEffects]
    : [...(faction?.coreBackedEffects || [])];
}

export function resolveFactionPassiveInlineEffects(factionId = "", context = "", factionView = null, options = {}) {
  const effects = resolveActiveEffects(factionId, factionView);
  if (options.statLabel) {
    const statLabel = String(options.statLabel || "");
    const buildingType = String(options.buildingType || "").trim().toLowerCase();
    const patterns = STAT_EFFECT_PATTERNS
      .filter((entry) => entry.stat.test(statLabel))
      .map((entry) => entry.effect);
    if (/produkce|výroba|rychlost|výstup/iu.test(statLabel) && PRODUCTION_EFFECT_BY_BUILDING[buildingType]) {
      patterns.push(PRODUCTION_EFFECT_BY_BUILDING[buildingType]);
    }
    return effects.filter((effect) => patterns.some((pattern) => pattern.test(effect)));
  }
  const patterns = INLINE_CONTEXT_PATTERNS[context] || CONTEXT_PATTERNS[context] || [];
  return effects.filter((effect) => patterns.some((pattern) => pattern.test(effect)));
}

export function resolveFactionPassiveInlineCopy(factionId = "", context = "", factionView = null, options = {}) {
  const effects = resolveFactionPassiveInlineEffects(factionId, context, factionView, options);
  return effects.length > 0 ? `Frakce: ${effects.join(" · ")}` : "";
}

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

  for (const element of documentRef?.querySelectorAll?.("[data-faction-passive-inline-context], [data-faction-passive-stat-label]") || []) {
    const context = String(element.dataset?.factionPassiveInlineContext || "");
    const shell = element.closest?.("[data-building-mechanics-type], [data-district-building-detail-popup]");
    const copy = resolveFactionPassiveInlineCopy(factionId, context, factionView, {
      statLabel: element.dataset?.factionPassiveStatLabel || "",
      buildingType: shell?.dataset?.buildingMechanicsType || shell?.dataset?.districtBuildingDetailBuildingTypeId || ""
    });
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
  documentRef?.addEventListener?.("empire:faction-passive-targets-changed", () => {
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
