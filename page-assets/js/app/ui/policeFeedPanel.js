function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getOwnerDocument(element) {
  return element?.ownerDocument || (typeof document !== "undefined" ? document : null);
}

function createElement(ownerDocument, tagName, className = "") {
  const element = ownerDocument?.createElement?.(tagName);
  if (element && className) {
    element.className = className;
  }
  return element || null;
}

function setStat(element, label, value, description = "") {
  if (!element) return;
  element.textContent = `${label}: ${value}`;
  if (description) {
    element.setAttribute?.("title", description);
    element.setAttribute?.("aria-label", `${label}: ${value}. ${description}`);
  }
}

function formatRemainingMs(value) {
  const seconds = Math.max(0, Math.ceil(Number(value || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function renderFeedRows(list, entries = []) {
  const ownerDocument = getOwnerDocument(list);
  list?.replaceChildren?.();

  const safeEntries = asArray(entries);
  if (!safeEntries.length) {
    const empty = createElement(ownerDocument, "li", "police-feed-panel__empty");
    if (empty) {
      empty.textContent = "Zatím bez policejního eventu. Sleduj heat po rizikových akcích.";
      list.append(empty);
    }
    return;
  }

  for (const entry of safeEntries.slice(0, 4)) {
    const item = createElement(ownerDocument, "li", "police-feed-panel__entry");
    const title = createElement(ownerDocument, "strong");
    const copy = createElement(ownerDocument, "span");
    if (!item || !title || !copy) {
      continue;
    }
    title.textContent = safeText(entry.title || entry.badge || entry.kind, "Policejní stav");
    copy.textContent = safeText(entry.message || entry.summary || entry.detail, "Bez detailu.");
    item.append(title, copy);
    list.append(item);
  }
}

export function renderPoliceFeedPanel(mount, viewModel = {}, callbacks = {}, options = {}) {
  if (!mount) {
    return false;
  }

  const ownerDocument = getOwnerDocument(mount);
  mount.classList?.add?.("police-feed-panel");
  mount.dataset.policeRisk = safeText(viewModel.riskKey, "low");
  mount.replaceChildren?.();

  const header = createElement(ownerDocument, "div", "police-feed-panel__header");
  const titleWrap = createElement(ownerDocument, "div");
  const eyebrow = createElement(ownerDocument, "span", "police-feed-panel__eyebrow");
  const title = createElement(ownerDocument, "strong", "police-feed-panel__title");
  const status = createElement(ownerDocument, "span", "police-feed-panel__status");
  const grid = createElement(ownerDocument, "div", "police-feed-panel__grid");
  const heat = createElement(ownerDocument, "span");
  const wanted = createElement(ownerDocument, "span");
  const pressure = createElement(ownerDocument, "span");
  const playerPressure = createElement(ownerDocument, "span");
  const districtPressure = createElement(ownerDocument, "span");
  const hottestDistrict = createElement(ownerDocument, "span");
  const risk = createElement(ownerDocument, "p", "police-feed-panel__risk");
  const explanation = createElement(ownerDocument, "p", "police-feed-panel__explanation");
  const latest = createElement(ownerDocument, "p", "police-feed-panel__latest");
  const pending = createElement(ownerDocument, "p", "police-feed-panel__pending");
  const pendingCountdown = createElement(ownerDocument, "strong", "police-feed-panel__raid-countdown");
  const acknowledge = createElement(ownerDocument, "button", "button police-feed-panel__acknowledge");
  const list = createElement(ownerDocument, "ul", "police-feed-panel__list");

  if (!header || !titleWrap || !eyebrow || !title || !status || !grid || !heat || !wanted || !pressure || !playerPressure || !districtPressure || !hottestDistrict || !risk || !explanation || !latest || !pending || !pendingCountdown || !acknowledge || !list) {
    return false;
  }

  eyebrow.textContent = "POLICIE";
  title.textContent = "Policejní tlak";
  status.textContent = safeText(viewModel.statusLabel, "Nízký");
  setStat(wanted, "Hledanost", safeText(viewModel.wantedLabel, "0 / 5"), "Osobní policejní stopa hráče. Není to jediné policejní riziko.");
  setStat(heat, "Heat hráče", Number(viewModel.playerHeat ?? viewModel.heat ?? 0), "Heat přímo na hráči.");
  setStat(districtPressure, "Heat districtů", Number(viewModel.ownedDistrictHeat ?? viewModel.districtHeatPressure ?? 0), "Heat z vlastněných districtů.");
  setStat(pressure, "Tlak raidu", Number(viewModel.raidPressure ?? viewModel.aggregatePressure ?? viewModel.heat ?? 0), "Celkový tlak policie, který rozhoduje o varování a raidu.");
  setStat(playerPressure, "Tlak hráče", Number(viewModel.playerHeatPressure || viewModel.heat || 0), "Příspěvek heat hráče do tlaku raidu.");
  setStat(hottestDistrict, "Nejhorší district", `${safeText(viewModel.hottestDistrictId, "-")} ${Number(viewModel.hottestDistrictHeat || 0)}`, "Nejhorkější vlastněný district.");
  risk.textContent = safeText(viewModel.riskMessage, "Nízký dohled. Policie zatím jen sbírá šum z ulice.");
  explanation.textContent = safeText(viewModel.raidPressureExplanation, "Heat districtů může přitáhnout raid i bez vysoké hledanosti.");
  latest.textContent = safeText(viewModel.lastMessage, "Poslední zpráva: bez aktivního hlášení.");
  const preview = viewModel.previewConsequences && typeof viewModel.previewConsequences === "object"
    ? viewModel.previewConsequences
    : null;
  const mitigation = preview?.courthouseMitigation && typeof preview.courthouseMitigation === "object"
    ? preview.courthouseMitigation
    : null;
  pending.textContent = viewModel.pendingRaid
    ? `AKTUÁLNÍ ODHAD ZÁSAHU · ${safeText(viewModel.pendingRaid.severity, "vysoká")} · dirty cash ${Number(preview?.seizedDirtyCash || 0)} · heat -${Number(preview?.heatReducedBy || 0)}${mitigation ? ` · Soud -${Number(mitigation.reductionPct || 0)} %` : ""}`
    : safeText(viewModel.recommendedAction, "");
  if (viewModel.pendingRaid?.expiresAtMs) {
    bindSharedCountdown(pendingCountdown, () => `ZÁSAH ZA ${formatRemainingMs(Number(viewModel.pendingRaid.expiresAtMs) - Date.now())}`);
  }
  acknowledge.type = "button";
  acknowledge.textContent = "BERU NA VĚDOMÍ";
  acknowledge.title = "Toto pouze zavře varování. Razie bude pokračovat do uvedeného času.";
  acknowledge.hidden = !viewModel.pendingRaid;
  acknowledge.disabled = !viewModel.pendingRaid || typeof callbacks.onAcknowledge !== "function";
  acknowledge.addEventListener?.("click", () => callbacks.onAcknowledge?.(viewModel.pendingRaid?.raidId));

  titleWrap.append(eyebrow, title);
  header.append(titleWrap, status);
  grid.append(wanted, heat, districtPressure, pressure, playerPressure, hottestDistrict);
  renderFeedRows(list, viewModel.entries);
  mount.append(header, grid, risk, explanation, latest, pending, pendingCountdown, acknowledge, list);

  if (options.focusAfterRender && typeof mount.focus === "function") {
    mount.focus();
  }

  callbacks.onRender?.(viewModel);
  return true;
}

if (typeof window !== "undefined") {
  window.EmpirePoliceFeedPanel = {
    renderPoliceFeedPanel
  };
}
import { bindSharedCountdown } from "./sharedCountdownTicker.js";
