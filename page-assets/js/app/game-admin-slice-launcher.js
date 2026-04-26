const trigger = document.querySelector("[data-slice-panel-open]");
const overlay = document.querySelector("[data-game-admin-slice-overlay]");
const closeButtons = document.querySelectorAll("[data-game-admin-slice-close]");
const toolbarMount = document.querySelector("[data-game-slice-toolbar]");
const navigationMount = document.querySelector("[data-game-slice-nav]");
const filterMount = document.querySelector("[data-game-slice-filter]");
const contentMount = document.querySelector("[data-game-slice-content]");
const modalRoot = document.querySelector("[data-game-slice-modal]");
const noticeRoot = document.querySelector("[data-game-slice-notice]");

let mountedSurface = null;

if (
  trigger instanceof HTMLElement &&
  overlay instanceof HTMLElement &&
  toolbarMount instanceof HTMLElement &&
  navigationMount instanceof HTMLElement &&
  filterMount instanceof HTMLElement &&
  contentMount instanceof HTMLElement &&
  modalRoot instanceof HTMLElement &&
  noticeRoot instanceof HTMLElement
) {
  const openOverlay = () => {
    if (!mountedSurface && window.EmpireAdminSliceDemo?.mount) {
      mountedSurface = window.EmpireAdminSliceDemo.mount({
        toolbarMount,
        navigationMount,
        filterMount,
        contentMount,
        modalRoot,
        noticeRoot
      });
    }

    overlay.hidden = false;
    document.body.style.overflow = "hidden";
  };

  const closeOverlay = () => {
    overlay.hidden = true;
    document.body.style.overflow = "";
  };

  trigger.addEventListener("click", openOverlay);
  closeButtons.forEach((button) => {
    button.addEventListener("click", closeOverlay);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.hidden === false) {
      closeOverlay();
    }
  });
}
