import { OVERFLOW_TEXT_TOOLTIP_SELECTOR } from "../runtime/constants.js";

export function bindOverflowTextTooltips(root) {
  let tooltip = null;
  let activeElement = null;

  const getTooltip = () => {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.className = "overflow-text-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    return tooltip;
  };

  const getTooltipText = (element) => {
    const text = String(element?.textContent || "").replace(/\s+/g, " ").trim();
    return text.length > 1 ? text : "";
  };

  const isElementTextClipped = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const text = getTooltipText(element);
    if (!text) return false;
    return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
  };

  const positionTooltip = (element) => {
    if (!tooltip || !element) return;
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - viewportPadding,
      Math.max(viewportPadding, rect.left + (rect.width - tooltipRect.width) / 2)
    );
    const preferTop = rect.top - tooltipRect.height - gap >= viewportPadding;
    const top = preferTop
      ? rect.top - tooltipRect.height - gap
      : Math.min(window.innerHeight - tooltipRect.height - viewportPadding, rect.bottom + gap);
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(Math.max(viewportPadding, top))}px`;
  };

  const hideTooltip = () => {
    activeElement = null;
    if (!tooltip) return;
    tooltip.hidden = true;
    tooltip.classList.remove("is-visible");
  };

  const showTooltip = (element) => {
    if (!isElementTextClipped(element)) {
      hideTooltip();
      return;
    }
    activeElement = element;
    const tooltipElement = getTooltip();
    tooltipElement.textContent = getTooltipText(element);
    tooltipElement.hidden = false;
    positionTooltip(element);
    tooltipElement.classList.add("is-visible");
  };

  root.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const target = event.target instanceof Element
      ? event.target.closest(OVERFLOW_TEXT_TOOLTIP_SELECTOR)
      : null;
    if (!(target instanceof HTMLElement) || !root.contains(target)) return;
    showTooltip(target);
  });

  root.addEventListener("pointerout", (event) => {
    if (!activeElement) return;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && activeElement.contains(nextTarget)) return;
    hideTooltip();
  });

  root.addEventListener("focusin", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest(OVERFLOW_TEXT_TOOLTIP_SELECTOR)
      : null;
    if (target instanceof HTMLElement && root.contains(target)) {
      showTooltip(target);
    }
  });

  root.addEventListener("focusout", hideTooltip);
  window.addEventListener("scroll", hideTooltip, { passive: true });
  window.addEventListener("resize", () => {
    if (activeElement) positionTooltip(activeElement);
  });
}
