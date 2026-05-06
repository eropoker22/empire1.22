export const BUILDING_ACTION_EMPTY_SNAPSHOT = Object.freeze({
  tone: "idle",
  title: "Připraveno",
  summary: "Žádné uliční zprávy. Panel čeká na další akci ve městě.",
  meta: "Čeká na první herní akci"
});

export function resolveBuildingActionTone(rawTone) {
  const tone = String(rawTone || "").trim().toLowerCase();
  if (tone === "idle" || tone === "success" || tone === "warning" || tone === "error") {
    return tone;
  }

  return "event";
}

export function resolveBuildingActionTheme(rawTone) {
  const tone = String(rawTone || "").trim().toLowerCase();

  if (
    tone.includes("fail")
    || tone.includes("disaster")
    || tone.includes("catastrophe")
    || tone.includes("trap-triggered")
  ) {
    return "negative";
  }

  if (
    tone.includes("success")
    || tone.includes("victory")
    || tone.includes("clean")
  ) {
    return "positive";
  }

  return "neutral";
}

export function normalizeBuildingActionSnapshot(snapshot) {
  const tone = resolveBuildingActionTone(snapshot?.tone);
  const title = String(snapshot?.title || "").trim();
  const summary = String(snapshot?.summary || "").trim();
  const meta = String(snapshot?.meta || "").trim();
  const resultKind = String(snapshot?.resultKind || "").trim();
  const resultPayload = snapshot?.resultPayload && typeof snapshot.resultPayload === "object"
    ? snapshot.resultPayload
    : null;

  return {
    tone,
    title: title || (tone === "idle" ? BUILDING_ACTION_EMPTY_SNAPSHOT.title : "Uliční zpráva"),
    summary: summary || (tone === "idle" ? BUILDING_ACTION_EMPTY_SNAPSHOT.summary : "Bez detailu."),
    meta: meta || (tone === "idle" ? BUILDING_ACTION_EMPTY_SNAPSHOT.meta : ""),
    resultKind,
    resultPayload
  };
}

export function createBuildingActionFingerprint(snapshot) {
  const normalizedSnapshot = normalizeBuildingActionSnapshot(snapshot);
  return [
    normalizedSnapshot.tone,
    normalizedSnapshot.title,
    normalizedSnapshot.summary,
    normalizedSnapshot.meta
  ].join("::");
}

export function formatBuildingActionTimestamp(timestampMs) {
  return new Date(timestampMs).toLocaleTimeString("sk-SK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function createBuildingActionEntry(snapshot) {
  const normalizedSnapshot = normalizeBuildingActionSnapshot(snapshot);
  const timestampMs = Number.isFinite(Number(snapshot?.timestampMs))
    ? Number(snapshot.timestampMs)
    : Date.now();

  return {
    ...normalizedSnapshot,
    id: String(snapshot?.id || `street-news-${timestampMs}-${Math.random().toString(36).slice(2, 8)}`),
    timestampMs,
    timeLabel: formatBuildingActionTimestamp(timestampMs)
  };
}

const TRASH_ICON_SVG = `
  <span class="building-action-status__trash-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M4 7h16"></path>
      <path d="M9 7V4h6v3"></path>
      <path d="M7 7l1 13h8l1-13"></path>
      <path d="M10 11v5"></path>
      <path d="M14 11v5"></path>
    </svg>
  </span>
`;

export function createBuildingActionFeedItemElement(documentRef, entry, options = {}) {
  const ownerDocument = documentRef && typeof documentRef.createElement === "function"
    ? documentRef
    : (typeof document !== "undefined" ? document : null);

  if (!ownerDocument) {
    return null;
  }

  const removeSelector = String(options.removeSelector || "[data-building-action-remove]");
  const onOpenResult = typeof options.onOpenResult === "function"
    ? options.onOpenResult
    : null;
  const item = ownerDocument.createElement("article");
  item.className = `building-action-status__item building-action-status__item--${entry.tone} building-action-status__item--${resolveBuildingActionTheme(entry.resultPayload?.tone || entry.tone)}`;
  item.dataset.buildingActionId = entry.id;

  if (entry.resultKind) {
    item.classList.add("building-action-status__item--clickable");
    item.dataset.buildingActionResultKind = entry.resultKind;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Otevřít detail zprávy ${entry.title}`);
  }

  item.addEventListener("click", (event) => {
    if (!event.target || typeof event.target.closest !== "function") {
      return;
    }

    if (event.target.closest(removeSelector)) {
      return;
    }

    if (!entry.resultKind || !entry.resultPayload || !onOpenResult) {
      return;
    }

    onOpenResult(entry);
  });

  item.addEventListener("keydown", (event) => {
    if (!entry.resultKind || !entry.resultPayload || !onOpenResult) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onOpenResult(entry);
  });

  const head = ownerDocument.createElement("div");
  head.className = "building-action-status__item-head";

  const title = ownerDocument.createElement("strong");
  title.className = "building-action-status__item-title";
  title.textContent = entry.title;
  head.append(title);

  const controls = ownerDocument.createElement("div");
  controls.className = "building-action-status__item-controls";

  const removeButton = ownerDocument.createElement("button");
  removeButton.type = "button";
  removeButton.className = "button building-action-status__item-delete";
  removeButton.dataset.buildingActionRemove = entry.id;
  removeButton.setAttribute("aria-label", `Smazat zprávu ${entry.title}`);
  removeButton.innerHTML = TRASH_ICON_SVG;
  controls.append(removeButton);

  head.append(controls);
  item.append(head);

  const summary = ownerDocument.createElement("p");
  summary.className = "building-action-status__item-summary";
  summary.textContent = entry.summary;
  item.append(summary);

  if (entry.meta) {
    const meta = ownerDocument.createElement("p");
    meta.className = "building-action-status__item-meta";
    meta.textContent = entry.meta;
    item.append(meta);
  }

  return item;
}
