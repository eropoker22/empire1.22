import { createServerBuildingActionDefaultPayload } from "./buildingSpecialActionServerDefaults.js";
import { FREE_GAMEPLAY_TICK_MS } from "../../../../packages/game-config/src/legacy-page/economy-config.js";

export function resolveServerDistrictIdFromBuildingContext(context = {}) {
  const rawId = context?.serverDistrictId
    || context?.district?.serverDistrictId
    || context?.district?.districtId
    || context?.district?.id
    || "";
  const text = String(rawId || "").trim();
  if (!text) return "";
  return text.startsWith("district:") ? text : `district:${text}`;
}

export function normalizeServerBuildingTypeId(value = "") {
  return String(value || "").trim().replace(/-/g, "_");
}

export function formatServerBuildingActionDisabledReason(actionView, deps = {}) {
  const cooldownTicks = Math.max(0, Math.floor(Number(actionView?.cooldownRemainingTicks || 0)));
  if (cooldownTicks > 0) {
    const formatCooldown = deps.formatCooldown || ((ms) => `${ms}ms`);
    const tickRateMs = Math.max(1, Number(deps.tickRateMs || FREE_GAMEPLAY_TICK_MS));
    return `Akce čeká ${formatCooldown(cooldownTicks * tickRateMs)}.`;
  }
  return String(actionView?.disabledReason || "").trim();
}

export function createServerBuildingActionPayload(target, definition, actionProfile = {}, actionInput = {}) {
  const actionPayload = {
    districtId: target.districtId,
    buildingId: target.buildingId,
    actionId: definition.actionId,
    ...createServerBuildingActionDefaultPayload(definition.actionId, actionProfile)
  };

  for (const key of [
    "dealerSlotId",
    "slotId",
    "itemId",
    "targetCategory",
    "category",
    "mode",
    "targetDistrictId",
    "targetZone"
  ]) {
    const value = String(actionInput?.[key] ?? "").trim();
    if (value) actionPayload[key] = value;
  }

  for (const key of ["amount", "investmentCleanCash", "investment"]) {
    const value = Number(actionInput?.[key]);
    if (Number.isFinite(value)) actionPayload[key] = value;
  }

  if (definition.actionId === "start_drug_sale") {
    const slotId = String(actionPayload.dealerSlotId || actionPayload.slotId || "");
    if (slotId) {
      actionPayload.dealerSlotId = slotId;
      actionPayload.slotId = slotId;
    }
  }

  return actionPayload;
}

export function findServerBuildingActionTarget(readModel, context, definition) {
  const districtId = resolveServerDistrictIdFromBuildingContext(context);
  if (!districtId) {
    return { ok: false, message: "Chybí server district id pro spuštění akce." };
  }

  const district = readModel?.district || null;
  if (!district || district.districtId !== districtId) {
    return { ok: false, message: "Server nevrátil detail vybraného districtu." };
  }

  const expectedBuildingId = String(context?.serverBuildingId || "").trim();
  const expectedType = normalizeServerBuildingTypeId(
    context?.serverBuildingTypeId || definition?.buildingTypeId
  );
  const building = expectedBuildingId
    ? (district.buildings || []).find(
        (candidate) => String(candidate?.buildingId || "") === expectedBuildingId
      )
    : (district.buildings || []).find((candidate) =>
        normalizeServerBuildingTypeId(candidate?.buildingTypeId) === expectedType
          && Array.isArray(candidate?.actions)
          && candidate.actions.some((action) => action?.actionId === definition.actionId)
      ) || (district.buildings || []).find((candidate) =>
        normalizeServerBuildingTypeId(candidate?.buildingTypeId) === expectedType
      );

  if (
    !building?.buildingId
    || (expectedType && normalizeServerBuildingTypeId(building.buildingTypeId) !== expectedType)
  ) {
    return { ok: false, message: "Server v districtu nenašel odpovídající budovu." };
  }

  const actionView = (building.actions || []).find((action) => action?.actionId === definition.actionId) || null;
  if (!actionView) {
    return { ok: false, message: "Server v budově nenašel tuhle akci." };
  }

  return {
    ok: true,
    districtId,
    buildingId: building.buildingId,
    building,
    actionView
  };
}

export async function resolveServerBuildingActionTarget(context, definition, deps = {}) {
  const districtId = resolveServerDistrictIdFromBuildingContext(context);
  if (!districtId) {
    return { ok: false, message: "Chybí server district id pro spuštění akce." };
  }

  const loadResponse = await deps.loadSliceForDistrict?.(districtId, { forceRefresh: true });
  if (!loadResponse?.accepted && !loadResponse?.readModel) {
    return {
      ok: false,
      message: loadResponse?.errors?.[0]?.message || "Server district detail nejde načíst."
    };
  }

  return findServerBuildingActionTarget(deps.getSlice?.() || loadResponse.readModel || null, context, definition);
}

export async function submitServerBuildingActionCommandBridge({ context, actionProfile, definition, actionInput } = {}, deps = {}) {
  if (!deps.isReady?.()) {
    return {
      accepted: false,
      errors: [{ message: "Serverový herní stav ještě není načtený. Zkus akci potvrdit za chvíli." }]
    };
  }

  const target = await resolveServerBuildingActionTarget(context, definition, deps);
  if (!target.ok) {
    return {
      accepted: false,
      errors: [{ message: target.message }]
    };
  }

  const disabledReason = formatServerBuildingActionDisabledReason(target.actionView, {
    formatCooldown: deps.formatCooldown,
    tickRateMs: deps.getSlice?.()?.mode?.tickRateMs
  });
  if (!target.actionView.enabled || disabledReason) {
    return {
      accepted: false,
      errors: [{ message: disabledReason || "Server akci teď nepovoluje." }]
    };
  }

  if (typeof deps.submitCommand !== "function") {
    return {
      accepted: false,
      errors: [{ message: "Serverový command transport není připojený." }]
    };
  }
  return deps.submitCommand({
    type: "run-building-action",
    payload: createServerBuildingActionPayload(target, definition, actionProfile, actionInput),
    focusDistrictId: target.districtId
  });
}
