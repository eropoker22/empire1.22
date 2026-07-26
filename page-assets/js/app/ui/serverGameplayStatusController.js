import {
  CITY_CLOCK_SELECTOR,
  CITY_DAY_PHASE_SELECTOR,
  CITY_GAME_PHASE_SELECTOR,
  CITY_PRODUCTION_SELECTOR,
  CITY_STATUS_SELECTOR,
  GANG_ALLIANCE_SELECTOR,
  GANG_DISTRICTS_SELECTOR,
  GANG_FACTION_SELECTOR,
  GANG_MEMBERS_SELECTOR
} from "../runtime/constants.js";
import { createServerGameplayStatusView } from "./serverGameplayStatusViewModel.js";

const CITY_CLASS_NAMES = Object.freeze([
  "city-status-pill--danger",
  "city-status-pill--critical",
  "city-status-pill--final"
]);

export function createServerGameplayStatusController({
  root,
  documentRef = root?.ownerDocument || globalThis.document
} = {}) {
  let mounted = false;
  let elements = {};
  let fingerprint = "";
  const diagnostics = { updates: 0, renders: 0, domWrites: 0 };

  const setText = (element, value) => {
    const text = String(value ?? "");
    if (!element || element.textContent === text) return 0;
    element.textContent = text;
    return 1;
  };

  const setAttribute = (element, name, value) => {
    const text = String(value ?? "");
    if (!element || element.getAttribute?.(name) === text) return 0;
    element.setAttribute?.(name, text);
    return 1;
  };

  const setPillLabel = (element, label, mobileLabel) => {
    const labelElement = element?.closest?.(".city-status-pill")
      ?.querySelector?.(".city-status-pill__label");
    if (!labelElement) return 0;
    return setText(labelElement, label)
      + setAttribute(labelElement, "data-mobile-short", mobileLabel);
  };

  const updateStatusClasses = (city) => {
    const statusPill = elements.gamePhase?.closest?.(".city-status-pill");
    const bar = elements.gamePhase?.closest?.(".city-status-bar");
    let writes = setAttribute(bar, "data-city-status-mode", city.cityStatusMode || "br");
    if (!statusPill?.classList) return writes;
    const activeClass = city.statusClass ? `city-status-pill--${city.statusClass}` : "";
    for (const className of CITY_CLASS_NAMES) {
      const shouldHaveClass = className === activeClass;
      if (statusPill.classList.contains(className) !== shouldHaveClass) {
        statusPill.classList.toggle(className, shouldHaveClass);
        writes += 1;
      }
    }
    return writes;
  };

  const render = (view) => {
    const city = view.city;
    let writes = setText(elements.gangMembers, view.gangMembers);
    writes += setText(elements.gangFaction, view.factionLabel);
    writes += setText(elements.gangDistricts, view.districtCount);
    writes += setText(elements.gangAlliance, view.allianceLabel);
    writes += setText(elements.clock, city.clockLabel || "—");
    writes += setPillLabel(elements.clock, "Čas města", "Čas");
    writes += setText(elements.dayPhase, city.dayPhaseLabel || "—");
    writes += setPillLabel(
      elements.dayPhase,
      city.dayPhaseTitle || "Očista",
      city.dayPhaseMobileLabel ?? ""
    );
    writes += setText(elements.gamePhase, city.gamePhaseLabel || "—");
    writes += setPillLabel(
      elements.gamePhase,
      city.gamePhaseTitle || "Stav",
      city.gamePhaseMobileLabel || "Stav"
    );
    writes += setText(elements.status, city.statusLabel || "—");
    writes += setPillLabel(
      elements.status,
      city.statusTitle || "Hráči",
      city.statusMobileLabel || "Hráči"
    );
    writes += setText(elements.production, city.productionLabel || "Očista");
    writes += setAttribute(elements.production, "title", city.actionTitle || "Očista");
    writes += setAttribute(elements.production, "aria-label", city.actionAriaLabel || "Očista");
    writes += updateStatusClasses(city);
    diagnostics.renders += 1;
    diagnostics.domWrites += writes;
    return writes;
  };

  const mount = () => {
    if (mounted) return false;
    const scope = documentRef || root;
    elements = collectElements(scope);
    mounted = true;
    return true;
  };

  const update = (readModel) => {
    if (!mounted) return 0;
    diagnostics.updates += 1;
    const view = createServerGameplayStatusView(readModel);
    if (!view) return 0;
    const nextFingerprint = JSON.stringify(view);
    if (nextFingerprint === fingerprint) return 0;
    fingerprint = nextFingerprint;
    return render(view);
  };

  const destroy = () => {
    if (!mounted) return false;
    elements = {};
    fingerprint = "";
    mounted = false;
    return true;
  };

  return {
    mount,
    update,
    destroy,
    getDiagnostics: () => ({ ...diagnostics, mounted })
  };
}

function collectElements(scope) {
  return {
    gangMembers: scope?.querySelector?.(GANG_MEMBERS_SELECTOR) || null,
    gangFaction: scope?.querySelector?.(GANG_FACTION_SELECTOR) || null,
    gangDistricts: scope?.querySelector?.(GANG_DISTRICTS_SELECTOR) || null,
    gangAlliance: scope?.querySelector?.(GANG_ALLIANCE_SELECTOR) || null,
    clock: scope?.querySelector?.(CITY_CLOCK_SELECTOR) || null,
    dayPhase: scope?.querySelector?.(CITY_DAY_PHASE_SELECTOR) || null,
    gamePhase: scope?.querySelector?.(CITY_GAME_PHASE_SELECTOR) || null,
    status: scope?.querySelector?.(CITY_STATUS_SELECTOR) || null,
    production: scope?.querySelector?.(CITY_PRODUCTION_SELECTOR) || null
  };
}
