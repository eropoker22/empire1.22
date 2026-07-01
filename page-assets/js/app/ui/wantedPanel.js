function createElement(tagName, className = "") {
  const element = globalThis.document?.createElement?.(tagName);
  if (element && className) {
    element.className = className;
  }
  return element || null;
}

function formatRelativeHeatTime(createdAt, now = Date.now()) {
  const timestamp = new Date(createdAt || now).getTime();
  const diffMs = Math.max(0, now - (Number.isFinite(timestamp) ? timestamp : now));
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes <= 0) {
    return "právě teď";
  }
  if (diffMinutes < 60) {
    return `před ${diffMinutes} min`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `před ${diffHours} h`;
  }
  return `před ${Math.floor(diffHours / 24)} d`;
}

function hasPendingPoliceRaid(raid) {
  if (!raid || typeof raid !== "object") {
    return false;
  }
  const status = String(raid.status || "pending").toLowerCase();
  return Boolean(raid.raidId || raid.id) && status !== "resolved" && status !== "expired";
}

export function resolveHeatBadgePoliceThreat(heatViewModel = {}) {
  const policeFeedback = heatViewModel?.policeFeedback && typeof heatViewModel.policeFeedback === "object"
    ? heatViewModel.policeFeedback
    : {};
  const riskKey = String(
    heatViewModel?.riskKey
      || heatViewModel?.riskTier
      || heatViewModel?.policeRiskKey
      || policeFeedback.riskKey
      || policeFeedback.riskTier
      || ""
  ).toLowerCase();
  const activePoliceActionCount = Math.max(
    0,
    Number(heatViewModel?.activePoliceActionCount ?? policeFeedback.activePoliceActionCount ?? 0) || 0
  );
  return Boolean(
    heatViewModel?.policeActionThreat
      || heatViewModel?.policeActionPending
      || heatViewModel?.pendingPoliceAction
      || hasPendingPoliceRaid(heatViewModel?.pendingRaid)
      || hasPendingPoliceRaid(policeFeedback.pendingRaid)
      || activePoliceActionCount > 0
      || riskKey === "high"
      || riskKey === "extreme"
  );
}

export function renderHeatBadge(heatViewModel = {}, options = {}) {
  heatViewModel ||= {};
  options ||= {};
  const heatButton = options.heatButton || null;
  const starContainer = options.starContainer || null;
  const stars = Array.isArray(options.stars) ? options.stars : [];
  const heatValue = Number(heatViewModel.heat ?? 0);
  const levelId = Math.max(0, Number(heatViewModel.levelId || 0));
  const title = String(heatViewModel.title || "");
  const label = String(heatViewModel.label || "");
  const policeThreat = resolveHeatBadgePoliceThreat(heatViewModel);

  for (const [index, star] of stars.entries()) {
    const isActive = index < levelId;
    star?.classList?.toggle?.("is-active", isActive);
    star?.classList?.toggle?.("is-police-threat", policeThreat && isActive);
  }

  starContainer?.classList?.toggle?.("is-police-threat", policeThreat);
  starContainer?.setAttribute?.("data-police-threat", policeThreat ? "true" : "false");
  starContainer?.setAttribute?.("aria-label", `Heat ${heatValue} · ${title}${policeThreat ? " · Hrozí policejní akce" : ""}`);
  if (heatButton) {
    heatButton.textContent = String(heatValue);
    heatButton.title = `${label} • ${title}${policeThreat ? " • Hrozí policejní akce" : ""}`;
  }
}

export function renderWantedFeedback(mount, tone = "", message = "") {
  if (!mount) {
    return false;
  }

  const resolvedMessage = String(message || "").trim();
  mount.classList?.remove?.("is-warning", "is-success", "is-danger");
  mount.hidden = !resolvedMessage;
  mount.textContent = resolvedMessage;
  if (!resolvedMessage) {
    return true;
  }

  mount.classList?.add?.(
    tone === "danger" ? "is-danger" : tone === "success" ? "is-success" : "is-warning"
  );
  return true;
}

export function renderHeatJournalList(mount, entries = [], options = {}) {
  if (!mount) {
    return false;
  }

  const safeEntries = Array.isArray(entries) ? entries : [];
  const emptyText = String(options.emptyText || "Žádné záznamy.");
  const now = Number(options.now || Date.now());
  mount.replaceChildren?.();

  if (!safeEntries.length) {
    const empty = createElement("div", "wanted-popup-empty");
    if (empty) {
      empty.textContent = emptyText;
      mount.append?.(empty);
    }
    return true;
  }

  for (const entry of safeEntries) {
    const item = createElement("div", "wanted-popup-item");
    const title = createElement("strong");
    const delta = createElement("span", `wanted-popup-delta ${entry?.type === "fall" ? "is-fall" : "is-rise"}`);
    const timestamp = createElement("small");
    if (!item || !title || !delta || !timestamp) {
      continue;
    }

    title.textContent = String(entry?.reason || "");
    delta.textContent = `${entry?.type === "fall" ? "-" : "+"}${Math.max(0, Number(entry?.amount || 0))} heat`;
    timestamp.textContent = formatRelativeHeatTime(entry?.createdAt, now);
    item.append(title, delta, timestamp);
    mount.append?.(item);
  }
  return true;
}

export function renderWantedLevels(mount, levels = []) {
  if (!mount) {
    return false;
  }

  const safeLevels = Array.isArray(levels) ? levels : [];
  mount.replaceChildren?.();
  for (const tier of safeLevels) {
    const entry = createElement("div", `wanted-popup-level ${tier?.active ? "is-active" : ""}`);
    const title = createElement("strong");
    const copy = createElement("span");
    if (!entry || !title || !copy) {
      continue;
    }

    title.textContent = String(tier?.label || "");
    copy.textContent = `${tier?.title || ""} • ${tier?.effect || ""}`;
    entry.append(title, copy);
    mount.append?.(entry);
  }
  return true;
}

export function renderWantedPanel(wantedViewModel = {}, options = {}) {
  wantedViewModel ||= {};
  options ||= {};
  const mounts = options.mounts || {};
  if (!mounts || typeof mounts !== "object") {
    return false;
  }

  const heat = Number(wantedViewModel.heat ?? 0);
  if (mounts.popupHeat) mounts.popupHeat.textContent = String(heat);
  if (mounts.popupLevel) mounts.popupLevel.textContent = `${wantedViewModel.levelId || 0} / 6`;
  if (mounts.popupTier) mounts.popupTier.textContent = `${wantedViewModel.levelLabel || ""} • ${wantedViewModel.title || ""}`;
  if (mounts.popupDescription) mounts.popupDescription.textContent = String(wantedViewModel.description || "");
  if (mounts.popupProtection) mounts.popupProtection.textContent = String(wantedViewModel.protectionLabel || "");

  renderWantedLevels(mounts.popupLevels, wantedViewModel.levels);
  renderHeatJournalList(mounts.popupRiseList, wantedViewModel.riseEntries, {
    emptyText: "Zatím bez nových důvodů růstu.",
    now: wantedViewModel.now
  });
  renderHeatJournalList(mounts.popupFallList, wantedViewModel.fallEntries, {
    emptyText: "Zatím bez nových důvodů poklesu.",
    now: wantedViewModel.now
  });

  if (mounts.dirtyActionButton && "disabled" in mounts.dirtyActionButton) {
    mounts.dirtyActionButton.disabled = Boolean(wantedViewModel.dirtyActionDisabled);
  }
  if (mounts.cleanActionButton && "disabled" in mounts.cleanActionButton) {
    mounts.cleanActionButton.disabled = Boolean(wantedViewModel.cleanActionDisabled);
  }
  if (mounts.influenceActionButton && "disabled" in mounts.influenceActionButton) {
    mounts.influenceActionButton.disabled = Boolean(wantedViewModel.influenceActionDisabled);
  }

  return true;
}

if (typeof window !== "undefined") {
  window.EmpireWantedPanel = {
    renderHeatBadge,
    resolveHeatBadgePoliceThreat,
    renderHeatJournalList,
    renderWantedFeedback,
    renderWantedLevels,
    renderWantedPanel
  };
}
