import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";

const PAGE_SELECTOR = "[data-client-surface='game-shell']";

function initFactionActionsRuntime() {
  if (!document.querySelector(PAGE_SELECTOR)) return;

  const modal = document.getElementById("faction-actions-modal");
  const backdrop = document.getElementById("faction-actions-modal-backdrop");
  const openButtons = Array.from(document.querySelectorAll("[data-faction-actions-open-trigger]"));
  if (!modal || openButtons.length <= 0) return;

  const close = () => {
    modal.classList.add("hidden");
    modal.hidden = true;
    closeOverlay(modal, { restoreFocus: true });
  };

  const open = (event) => {
    modal.hidden = false;
    modal.classList.remove("hidden");
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: true, trigger: event?.currentTarget || null });
  };

  openButtons.forEach((button) => button.addEventListener("click", open));
  backdrop?.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) close();
  });
}

if (typeof document !== "undefined") initFactionActionsRuntime();
