import { formatCssUrlValue } from "../runtime/utils.js";

function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

function setStyle(element, property, value) {
  if (typeof element?.style?.setProperty === "function") {
    element.style.setProperty(property, String(value));
  }
}

function removeAttribute(element, name) {
  if (typeof element?.removeAttribute === "function") {
    element.removeAttribute(name);
  }
}

function setDatasetValue(element, key, value) {
  if (element?.dataset) {
    element.dataset[key] = String(value);
  }
}

function deleteDatasetValue(element, key) {
  if (element?.dataset) {
    delete element.dataset[key];
  }
}

function isImageLike(element) {
  if (!element) {
    return false;
  }

  if (typeof HTMLImageElement !== "undefined" && element instanceof HTMLImageElement) {
    return true;
  }

  return String(element.tagName || "").toUpperCase() === "IMG";
}

export function renderPlayerProfilePanel(elements = {}, view = {}) {
  const identityLabel = String(view.identityLabel || "Host");
  const factionId = String(view.factionId || "mafian");
  const accentColor = String(view.accentColor || "#22d3ee");
  const accentRgb = String(view.accentRgb || "");
  const avatarSrc = String(view.avatarSrc || "").trim();
  const fallbackLabel = String(view.avatarFallback || identityLabel || "?").slice(0, 1).toUpperCase() || "?";

  if (avatarSrc) {
    setDatasetValue(elements.card, "playerAvatarBg", "ready");
    setStyle(elements.card, "--player-popup-avatar-url", formatCssUrlValue(avatarSrc));
    setStyle(elements.card, "--player-popup-avatar-opacity", "1");
    if (isImageLike(elements.avatar)) {
      elements.avatar.src = avatarSrc;
      elements.avatar.classList?.remove?.("is-empty");
    }
  } else {
    deleteDatasetValue(elements.card, "playerAvatarBg");
    setStyle(elements.card, "--player-popup-avatar-url", "none");
    setStyle(elements.card, "--player-popup-avatar-opacity", "0");
    if (isImageLike(elements.avatar)) {
      removeAttribute(elements.avatar, "src");
      elements.avatar.classList?.add?.("is-empty");
    }
  }

  setText(elements.avatarFallback, fallbackLabel);
  setStyle(elements.card, "--player-popup-border-color", accentColor);
  setStyle(elements.openButton, "--player-profile-accent", accentColor);
  setStyle(elements.openButton, "--player-profile-accent-rgb", accentRgb);
  setStyle(elements.openButton, "--player-profile-accent-rgb-soft", accentRgb);
  setDatasetValue(elements.openButton, "playerFaction", factionId);

  setText(elements.name, identityLabel);
  setText(elements.identity, identityLabel);
  setText(elements.faction, view.factionLabel || "-");
  setText(elements.server, view.serverLabel || "-");
  setText(elements.startDistrict, view.startDistrictLabel || "-");
  setText(elements.cleanMoney, view.cleanMoneyLabel || "$0");
  setText(elements.dirtyMoney, view.dirtyMoneyLabel || "$0");
  setText(elements.influence, view.influenceLabel ?? "0");
  setText(elements.gang, view.gangLabel || "Guest Crew");
  setText(elements.alliance, view.allianceLabel || "Žádná");
  setText(elements.districts, view.districtCountLabel ?? "0");
  setText(elements.heat, view.heatLabel ?? "0");
  setText(elements.protection, view.protectionLabel || "Bez ochrany");

  return true;
}
