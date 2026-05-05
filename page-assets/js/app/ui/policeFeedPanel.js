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
    title.textContent = safeText(entry.title || entry.badge || entry.kind, "Police status");
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
  const latest = createElement(ownerDocument, "p", "police-feed-panel__latest");
  const pending = createElement(ownerDocument, "p", "police-feed-panel__pending");
  const list = createElement(ownerDocument, "ul", "police-feed-panel__list");

  if (!header || !titleWrap || !eyebrow || !title || !status || !grid || !heat || !wanted || !pressure || !playerPressure || !districtPressure || !hottestDistrict || !risk || !latest || !pending || !list) {
    return false;
  }

  eyebrow.textContent = "POLICE";
  title.textContent = "Heat feedback";
  status.textContent = safeText(viewModel.statusLabel, "Low");
  heat.textContent = `Heat ${Number(viewModel.heat || 0)}`;
  wanted.textContent = `Wanted ${safeText(viewModel.wantedLabel, "0 / 6")}`;
  pressure.textContent = `Pressure ${Number(viewModel.aggregatePressure || viewModel.heat || 0)}`;
  playerPressure.textContent = `Player ${Number(viewModel.playerHeatPressure || viewModel.heat || 0)}`;
  districtPressure.textContent = `District ${Number(viewModel.districtHeatPressure || 0)}`;
  hottestDistrict.textContent = `Hot ${safeText(viewModel.hottestDistrictId, "-")} ${Number(viewModel.hottestDistrictHeat || 0)}`;
  risk.textContent = safeText(viewModel.riskMessage, "Nízký dohled. Policie zatím jen sbírá šum z ulice.");
  latest.textContent = safeText(viewModel.lastMessage, "Poslední zpráva: bez aktivního hlášení.");
  const preview = viewModel.previewConsequences && typeof viewModel.previewConsequences === "object"
    ? viewModel.previewConsequences
    : null;
  pending.textContent = viewModel.pendingRaid
    ? `Pending raid: ${safeText(viewModel.pendingRaid.severity, "high")} · dirty cash ${Number(preview?.seizedDirtyCash || 0)} · heat -${Number(preview?.heatReducedBy || 0)}`
    : safeText(viewModel.recommendedAction, "");

  titleWrap.append(eyebrow, title);
  header.append(titleWrap, status);
  grid.append(heat, wanted, pressure, playerPressure, districtPressure, hottestDistrict);
  renderFeedRows(list, viewModel.entries);
  mount.append(header, grid, risk, latest, pending, list);

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
