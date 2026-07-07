function setText(element, value) {
  if (element) {
    element.textContent = String(value ?? "");
  }
}

function getAvatarWrap(ownerAvatar) {
  return ownerAvatar?.parentElement || ownerAvatar?.parentNode || null;
}

function setAvatarWrapClickable(ownerAvatar, viewModel = {}) {
  const wrap = getAvatarWrap(ownerAvatar);
  if (!wrap) {
    return;
  }

  const avatarSrc = String(viewModel.ownerAvatarSrc || "").trim();
  const canOpenAvatar = Boolean(avatarSrc);
  wrap.classList?.toggle?.("is-clickable", canOpenAvatar);
  wrap.classList?.toggle?.("is-owner-hidden", Boolean(viewModel.ownerAvatarHidden));
  wrap.dataset.districtOwnerAvatarOpen = canOpenAvatar ? "true" : "false";
  wrap.dataset.districtOwnerAvatarSrc = canOpenAvatar ? avatarSrc : "";
  wrap.dataset.districtOwnerAvatarName = canOpenAvatar ? String(viewModel.ownerLabel || "Vlastník districtu").trim() : "";
  wrap.dataset.districtOwnerAvatarMeta = canOpenAvatar ? String(viewModel.ownerMeta || "").trim() : "";
  wrap.title = canOpenAvatar ? `Zvětšit avatar: ${viewModel.ownerLabel || "Vlastník districtu"}` : "";
  wrap.tabIndex = canOpenAvatar ? 0 : -1;
  wrap.setAttribute?.("role", canOpenAvatar ? "button" : "presentation");
  wrap.setAttribute?.(
    "aria-label",
    canOpenAvatar ? `Zvětšit avatar vlastníka ${viewModel.ownerLabel || "districtu"}` : "Avatar vlastníka není dostupný"
  );
  wrap.setAttribute?.("aria-disabled", canOpenAvatar ? "false" : "true");
}

function hideOwnerAvatarFallbackWhenImageExists(elements = {}, viewModel = {}) {
  if (!elements.ownerAvatarFallback) {
    return;
  }

  const hasOwnerAvatar = Boolean(String(viewModel.ownerAvatarSrc || "").trim());
  const fallback = viewModel.ownerFallback === undefined
    ? "?"
    : String(viewModel.ownerFallback || "").trim();
  const hideFallback = hasOwnerAvatar || Boolean(viewModel.ownerAvatarHidden) || !fallback;
  elements.ownerAvatarFallback.hidden = hideFallback;
  elements.ownerAvatarFallback.textContent = hideFallback
    ? ""
    : fallback.slice(0, 1).toUpperCase();
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
    setAvatarWrapClickable(elements.ownerAvatar, {});
  }
  if (elements.ownerAvatarFallback) {
    elements.ownerAvatarFallback.hidden = false;
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
    setAvatarWrapClickable(elements.ownerAvatar, districtViewModel);
  }

  if (elements.ownerAvatarFallback) {
    hideOwnerAvatarFallbackWhenImageExists(elements, districtViewModel);
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
