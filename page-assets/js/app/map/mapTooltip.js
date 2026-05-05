function getOwnerDocument(element, options = {}) {
  return element?.ownerDocument || options.document || (typeof document !== "undefined" ? document : null);
}

function createElement(scopeElement, tagName, className = "") {
  const ownerDocument = getOwnerDocument(scopeElement);
  if (!ownerDocument?.createElement) {
    return null;
  }
  const element = ownerDocument.createElement(tagName);
  if (className) {
    element.className = className;
  }
  return element;
}

function safeClamp(value, min, max, clampFn) {
  if (typeof clampFn === "function") {
    return clampFn(value, min, max);
  }
  return Math.min(Math.max(value, min), max);
}

export function initMapTooltip(options = {}) {
  return {
    tooltip: options.tooltip || options.container || null,
    value: options.value || null,
    type: options.type || null,
    gossip: options.gossip || null
  };
}

export function hideDistrictTooltip(options = {}) {
  const tooltip = options.tooltip || options.container || null;
  if (tooltip) {
    tooltip.hidden = true;
  }
  options.gossip?.replaceChildren?.();
  return false;
}

export function renderDistrictTooltipGossip(gossipElement, entries = [], options = {}) {
  if (!gossipElement) {
    return false;
  }

  gossipElement.replaceChildren();

  const label = createElement(gossipElement, "div", "district-hover-tooltip__gossip-label");
  if (!label) {
    return false;
  }
  label.textContent = "Drby";
  gossipElement.append(label);

  const list = createElement(gossipElement, "div", "district-hover-tooltip__gossip-list");
  if (!list) {
    return false;
  }

  const safeEntries = Array.isArray(entries) ? entries : [];
  if (safeEntries.length <= 0) {
    const empty = createElement(gossipElement, "div", "district-hover-tooltip__gossip-empty");
    if (empty) {
      empty.textContent = options.emptyText || "Zatím bez drbů.";
      list.append(empty);
    }
  } else {
    for (const entry of safeEntries) {
      const item = createElement(gossipElement, "div", "district-hover-tooltip__gossip-item");
      const badge = createElement(gossipElement, "span", `district-hover-tooltip__gossip-badge district-hover-tooltip__gossip-badge--${entry?.intelLevel === "verified" ? "verified" : "rumor"}`);
      const text = createElement(gossipElement, "span", "district-hover-tooltip__gossip-text");
      if (!item || !badge || !text) {
        continue;
      }
      badge.textContent = entry?.intelLevel === "verified" ? "OVĚŘENO" : "DRB";
      text.textContent = entry?.text || "";
      item.append(badge, text);
      list.append(item);
    }
  }

  gossipElement.append(list);
  return true;
}

export function updateDistrictTooltipPosition(position = {}, options = {}) {
  const tooltip = options.tooltip || options.container || null;
  const viewportRect = options.viewportRect || null;
  if (!tooltip || !viewportRect) {
    return null;
  }

  const tooltipSize = options.tooltipSize || { width: 84, height: 52 };
  const pointerX = Number(position.pointerX || 0);
  const pointerY = Number(position.pointerY || 0);
  const offsetX = Number(options.offsetX || 12);
  const offsetY = Number(options.offsetY || 8);
  const preferredLeft = pointerX + offsetX;
  const fallbackLeft = pointerX - tooltipSize.width - offsetX;
  const nextLeft = safeClamp(
    preferredLeft + tooltipSize.width <= viewportRect.width - 8 ? preferredLeft : fallbackLeft,
    8,
    Math.max(8, viewportRect.width - tooltipSize.width - 8),
    options.clamp
  );
  const nextTop = safeClamp(
    pointerY - Math.round(tooltipSize.height * 0.34) + offsetY,
    8,
    Math.max(8, viewportRect.height - tooltipSize.height - 8),
    options.clamp
  );

  tooltip.style.transform = `translate(${nextLeft}px, ${nextTop}px)`;
  return { left: nextLeft, top: nextTop };
}

export function renderDistrictTooltip(viewModel = null, position = {}, options = {}) {
  const tooltip = options.tooltip || options.container || null;
  const valueElement = options.value || null;
  const typeElement = options.type || null;

  if (!tooltip || !valueElement || !typeElement || !viewModel) {
    return { visible: hideDistrictTooltip(options), tooltipSize: options.tooltipSize || { width: 84, height: 52 } };
  }

  if (options.renderContent !== false) {
    valueElement.textContent = String(viewModel.idLabel || viewModel.id || "");
    typeElement.textContent = String(viewModel.typeLabel || "");
    if (options.gossip) {
      renderDistrictTooltipGossip(options.gossip, viewModel.gossipEntries || [], options);
    }
  }

  tooltip.hidden = false;
  const tooltipSize = {
    width: tooltip.offsetWidth || options.tooltipSize?.width || 84,
    height: tooltip.offsetHeight || options.tooltipSize?.height || 52
  };
  updateDistrictTooltipPosition(position, {
    ...options,
    tooltip,
    tooltipSize
  });
  return { visible: true, tooltipSize };
}

export function destroyMapTooltip(options = {}) {
  hideDistrictTooltip(options);
  return true;
}
