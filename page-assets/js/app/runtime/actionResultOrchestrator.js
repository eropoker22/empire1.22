function safeObject(value) {
  return value && typeof value === "object" ? value : {};
}

function normalizeType(value, fallback = "event") {
  return String(value || fallback).trim() || fallback;
}

export function normalizeActionResult(rawResult = {}, actionType = "") {
  const source = safeObject(rawResult);
  const type = normalizeType(actionType || source.kind || source.resultKind || source.type);
  return {
    type,
    kind: type,
    ok: source.ok !== false,
    tone: source.tone || (source.ok === false ? "warning" : "success"),
    message: String(source.message || source.summary || "").trim(),
    payload: safeObject(source.payload),
    snapshot: safeObject(source.snapshot),
    options: {
      ...safeObject(source.options),
      refresh: source.options?.refresh ?? true
    },
    refreshHints: safeObject(source.refreshHints || source.hints)
  };
}

export function getActionResultToast(result = {}) {
  const normalized = normalizeActionResult(result);
  if (!normalized.message) {
    return null;
  }

  return {
    tone: normalized.tone,
    message: normalized.message
  };
}

export function getActionResultRefreshHints(result = {}) {
  return normalizeActionResult(result).refreshHints;
}

export function handleActionSuccess(result = {}, context = {}) {
  const normalized = normalizeActionResult(result);
  const toast = getActionResultToast(normalized);
  if (toast && typeof context.showToast === "function") {
    context.showToast(toast.message, toast.tone);
  }
  if (typeof context.refreshAfterAction === "function") {
    context.refreshAfterAction(context, normalized.refreshHints);
  }
  return normalized;
}

export function handleActionError(error = null, context = {}) {
  const message = error?.message || String(error || "Akce se nepodařila.");
  const normalized = normalizeActionResult({
    ok: false,
    tone: "warning",
    message
  }, "error");
  if (typeof context.showToast === "function") {
    context.showToast(normalized.message, normalized.tone);
  }
  return normalized;
}

export const handleProductionResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "production"), context);
export const handleCraftResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "craft"), context);
export const handleMarketResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "market"), context);
export const handleSpyResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "spy"), context);
export const handleAttackResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "attack"), context);
export const handleRobberyResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "robbery"), context);
export const handleTrapResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "trap"), context);
export const handleDefenseResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "defense"), context);
export const handlePoliceResult = (result, context) => handleActionSuccess(normalizeActionResult(result, "police"), context);
