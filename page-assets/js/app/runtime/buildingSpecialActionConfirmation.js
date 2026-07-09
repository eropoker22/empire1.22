import { closeOverlay, openOverlay } from "../ui/legacyOverlayCoordinator.js";

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function focusWithoutScroll(element) {
  if (!element || typeof element.focus !== "function") {
    return false;
  }
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
  return true;
}

function createInfoRow(documentRef, label) {
  const row = documentRef.createElement("article");
  row.className = "building-special-action-confirm__stat";
  const rowLabel = documentRef.createElement("span");
  const rowValue = documentRef.createElement("strong");
  rowLabel.textContent = label;
  row.append(rowLabel, rowValue);
  return { row, value: rowValue };
}

export function createBuildingSpecialActionConfirmationController({
  documentRef,
  host
} = {}) {
  if (!documentRef || !host || typeof documentRef.createElement !== "function") {
    return {
      close: () => {},
      isOpen: () => false,
      open: async () => true,
      update: () => {}
    };
  }

  const overlay = documentRef.createElement("div");
  overlay.className = "building-special-action-confirm";
  overlay.hidden = true;

  const backdrop = documentRef.createElement("button");
  backdrop.type = "button";
  backdrop.className = "building-special-action-confirm__backdrop";
  backdrop.setAttribute("aria-label", "Zrušit akci");

  const dialog = documentRef.createElement("section");
  dialog.className = "building-special-action-confirm__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Potvrzení speciální akce");

  const eyebrow = documentRef.createElement("span");
  eyebrow.className = "building-special-action-confirm__eyebrow";
  eyebrow.textContent = "Speciální akce";

  const title = documentRef.createElement("h4");
  title.className = "building-special-action-confirm__title";

  const meta = documentRef.createElement("p");
  meta.className = "building-special-action-confirm__meta";

  const copy = documentRef.createElement("p");
  copy.className = "building-special-action-confirm__copy";

  const grid = documentRef.createElement("div");
  grid.className = "building-special-action-confirm__grid";
  const cost = createInfoRow(documentRef, "Cena");
  const reward = createInfoRow(documentRef, "Efekt");
  const input = createInfoRow(documentRef, "Volba");
  const risk = createInfoRow(documentRef, "Riziko");
  const cooldown = createInfoRow(documentRef, "Čekání");
  grid.append(cost.row, reward.row, input.row, risk.row, cooldown.row);

  const reason = documentRef.createElement("p");
  reason.className = "building-special-action-confirm__reason";

  const actions = documentRef.createElement("div");
  actions.className = "building-special-action-confirm__actions";

  const cancelButton = documentRef.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "building-special-action-confirm__button building-special-action-confirm__button--ghost";
  cancelButton.textContent = "Zrušit";

  const confirmButton = documentRef.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "building-special-action-confirm__button building-special-action-confirm__button--confirm";
  confirmButton.textContent = "Potvrdit akci";

  actions.append(cancelButton, confirmButton);
  dialog.append(eyebrow, title, meta, copy, grid, reason, actions);
  overlay.append(backdrop, dialog);
  host.append(overlay);

  let currentResolve = null;

  const finalize = (result) => {
    if (!currentResolve) {
      overlay.hidden = true;
      closeOverlay(overlay, { restoreFocus: false });
      return;
    }
    const resolve = currentResolve;
    currentResolve = null;
    overlay.hidden = true;
    closeOverlay(overlay, { restoreFocus: false });
    resolve(result);
  };

  const onKeydown = (event) => {
    if (event.key === "Escape" && currentResolve) {
      event.preventDefault();
      finalize(false);
    }
  };

  const update = ({
    titleLabel = "Potvrdit akci",
    buildingLabel = "Budova",
    districtLabel = "",
    description = "",
    costSummary = "Bez ceny",
    rewardSummary = "Efekt podle akce",
    inputSummary = "",
    riskSummary = "Bez přímého heat rizika",
    cooldownLabel = "Připraveno",
    disabledReason = "",
    canConfirm = true
  } = {}) => {
    setText(title, titleLabel);
    setText(meta, [buildingLabel, districtLabel].filter(Boolean).join(" · "));
    setText(copy, description || "Potvrď spuštění speciální akce.");
    setText(cost.value, costSummary);
    setText(reward.value, rewardSummary);
    setText(input.value, inputSummary);
    input.row.hidden = !inputSummary;
    setText(risk.value, riskSummary);
    setText(cooldown.value, cooldownLabel);
    setText(reason, disabledReason);
    reason.hidden = !disabledReason;
    confirmButton.disabled = !canConfirm;
  };

  backdrop.addEventListener("click", () => finalize(false));
  cancelButton.addEventListener("click", () => finalize(false));
  confirmButton.addEventListener("click", () => finalize(true));

  return {
    close: () => finalize(false),
    isOpen: () => currentResolve !== null,
    open: (payload = {}) => {
      if (currentResolve) {
        finalize(false);
      }
      update(payload);
      openOverlay(overlay, {
        type: "modal",
        ariaModal: true,
        focusTarget: payload.canConfirm === false ? cancelButton : confirmButton,
        restoreFocusOnClose: false
      });
      overlay.hidden = false;
      documentRef.addEventListener("keydown", onKeydown, { once: false });
      return new Promise((resolve) => {
        currentResolve = (result) => {
          documentRef.removeEventListener("keydown", onKeydown);
          resolve(result);
        };
        focusWithoutScroll(payload.canConfirm === false ? cancelButton : confirmButton);
      });
    },
    update
  };
}
