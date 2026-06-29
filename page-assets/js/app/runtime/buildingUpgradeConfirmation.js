function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

export function createBuildingUpgradeConfirmationController({
  documentRef,
  host,
  variant = "production"
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
  overlay.className = `building-upgrade-confirm building-upgrade-confirm--${variant}`;
  overlay.hidden = true;

  const backdrop = documentRef.createElement("button");
  backdrop.type = "button";
  backdrop.className = "building-upgrade-confirm__backdrop";
  backdrop.setAttribute("aria-label", "Zrušit upgrade");

  const dialog = documentRef.createElement("section");
  dialog.className = "building-upgrade-confirm__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Potvrzení upgradu");

  const eyebrow = documentRef.createElement("span");
  eyebrow.className = "building-upgrade-confirm__eyebrow";
  eyebrow.textContent = "POTVRZENÍ UPGRADU";

  const title = documentRef.createElement("h4");
  title.className = "building-upgrade-confirm__title";

  const copy = documentRef.createElement("p");
  copy.className = "building-upgrade-confirm__copy";

  const grid = documentRef.createElement("div");
  grid.className = "building-upgrade-confirm__grid";

  const costCard = documentRef.createElement("article");
  costCard.className = "building-upgrade-confirm__stat building-upgrade-confirm__stat--cost";
  const costLabel = documentRef.createElement("span");
  costLabel.textContent = "Cena";
  const costValue = documentRef.createElement("strong");
  costCard.append(costLabel, costValue);

  const upgradeCard = documentRef.createElement("article");
  upgradeCard.className = "building-upgrade-confirm__stat building-upgrade-confirm__stat--level";
  const upgradeLabel = documentRef.createElement("span");
  upgradeLabel.textContent = "Upgrade";
  const upgradeValue = documentRef.createElement("strong");
  upgradeCard.append(upgradeLabel, upgradeValue);

  const benefitCard = documentRef.createElement("article");
  benefitCard.className = "building-upgrade-confirm__stat building-upgrade-confirm__stat--benefits";
  const benefitLabel = documentRef.createElement("span");
  benefitLabel.textContent = "Získáš";
  const benefitList = documentRef.createElement("div");
  benefitList.className = "building-upgrade-confirm__benefits";
  benefitCard.append(benefitLabel, benefitList);
  grid.append(costCard, upgradeCard, benefitCard);

  const note = documentRef.createElement("p");
  note.className = "building-upgrade-confirm__note building-upgrade-confirm__payment-strip";

  const actions = documentRef.createElement("div");
  actions.className = "building-upgrade-confirm__actions";

  const cancelButton = documentRef.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "building-upgrade-confirm__button building-upgrade-confirm__button--ghost";
  cancelButton.textContent = "Zpět";

  const confirmButton = documentRef.createElement("button");
  confirmButton.type = "button";
  confirmButton.className = "building-upgrade-confirm__button building-upgrade-confirm__button--confirm";
  confirmButton.textContent = "Potvrdit upgrade";

  actions.append(cancelButton, confirmButton);
  dialog.append(eyebrow, title, copy, grid, note, actions);
  overlay.append(backdrop, dialog);
  host.append(overlay);

  let currentResolve = null;

  const finalize = (result) => {
    if (!currentResolve) {
      overlay.hidden = true;
      return;
    }

    const resolve = currentResolve;
    currentResolve = null;
    overlay.hidden = true;
    resolve(result);
  };

  const update = ({
    buildingLabel = "Budova",
    canConfirm = true,
    confirmLabel = "Potvrdit upgrade",
    costLabel: nextCostLabel = "$0",
    description = "",
    noteLabel = "",
    titleLabel = "",
    benefitLabel: nextBenefitLabel = "",
    benefits = [],
    hiddenBenefitCount = 0,
    upgradeLabel: nextUpgradeLabel = ""
  } = {}) => {
    setText(title, titleLabel || `${buildingLabel} · upgrade`);
    setText(copy, description || `Opravdu chceš upgradovat ${buildingLabel.toLowerCase()}?`);
    setText(costValue, nextCostLabel);
    setText(upgradeValue, nextUpgradeLabel || "Vyšší level");
    benefitList.replaceChildren();
    const normalizedBenefits = Array.isArray(benefits) && benefits.length > 0
      ? benefits
      : nextBenefitLabel
        ? [{ icon: "+", label: "Bonus", value: nextBenefitLabel, detail: "" }]
        : [];
    for (const benefit of normalizedBenefits) {
      const row = documentRef.createElement("div");
      row.className = `building-upgrade-confirm__benefit building-upgrade-confirm__benefit--${benefit.tone || "positive"}`;
      const icon = documentRef.createElement("span");
      icon.className = "building-upgrade-confirm__benefit-icon";
      icon.textContent = benefit.icon || "+";
      const body = documentRef.createElement("span");
      body.className = "building-upgrade-confirm__benefit-body";
      const label = documentRef.createElement("span");
      label.className = "building-upgrade-confirm__benefit-label";
      label.textContent = benefit.label || "Bonus";
      const value = documentRef.createElement("strong");
      value.className = "building-upgrade-confirm__benefit-value";
      value.textContent = benefit.value || "";
      body.append(label, value);
      if (benefit.detail) {
        row.title = benefit.detail;
      }
      row.append(icon, body);
      benefitList.append(row);
    }
    if (hiddenBenefitCount > 0) {
      const more = documentRef.createElement("div");
      more.className = "building-upgrade-confirm__benefit building-upgrade-confirm__benefit--more";
      more.textContent = `+ ${hiddenBenefitCount} další bonusy v detailu`;
      benefitList.append(more);
    }
    setText(note, noteLabel);
    confirmButton.textContent = confirmLabel;
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
      overlay.hidden = false;
      return new Promise((resolve) => {
        currentResolve = resolve;
        confirmButton.focus?.();
      });
    },
    update
  };
}
