const trigger = document.querySelector("[data-slice-panel-open]");
const overlay = document.querySelector("[data-game-admin-slice-overlay]");
const closeButtons = document.querySelectorAll("[data-game-admin-slice-close]");
const toolbarMount = document.querySelector("[data-game-slice-toolbar]");
const navigationMount = document.querySelector("[data-game-slice-nav]");
const filterMount = document.querySelector("[data-game-slice-filter]");
const contentMount = document.querySelector("[data-game-slice-content]");
const modalRoot = document.querySelector("[data-game-slice-modal]");
const noticeRoot = document.querySelector("[data-game-slice-notice]");
const ADMIN_SLICE_SCRIPT_SRC = "../page-assets/js/admin-assets/admin-slice-demo.js";
const DEBUG_STORAGE_KEY = "empire:debug:adminSlice";

let mountedSurface = null;

// Dev/demo bridge only. The production game page must not eagerly load the
// generated admin slice bundle; it is injected only when explicitly enabled.
const isAdminSliceDebugEnabled = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("debugSlice") === "1" || window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1";
};

const loadAdminSliceDemo = () => new Promise((resolve, reject) => {
  if (window.EmpireAdminSliceDemo?.mount) {
    resolve(window.EmpireAdminSliceDemo);
    return;
  }

  const existingScript = document.querySelector(`script[src="${ADMIN_SLICE_SCRIPT_SRC}"]`);
  if (existingScript) {
    existingScript.addEventListener("load", () => resolve(window.EmpireAdminSliceDemo), { once: true });
    existingScript.addEventListener("error", reject, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.src = ADMIN_SLICE_SCRIPT_SRC;
  script.async = true;
  script.addEventListener("load", () => resolve(window.EmpireAdminSliceDemo), { once: true });
  script.addEventListener("error", reject, { once: true });
  document.head.append(script);
});

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
  if (!isAdminSliceDebugEnabled()) {
    trigger.hidden = true;
  } else {
    trigger.hidden = false;
  }

  const openOverlay = async () => {
    if (!isAdminSliceDebugEnabled()) {
      return;
    }

    let demo = null;

    try {
      demo = await loadAdminSliceDemo();
    } catch (_error) {
      return;
    }

    if (!mountedSurface && demo?.mount) {
      mountedSurface = demo.mount({
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
