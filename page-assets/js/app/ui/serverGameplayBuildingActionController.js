import {
  createBuildingSpecialActionConfirmationController
} from "../runtime/buildingSpecialActionConfirmation.js";

const SUPPORTED_BUILDING_ACTION_INPUT_IDS = new Set([
  "dealerSlotId",
  "amount",
  "targetCategory",
  "category",
  "mode",
  "investmentCleanCash",
  "investment",
  "targetZone"
]);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const resolveActionInputValues = (action = {}, payload = {}) => {
  const requestedValues = payload.inputs && typeof payload.inputs === "object"
    ? payload.inputs
    : payload;
  const values = {};
  for (const input of Array.isArray(action.requiresInput) ? action.requiresInput : []) {
    const inputId = String(input?.id || "").trim();
    const inputType = String(input?.type || "").trim();
    if (!inputId || !SUPPORTED_BUILDING_ACTION_INPUT_IDS.has(inputId)) {
      return {
        disabledReason: `Server požaduje nepodporovaný vstup ${inputId || "bez identifikátoru"}.`,
        values: {}
      };
    }
    if (!["number", "select", "text"].includes(inputType)) {
      return {
        disabledReason: `Server požaduje nepodporovaný typ vstupu ${inputType || "bez typu"}.`,
        values: {}
      };
    }
    const rawValue = hasOwn(requestedValues, inputId) ? requestedValues[inputId] : undefined;
    if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
      if (input.required === true) {
        return {
          disabledReason: `Doplň pole ${input.label || inputId}.`,
          values: {}
        };
      }
      continue;
    }
    if (inputType === "number") {
      const numberValue = Number(rawValue);
      if (!Number.isFinite(numberValue)) {
        return {
          disabledReason: `Pole ${input.label || inputId} musí být číslo.`,
          values: {}
        };
      }
      if (Number.isFinite(Number(input.min)) && numberValue < Number(input.min)) {
        return {
          disabledReason: `Pole ${input.label || inputId} musí být nejméně ${input.min}.`,
          values: {}
        };
      }
      if (Number.isFinite(Number(input.max)) && numberValue > Number(input.max)) {
        return {
          disabledReason: `Pole ${input.label || inputId} může být nejvýše ${input.max}.`,
          values: {}
        };
      }
      values[inputId] = numberValue;
      continue;
    }
    const stringValue = String(rawValue);
    if (inputType === "select") {
      const allowedValues = (Array.isArray(input.options) ? input.options : [])
        .map((option) => String(option?.value ?? ""));
      if (!allowedValues.includes(stringValue)) {
        return {
          disabledReason: `Pole ${input.label || inputId} neodpovídá serverové nabídce.`,
          values: {}
        };
      }
    }
    values[inputId] = stringValue;
  }
  return { disabledReason: "", values };
};

const formatActionInputSummary = (action = {}, values = {}) => (
  (Array.isArray(action.requiresInput) ? action.requiresInput : [])
    .filter((input) => hasOwn(values, String(input?.id || "")))
    .map((input) => {
      const inputId = String(input?.id || "");
      const value = values[inputId];
      const option = (Array.isArray(input?.options) ? input.options : [])
        .find((candidate) => String(candidate?.value ?? "") === String(value));
      return `${input?.label || inputId}: ${option?.label || value}`;
    })
    .join(" · ")
);

export function createServerGameplayBuildingActionController({
  documentRef,
  dispatchSurfaceAction
} = {}) {
  let confirmationController = null;

  const run = async ({
    shell,
    buildingId,
    detailView,
    isStillActive,
    payload = {}
  } = {}) => {
    const actionId = String(payload.actionId || "");
    const action = detailView?.actions?.find?.(
      (candidate, index) => (
        String(candidate?.actionId || "") === actionId
        && (!Number.isFinite(Number(payload.actionIndex)) || index === Number(payload.actionIndex))
      )
    ) || null;
    if (!buildingId || !action?.actionId || !shell) return null;

    const districtId = String(
      shell.dataset?.serverDistrictId
      || shell.dataset?.districtBuildingDetailDistrictId
      || ""
    );
    const resolvedInputs = resolveActionInputValues(action, payload);
    const disabledReason = String(action.disabledReason || "").trim()
      || resolvedInputs.disabledReason;
    confirmationController ||= createBuildingSpecialActionConfirmationController({
      documentRef,
      host: shell
    });
    const confirmed = await confirmationController.open({
      titleLabel: action.title || action.actionId,
      buildingLabel: detailView.name || detailView.title || "Budova",
      districtLabel: districtId,
      costSummary: action.buttonCostLabel || "",
      rewardSummary: action.rewardSummary || "Výsledek určí server.",
      inputSummary: formatActionInputSummary(action, resolvedInputs.values),
      riskSummary: Array.isArray(action.serverAction?.riskSummary)
        ? action.serverAction.riskSummary.join(" · ")
        : "",
      cooldownLabel: action.cooldownLabel || "Připraveno",
      disabledReason,
      canConfirm: !action.disabled && !disabledReason
    });
    if (!confirmed || isStillActive?.() === false) return null;

    const actionInputs = {
      ...resolvedInputs.values,
      ...(payload.itemId ? { itemId: String(payload.itemId) } : {})
    };
    return dispatchSurfaceAction?.({
      buildingActionBuildingId: buildingId,
      buildingActionDistrictId: districtId,
      buildingActionId: action.actionId,
      buildingActionInputs: actionInputs,
      ...actionInputs
    });
  };

  return {
    run,
    close: () => confirmationController?.close?.(),
    destroy: () => {
      confirmationController?.close?.();
      confirmationController = null;
    }
  };
}
