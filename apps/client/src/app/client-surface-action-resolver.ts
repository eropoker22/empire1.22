import type {
  ClientSurfaceAction,
  ClientSurfaceActionElement
} from "./client-surface-action-types";

export const resolveClientSurfaceAction = (
  target: ClientSurfaceActionElement | null
): ClientSurfaceAction | null => {
  if (!target) {
    return null;
  }

  const districtButton = target.closest<ClientSurfaceActionElement>("button[data-district-id]");
  if (districtButton?.dataset.districtId) {
    return { kind: "select-district", districtId: districtButton.dataset.districtId };
  }

  const attackButton = target.closest<ClientSurfaceActionElement>("button[data-attack-target-id]");
  if (attackButton?.dataset.attackTargetId) {
    return { kind: "attack", targetDistrictId: attackButton.dataset.attackTargetId };
  }

  const spyButton = target.closest<ClientSurfaceActionElement>("button[data-spy-target-id]");
  if (spyButton?.dataset.spyTargetId) {
    return { kind: "spy", targetDistrictId: spyButton.dataset.spyTargetId };
  }

  const occupyButton = target.closest<ClientSurfaceActionElement>("button[data-occupy-target-id]");
  if (occupyButton?.dataset.occupyTargetId) {
    return { kind: "occupy", targetDistrictId: occupyButton.dataset.occupyTargetId };
  }

  const trapButton = target.closest<ClientSurfaceActionElement>("button[data-place-trap]");
  if (trapButton) return { kind: "place-trap" };

  const collectButton = target.closest<ClientSurfaceActionElement>("button[data-collect-building-id]");
  if (collectButton?.dataset.collectBuildingId) {
    return { kind: "collect", buildingId: collectButton.dataset.collectBuildingId };
  }

  const buildingAction = resolveBuildingAction(target);
  if (buildingAction) return buildingAction;

  const craftButton = target.closest<ClientSurfaceActionElement>(
    "button[data-craft-building-id][data-craft-recipe-id]"
  );
  if (craftButton?.dataset.craftBuildingId && craftButton?.dataset.craftRecipeId) {
    return {
      kind: "craft",
      buildingId: craftButton.dataset.craftBuildingId,
      recipeId: craftButton.dataset.craftRecipeId
    };
  }

  const buildingCard = target.closest<ClientSurfaceActionElement>("article[data-building-id][data-building-type]");
  return buildingCard?.dataset.buildingId
    ? { kind: "open-building", buildingId: buildingCard.dataset.buildingId }
    : null;
};

const resolveBuildingAction = (
  target: ClientSurfaceActionElement
): ClientSurfaceAction | null => {
  const button = target.closest<ClientSurfaceActionElement>(
    "button[data-building-action-building-id][data-building-action-id]"
  );
  if (!button?.dataset.buildingActionBuildingId || !button?.dataset.buildingActionId) {
    return null;
  }

  const card = button.closest<ClientSurfaceActionElement>("article[data-building-id][data-building-type]");
  const controls = button.closest<ClientSurfaceActionElement>("[data-building-action-controls]");
  const inputScope = controls ?? card;
  const slotInput = inputScope?.querySelector?.("select[data-dealer-slot-input]");
  const itemInput = inputScope?.querySelector?.("select[data-dealer-item-input]");
  const amountInput = inputScope?.querySelector?.("input[data-dealer-amount-input]");
  const inputValues = collectBuildingActionInputValues(inputScope);
  const amount = Number(amountInput?.value || amountInput?.dataset.value || amountInput?.dataset.dealerAmountValue || "");

  return {
    kind: "building-action",
    buildingId: button.dataset.buildingActionBuildingId,
    actionId: button.dataset.buildingActionId,
    dealerSlotId: button.dataset.dealerSlotId || slotInput?.value || slotInput?.dataset.value,
    itemId: button.dataset.dealerItemId || itemInput?.value || itemInput?.dataset.value,
    amount: Number.isFinite(amount) && amount > 0 ? amount : readNumberInput(inputValues, "amount"),
    ...inputValues
  };
};

const collectBuildingActionInputValues = (
  buildingCard: ClientSurfaceActionElement | null | undefined
): Record<string, string | number | undefined> => {
  const inputIds = [
    "targetCategory",
    "category",
    "mode",
    "investmentCleanCash",
    "investment",
    "targetZone",
    "amount"
  ];

  return Object.fromEntries(inputIds.map((inputId) => {
    const element = buildingCard?.querySelector?.(`[data-building-action-input="${inputId}"]`);
    const value = element?.value || element?.dataset.value;
    const parsed = ["amount", "investment", "investmentCleanCash"].includes(inputId)
      ? toPositiveNumber(value)
      : value;
    return [inputId, parsed || undefined];
  }));
};

const readNumberInput = (values: Record<string, string | number | undefined>, key: string): number | undefined => {
  const value = values[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
};

const toPositiveNumber = (value: string | undefined): number | undefined => {
  const parsed = Number(value || "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};
