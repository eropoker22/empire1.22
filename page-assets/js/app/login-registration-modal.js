const FOCUSABLE_SELECTOR = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export const bindLoginRegistrationModal = ({ root = document, onOpen } = {}) => {
  const overlay = root.querySelector("[data-login-registration-overlay]");
  if (!(overlay instanceof HTMLElement)) return null;
  if (overlay.__loginRegistrationController) return overlay.__loginRegistrationController;
  const dialog = overlay.querySelector("[role='dialog']");
  if (!(dialog instanceof HTMLElement)) return null;
  let restoreFocus = null;

  const close = () => {
    if (overlay.hidden) return;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    root.body?.classList.remove("login-registration-open");
    restoreFocus?.focus?.();
  };

  const open = (trigger = null) => {
    restoreFocus = trigger || root.activeElement;
    onOpen?.();
    overlay.hidden = false;
    overlay.removeAttribute("aria-hidden");
    root.body?.classList.add("login-registration-open");
    const target = dialog.querySelector("input:not([disabled])") || dialog;
    target.focus();
  };

  root.querySelectorAll("[data-login-registration-open]").forEach((trigger) => {
    trigger.addEventListener("click", () => open(trigger));
  });
  overlay.querySelectorAll("[data-login-registration-close]").forEach((trigger) => trigger.addEventListener("click", close));
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    trapFocus(event, dialog);
  });

  const controller = Object.freeze({ open, close });
  overlay.__loginRegistrationController = controller;
  return controller;
};

const trapFocus = (event, dialog) => {
  if (event.key !== "Tab") return;
  const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)]
    .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && dialog.ownerDocument.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && dialog.ownerDocument.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
