function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

export function renderNoDistrictSelected(options = {}) {
  const elements = options.elements || {};
  setText(elements.title, "District");
  setText(elements.type, "Vyber district");
  setText(elements.owner, "Bez výběru");
  setText(elements.ownerMeta, "");
  if (elements.ownerAvatar) {
    elements.ownerAvatar.src = "";
    elements.ownerAvatar.classList?.add?.("is-empty");
  }
  if (elements.ownerAvatarFallback) {
    elements.ownerAvatarFallback.textContent = "?";
  }
  return true;
}

export function clearSelectedDistrictSummary(options = {}) {
  return renderNoDistrictSelected(options);
}

export function renderSelectedDistrictSummary(districtViewModel = null, options = {}) {
  const elements = options.elements || {};
  if (!districtViewModel) {
    return renderNoDistrictSelected(options);
  }

  setText(elements.title, districtViewModel.title || "District");
  setText(elements.type, districtViewModel.typeLabel || "District");
  setText(elements.owner, districtViewModel.ownerLabel || "Neznámý vlastník");
  setText(elements.ownerMeta, districtViewModel.ownerMeta || "");

  if (elements.ownerAvatar) {
    elements.ownerAvatar.src = districtViewModel.ownerAvatarSrc || "";
    elements.ownerAvatar.classList?.toggle?.("is-empty", Boolean(districtViewModel.ownerAvatarEmpty));
  }

  if (elements.ownerAvatarFallback) {
    elements.ownerAvatarFallback.textContent = String(districtViewModel.ownerFallback || "?").slice(0, 1).toUpperCase();
  }

  if (elements.card) {
    const hasOwnerAvatar = Boolean(districtViewModel.ownerAvatarBackgroundUrl);
    const safeOwnerAvatarUrl = hasOwnerAvatar
      ? `url("${String(districtViewModel.ownerAvatarBackgroundUrl).replace(/(["\\])/g, "\\$1")}")`
      : "none";
    elements.card.classList?.toggle?.("district-owner-bg-active", hasOwnerAvatar);
    elements.card.style?.setProperty?.("--district-owner-avatar-url", safeOwnerAvatarUrl);
    elements.card.style?.setProperty?.("--district-owner-avatar-opacity", hasOwnerAvatar ? "0.24" : "0");
  }

  return Boolean(
    elements.title ||
    elements.type ||
    elements.owner ||
    elements.ownerMeta ||
    elements.ownerAvatar ||
    elements.ownerAvatarFallback ||
    elements.card
  );
}
