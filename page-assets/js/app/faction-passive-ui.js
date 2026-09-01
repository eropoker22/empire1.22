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
  attack: [/síla útoku/iu, /doba čekání na útoky/iu, /délka útoků/iu, /ztráty vybavení/iu, /heat z útoků/iu],
  "attack-strength": [/síla útoku/iu],
  "attack-duration": [/doba čekání na útoky/iu, /délka útoků/iu],
  robbery: [/peníze z vykrádání/iu, /kořist z vykrádání/iu, /doba čekání na vykrádání/iu, /heat z útoků, obsazování a vykrádání/iu, /heat z útoků, loupeží/iu, /heat z ilegálních akcí/iu],
  "robbery-loot": [/peníze z vykrádání/iu, /kořist z vykrádání/iu],
  "robbery-duration": [/doba čekání na vykrádání/iu],
  "robbery-heat": [/heat z útoků, obsazování a vykrádání/iu, /heat z útoků, loupeží/iu, /heat z ilegálních akcí/iu],
  defense: [/síla obrany/iu, /obrana districtů/iu, /základní obrana/iu, /účinnost kamer/iu, /účinnost alarmů/iu, /efekt obranných systémů/iu],
  "defense-strength": [/síla obrany/iu, /obrana districtů/iu, /základní obrana/iu],
  spy: [/šance na úspěšné špehování/iu, /šance odhalit pasti/iu, /^špehování\s+[+-]/iu, /doba čekání na špehování/iu, /délka špehování/iu],
  "spy-success": [/šance na úspěšné špehování/iu, /^špehování\s+[+-]/iu],
  "spy-duration": [/doba čekání na špehování/iu, /délka špehování/iu],
  "camera-effectiveness": [/síla obrany/iu, /obrana districtů/iu, /účinnost kamer/iu, /efekt obranných systémů/iu],
  "alarm-effectiveness": [/síla obrany/iu, /obrana districtů/iu, /účinnost alarmů/iu, /efekt obranných systémů/iu],
  occupy: [/doba čekání na obsazování/iu, /síla při obsazování/iu, /heat z útoků.*obsazování/iu],
  "rumor-truth": [/pravdivost potvrzených drbů/iu],
  "building-action": [/heat z útoků, loupeží, akcí budov/iu]
});

const STAT_EFFECT_PATTERNS = Object.freeze([
  { stat: /clean|čist/iu, effect: /čistý příjem/iu },
  { stat: /dirty|špin/iu, effect: /špinavý příjem/iu },
  { stat: /populace|population/iu, effect: /tvorba populace/iu },
  { stat: /vliv|influence/iu, effect: /zisk vlivu/iu },
  { stat: /heat/iu, effect: /heat z útoků, loupeží, akcí budov a pasivního tlaku/iu },
  { stat: /síla útoku|attack power/iu, effect: /síla útoku/iu },
  { stat: /síla obrany|defense power/iu, effect: /síla obrany|obrana districtů|základní obrana/iu }
]);

const BUILDING_STAT_EFFECT_PATTERNS = Object.freeze({
  factory: [{ stat: /produkce|výroba|rychlost|výstup|čas/iu, effect: /produkce technologií/iu }],
  "drug-lab": [{ stat: /produkce|výroba|rychlost|výstup|čas|špinav|dirty/iu, effect: /produkce v podporovaných ilegálních budovách/iu }],
  druglab: [{ stat: /produkce|výroba|rychlost|výstup|čas|špinav|dirty/iu, effect: /produkce v podporovaných ilegálních budovách/iu }],
  drug_lab: [{ stat: /produkce|výroba|rychlost|výstup|čas|špinav|dirty/iu, effect: /produkce v podporovaných ilegálních budovách/iu }],
  "smuggling-tunnel": [
    { stat: /špinav|dirty|produkce|výroba|výnos|tok/iu, effect: /produkce v podporovaných ilegálních budovách|pašování/iu },
    { stat: /distribuce|pašov/iu, effect: /pašování/iu }
  ],
  smuggling_tunnel: [
    { stat: /špinav|dirty|produkce|výroba|výnos|tok/iu, effect: /produkce v podporovaných ilegálních budovách|pašování/iu },
    { stat: /distribuce|pašov/iu, effect: /pašování/iu }
  ],
  "street-dealers": [{ stat: /špinav|dirty|produkce|výroba|výnos|prodej/iu, effect: /produkce v podporovaných ilegálních budovách/iu }],
  street_dealers: [{ stat: /špinav|dirty|produkce|výroba|výnos|prodej/iu, effect: /produkce v podporovaných ilegálních budovách/iu }]
});

const ILLEGAL_ACTION_BUILDINGS = new Set(["drug-lab", "druglab", "drug_lab", "smuggling-tunnel", "smuggling_tunnel", "street-dealers", "street_dealers"]);

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
    for (const rule of BUILDING_STAT_EFFECT_PATTERNS[buildingType] || []) {
      if (rule.stat.test(statLabel)) patterns.push(rule.effect);
    }
    return effects.filter((effect) => patterns.some((pattern) => pattern.test(effect)));
  }
  const patterns = [...(INLINE_CONTEXT_PATTERNS[context] || CONTEXT_PATTERNS[context] || [])];
  if (context === "building-action" && ILLEGAL_ACTION_BUILDINGS.has(String(options.buildingType || "").trim().toLowerCase())) {
    patterns.push(/heat z ilegálních akcí/iu);
  }
  return effects.filter((effect) => patterns.some((pattern) => pattern.test(effect)));
}

export function resolveFactionPassiveInlineCopy(factionId = "", context = "", factionView = null, options = {}) {
  const effects = resolveFactionPassiveInlineEffects(factionId, context, factionView, options);
  return effects.length > 0 ? effects.join(" · ") : "";
}

export function renderFactionPassiveUi(documentRef = document, factionView = latestFactionView) {
  const root = documentRef?.querySelector?.("[data-gameplay-slice-client]");
  const factionId = String(factionView?.factionId || root?.dataset?.factionId || "").trim();

  for (const element of documentRef?.querySelectorAll?.("[data-faction-passive-inline-context], [data-faction-passive-stat-label]") || []) {
    const context = String(element.dataset?.factionPassiveInlineContext || "");
    const shell = element.closest?.("[data-building-mechanics-type], [data-district-building-detail-building-type-id], [data-district-building-detail-popup]");
    const copy = resolveFactionPassiveInlineCopy(factionId, context, factionView, {
      statLabel: element.dataset?.factionPassiveStatLabel || "",
      buildingType: element.dataset?.factionPassiveBuildingType
        || shell?.dataset?.buildingMechanicsType
        || shell?.dataset?.districtBuildingDetailBuildingTypeId
        || ""
    });
    element.textContent = copy;
    element.hidden = !copy;
    element.classList?.toggle?.("hidden", !copy);
    const conditionalRow = element.closest?.("[data-faction-passive-inline-row]");
    if (conditionalRow) {
      conditionalRow.hidden = !copy;
      conditionalRow.classList?.toggle?.("hidden", !copy);
    }
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
