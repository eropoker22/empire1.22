const modalStack = [];
let keydownBound = false;

const syncStack = () => {
  modalStack.forEach((entry, index) => {
    const isTop = index === modalStack.length - 1;
    entry.element.setAttribute("aria-modal", isTop ? "true" : "false");
    entry.element.toggleAttribute("data-modal-layer-active", isTop);
  });
  document.body?.classList.toggle("shared-modal-open", modalStack.length > 0);
};

const onKeydown = (event) => {
  if (event.key === "Tab" && modalStack.length > 0) {
    const top = modalStack[modalStack.length - 1].element;
    const focusable = [...top.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    if (focusable.length === 0) {
      event.preventDefault();
      top.focus?.();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (event.key !== "Escape" || modalStack.length === 0) return;
  event.preventDefault();
  closeSharedModal(modalStack[modalStack.length - 1].element, "escape");
};

export const openSharedModal = (element, options = {}) => {
  if (!element) return false;
  const existing = modalStack.find((entry) => entry.element === element);
  if (existing) closeSharedModal(element, "reopen");
  const trigger = options.trigger || document.activeElement;
  element.hidden = false;
  modalStack.push({ element, trigger, onClose: options.onClose });
  if (!keydownBound) {
    document.addEventListener("keydown", onKeydown);
    keydownBound = true;
  }
  syncStack();
  queueMicrotask(() => element.querySelector("[autofocus], button, [href], input, select, textarea, [tabindex='0']")?.focus?.());
  return true;
};

export const closeSharedModal = (element, reason = "programmatic") => {
  const index = modalStack.findIndex((entry) => entry.element === element);
  if (index < 0) return false;
  const [entry] = modalStack.splice(index, 1);
  element.hidden = true;
  element.removeAttribute("data-modal-layer-active");
  entry.onClose?.(reason);
  syncStack();
  if (modalStack.length === 0 && keydownBound) {
    document.removeEventListener("keydown", onKeydown);
    keydownBound = false;
  }
  if (reason !== "reopen" && entry.trigger?.isConnected) entry.trigger.focus?.();
  return true;
};

export const bindSharedModal = (element, options = {}) => {
  if (!element || element.dataset.sharedModalBound === "true") return;
  element.dataset.sharedModalBound = "true";
  element.addEventListener("click", (event) => {
    if (event.target.closest(options.closeSelector || "[data-shared-modal-close]")) {
      closeSharedModal(element, "close-control");
    }
  });
};

export const getSharedModalStackSize = () => modalStack.length;
