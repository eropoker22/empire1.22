export function renderFactoryDashboardPanel(elements = {}, viewModel = {}, callbacks = {}) {
  if (!elements || !viewModel) {
    return false;
  }

  if (elements.level) elements.level.textContent = viewModel.levelLabel || "1";
  if (elements.headerLevel) elements.headerLevel.textContent = viewModel.headerLevelLabel || "Lv 1";
  if (elements.multiplier) elements.multiplier.textContent = viewModel.multiplierLabel || "1.00x";
  if (elements.ownedCount) elements.ownedCount.textContent = viewModel.ownedCountLabel || "0";
  if (elements.upgradeCost) elements.upgradeCost.textContent = viewModel.upgradeCostLabel || "MAX";
  if (elements.metal) elements.metal.textContent = viewModel.resources?.metalParts || "0";
  if (elements.tech) elements.tech.textContent = viewModel.resources?.techCore || "0";
  if (elements.combat) elements.combat.textContent = viewModel.resources?.combatModule || "0";
  if (elements.supplyMetal) elements.supplyMetal.textContent = viewModel.supplies?.metalParts || "0";
  if (elements.supplyTech) elements.supplyTech.textContent = viewModel.supplies?.techCore || "0";
  if (elements.supplyCombat) elements.supplyCombat.textContent = viewModel.supplies?.combatModule || "0";
  if (elements.effectsLabel) elements.effectsLabel.textContent = viewModel.effectsLabel || "";

  if (elements.upgradeButton) {
    elements.upgradeButton.disabled = Boolean(viewModel.upgradeButton?.disabled);
    elements.upgradeButton.textContent = viewModel.upgradeButton?.text || "⇪";
    elements.upgradeButton.title = viewModel.upgradeButton?.title || "";
    elements.upgradeButton.setAttribute?.("aria-label", elements.upgradeButton.title);
  }

  if (elements.collectButton) {
    elements.collectButton.disabled = Boolean(viewModel.collectButton?.disabled);
    elements.collectButton.textContent = viewModel.collectButton?.text || "+";
    elements.collectButton.title = viewModel.collectButton?.title || "";
    elements.collectButton.setAttribute?.("aria-label", elements.collectButton.title);
  }

  callbacks.renderFactoryBuildingInfo?.(
    elements.infoPanel,
    viewModel.factoryState,
    viewModel.syncResult,
    viewModel.collectableAmount
  );
  callbacks.renderFactorySlotList?.(elements.slotList, viewModel.slots || [], {
    onPauseSlot: callbacks.onPauseSlot,
    onStartSlot: callbacks.onStartSlot
  });
  return true;
}
