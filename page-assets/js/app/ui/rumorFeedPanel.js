function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
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

export function normalizeCityFeedEvent(event = {}) {
  const createdAtTick = Math.max(0, Number(event.createdAtTick ?? event.tick ?? 0) || 0);
  const timestampMs = Math.max(0, Number(event.timestampMs ?? event.createdAt ?? Date.now()) || Date.now());
  const sourceType = safeText(event.sourceType || event.kind || event.type, "system");
  const category = safeText(event.category, sourceType === "police_raid" || sourceType === "police_warning" ? "police" : "rumor");
  const severity = ["low", "medium", "high", "extreme"].includes(String(event.severity))
    ? String(event.severity)
    : "low";
  const truthiness = ["confirmed", "unconfirmed", "false_possible"].includes(String(event.truthiness))
    ? String(event.truthiness)
    : "unconfirmed";
  const sourceEventId = safeText(event.sourceEventId || event.actionResultId || event.raidId || event.battleReportId || event.id);

  return {
    id: safeText(event.id, `city-feed:${sourceType}:${sourceEventId || timestampMs}`),
    sourceEventId,
    sourceType,
    category,
    severity,
    truthiness,
    visibility: safeText(event.visibility, "all"),
    playerId: safeText(event.playerId),
    targetPlayerId: safeText(event.targetPlayerId),
    districtId: safeText(event.districtId || event.targetDistrictId),
    zone: safeText(event.zone),
    createdAtTick,
    timestampMs,
    message: safeText(event.message || event.summary, "Město zachytilo nejasný pohyb v ulicích."),
    messageKey: safeText(event.messageKey),
    payload: event.payload && typeof event.payload === "object" ? event.payload : {}
  };
}

export function normalizeCityFeedEvents(events = []) {
  const seen = new Set();
  return asArray(events)
    .map((event) => normalizeCityFeedEvent(event))
    .filter((event) => {
      const key = event.sourceEventId || event.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.createdAtTick - left.createdAtTick || right.timestampMs - left.timestampMs);
}

export function renderRumorFeedPanel(mount, viewModel = {}, callbacks = {}, options = {}) {
  if (!mount) return false;
  const ownerDocument = getOwnerDocument(mount);
  const events = normalizeCityFeedEvents(viewModel.events || viewModel.currentPlayerFeed || viewModel.globalCityFeed).slice(0, Number(options.limit || 6));
  mount.classList?.add?.("building-action-status", "city-rumor-feed-panel");
  mount.setAttribute?.("data-rumor-feed", "");
  mount.replaceChildren?.();

  const head = createElement(ownerDocument, "div", "building-action-status__head");
  const title = createElement(ownerDocument, "span", "building-action-status__eyebrow");
  const state = createElement(ownerDocument, "strong", "building-action-status__state");
  const summary = createElement(ownerDocument, "p", "building-action-status__summary");
  const feed = createElement(ownerDocument, "div", "building-action-status__feed");
  if (!head || !title || !state || !summary || !feed) return false;

  title.textContent = "Drby města";
  state.textContent = events.length ? `${events.length} zpráv` : "Ticho";
  summary.textContent = events[0]?.message || "Zatím žádné potvrzené ani šeptané zprávy z ulic.";
  feed.setAttribute("role", "log");
  feed.setAttribute("aria-live", "polite");

  for (const event of events) {
    feed.append(createRumorFeedItem(ownerDocument, event, callbacks));
  }

  if (!events.length) {
    const empty = createElement(ownerDocument, "p", "building-action-status__empty");
    if (empty) {
      empty.textContent = "Žádné drby. První útok, špionáž nebo policejní tlak se objeví tady.";
      feed.append(empty);
    }
  }

  head.append(title, state);
  mount.append(head, summary, feed);
  callbacks.onRender?.(events);
  return true;
}

function createRumorFeedItem(ownerDocument, event, callbacks = {}) {
  const item = createElement(ownerDocument, "article", `building-action-status__item building-action-status__item--${event.severity === "high" || event.severity === "extreme" ? "warning" : "event"} building-action-status__item--neutral`);
  const head = createElement(ownerDocument, "div", "building-action-status__item-head");
  const title = createElement(ownerDocument, "strong", "building-action-status__item-title");
  const badge = createElement(ownerDocument, "span", "building-action-status__item-meta");
  const summary = createElement(ownerDocument, "p", "building-action-status__item-summary");
  const meta = createElement(ownerDocument, "p", "building-action-status__item-meta");
  if (!item || !head || !title || !badge || !summary || !meta) return ownerDocument.createTextNode("");

  item.dataset.cityFeedEventId = event.id;
  title.textContent = event.category === "police" ? "Police" : event.sourceType.replaceAll("_", " ");
  badge.textContent = `${event.severity} · ${event.truthiness}`;
  summary.textContent = event.message;
  meta.textContent = event.districtId ? `District ${event.districtId}` : "Město";
  head.append(title, badge);
  item.append(head, summary, meta);
  item.addEventListener?.("click", () => callbacks.onSelect?.(event));
  return item;
}

export function renderDistrictRumorFeed(list, events = [], options = {}) {
  if (!list) return false;
  const ownerDocument = getOwnerDocument(list);
  const districtId = safeText(options.districtId);
  const entries = normalizeCityFeedEvents(events)
    .filter((event) => !districtId || event.districtId === districtId || event.districtId === `district:${districtId}`)
    .slice(0, Number(options.limit || 5));
  list.replaceChildren?.();

  for (const event of entries) {
    const item = createElement(ownerDocument, "div", "district-popup-gossip__item");
    const text = createElement(ownerDocument, "div", "district-popup-gossip__text");
    const meta = createElement(ownerDocument, "span", "district-popup-gossip__badge district-popup-gossip__badge--rumor");
    if (!item || !text || !meta) continue;
    text.textContent = event.message;
    meta.textContent = event.truthiness === "confirmed" ? "intel" : "drb";
    item.append(text, meta);
    list.append(item);
  }

  return entries.length > 0;
}

if (typeof window !== "undefined") {
  window.EmpireRumorFeedPanel = {
    normalizeCityFeedEvent,
    normalizeCityFeedEvents,
    renderDistrictRumorFeed,
    renderRumorFeedPanel
  };
}
