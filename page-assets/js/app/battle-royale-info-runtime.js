import { closeOverlay, openOverlay } from "./ui/legacyOverlayCoordinator.js";

const PAGE_SELECTOR = "#game-root";
const MODAL_OPEN_CLASS = "battle-royale-info-modal-open";

function initBattleRoyaleInfoRuntime() {
  const root = document.querySelector(PAGE_SELECTOR);
  if (!root) {
    return;
  }

  const modal = document.getElementById("battle-royale-info-modal");
  const openButtons = Array.from(document.querySelectorAll("[data-br-info-open]"));
  const closeButtons = Array.from(document.querySelectorAll("[data-br-info-close]"));

  if (!modal || openButtons.length <= 0) {
    return;
  }

  const open = () => {
    modal.hidden = false;
    modal.classList.remove("hidden");
    openOverlay(modal, { type: "modal", ariaModal: true, restoreFocusOnClose: false });
    document.body?.classList.add(MODAL_OPEN_CLASS);
  };

  const close = () => {
    closeOverlay(modal, { restoreFocus: false });
    modal.classList.add("hidden");
    modal.hidden = true;
    document.body?.classList.remove(MODAL_OPEN_CLASS);
  };

  openButtons.forEach((button) => button.addEventListener("click", open));
  closeButtons.forEach((button) => button.addEventListener("click", close));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      close();
    }
  });
}

if (typeof document !== "undefined") {
  initBattleRoyaleInfoRuntime();
}
