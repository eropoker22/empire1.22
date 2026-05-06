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
    renderDistrictRumorFeed
  };
}
