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
  const intelTypeValue = event.intelType || event.payload?.intelType;
  const intelType = ["confirmed_event", "rumor", "suspicion", "scandal", "warning", "false_lead"].includes(String(intelTypeValue))
    ? String(intelTypeValue)
    : truthiness === "confirmed"
      ? "confirmed_event"
      : truthiness === "false_possible"
        ? "suspicion"
        : "rumor";
  const sourceEventId = safeText(event.sourceEventId || event.actionResultId || event.raidId || event.battleReportId || event.id);

  return {
    id: safeText(event.id, `city-feed:${sourceType}:${sourceEventId || timestampMs}`),
    sourceEventId,
    sourceType,
    category,
    severity,
    truthiness,
    intelType,
    visibility: safeText(event.visibility, "all"),
    playerId: safeText(event.playerId),
    targetPlayerId: safeText(event.targetPlayerId),
    districtId: safeText(event.districtId || event.targetDistrictId),
    zone: safeText(event.zone),
    createdAtTick,
    timestampMs,
    expiresAtTick: Math.max(0, Number(event.expiresAtTick ?? 0) || 0),
    freshness: safeText(event.freshness),
    priority: Math.max(0, Number(event.priority ?? 0) || 0),
    audience: safeText(event.audience),
    confidence: safeText(event.confidence),
    rumorCategory: safeText(event.rumorCategory),
    templateId: safeText(event.templateId),
    sourceBuildingType: safeText(event.sourceBuildingType),
    message: safeText(event.message || event.summary, "Město zachytilo nejasný pohyb v ulicích."),
    messageKey: safeText(event.messageKey),
    payload: event.payload && typeof event.payload === "object" ? event.payload : {}
  };
}

export function getCityFeedBadge(event = {}) {
  if (safeText(event.freshness) === "stale") {
    return { label: "Zastaralé", level: "stale" };
  }
  if (safeText(event.rumorCategory) === "atmosphere" || safeText(event.category) === "atmosphere") {
    return { label: "Hlas ulice", level: "atmosphere" };
  }
  const confidence = safeText(event.confidence);
  if (confidence === "confirmed") return { label: "Potvrzené", level: "verified" };
  if (confidence === "credible") return { label: "Důvěryhodný drb", level: "credible" };
  if (confidence === "suspicion") return { label: "Podezření", level: "suspicion" };
  if (confidence === "rumor") return { label: "Nepotvrzená fáma", level: "rumor" };
  if (confidence === "false_possible") return { label: "Pochybný zdroj", level: "suspicion" };
  const truthiness = safeText(event.truthiness, "unconfirmed");
  const intelType = safeText(event.intelType || event.payload?.intelType, truthiness === "confirmed" ? "confirmed_event" : "rumor");
  if (truthiness === "confirmed" || intelType === "confirmed_event") {
    return { label: "Potvrzené", level: "verified" };
  }
  if (truthiness === "false_possible" || intelType === "suspicion" || intelType === "false_lead") {
    return { label: truthiness === "false_possible" ? "Pochybný zdroj" : "Podezření", level: "suspicion" };
  }
  if (intelType === "scandal") {
    return { label: "Nepotvrzená fáma", level: "rumor" };
  }
  if (intelType === "warning") {
    return { label: "Podezření", level: "suspicion" };
  }
  return { label: "Nepotvrzená fáma", level: "rumor" };
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
    .sort((left, right) => right.priority - left.priority || right.createdAtTick - left.createdAtTick || left.id.localeCompare(right.id));
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
    const badge = getCityFeedBadge(event);
    const meta = createElement(ownerDocument, "span", `district-popup-gossip__badge district-popup-gossip__badge--${badge.level}`);
    if (!item || !text || !meta) continue;
    text.textContent = event.message;
    meta.textContent = badge.label;
    item.append(text, meta);
    list.append(item);
  }

  return entries.length > 0;
}

if (typeof window !== "undefined") {
  window.EmpireRumorFeedPanel = {
    normalizeCityFeedEvent,
    normalizeCityFeedEvents,
    getCityFeedBadge,
    renderDistrictRumorFeed
  };
}
