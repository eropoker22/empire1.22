import { createServerBuildingActionDefaultPayload } from "./buildingSpecialActionServerDefaults.js";

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
    return `Akce čeká ${formatCooldown(cooldownTicks * 5000)}.`;
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
  if (definition.actionId === "start_drug_sale") {
    const fallbackSlotId = String(actionPayload.dealerSlotId || actionPayload.slotId || "");
    const fallbackItemId = String(actionPayload.itemId || "");
    const fallbackAmount = Number(actionPayload.amount);
    const requestedAmount = Number(actionInput.amount);
    return {
      ...actionPayload,
      dealerSlotId: String(actionInput.dealerSlotId || actionInput.slotId || fallbackSlotId),
      itemId: String(actionInput.itemId || fallbackItemId),
      amount: Number.isInteger(requestedAmount) && requestedAmount > 0 ? requestedAmount : fallbackAmount
    };
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

  const expectedType = normalizeServerBuildingTypeId(definition?.buildingTypeId);
  const building = (district.buildings || []).find((candidate) =>
    normalizeServerBuildingTypeId(candidate?.buildingTypeId) === expectedType
      && Array.isArray(candidate?.actions)
      && candidate.actions.some((action) => action?.actionId === definition.actionId)
  ) || (district.buildings || []).find((candidate) =>
    normalizeServerBuildingTypeId(candidate?.buildingTypeId) === expectedType
  );

  if (!building?.buildingId) {
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

  const loadResponse = await deps.loadSliceForDistrict?.(districtId);
  if (!loadResponse?.accepted && !loadResponse?.readModel) {
    return {
      ok: false,
      message: loadResponse?.errors?.[0]?.message || "Server district detail nejde načíst."
    };
  }

  return findServerBuildingActionTarget(deps.getSlice?.() || loadResponse.readModel || null, context, definition);
}

export function createServerBuildingActionSubmitRequest({
  slice,
  target,
  definition,
  actionProfile = {},
  actionInput = {},
  commandId,
  issuedAt = new Date().toISOString()
} = {}) {
  const player = slice?.player || null;
  if (!slice || !player?.playerId || !player?.instanceId) {
    return null;
  }

  return {
    command: {
      id: commandId,
      type: "run-building-action",
      mode: player.mode || slice.mode?.mode || "free",
      playerId: player.playerId,
      serverInstanceId: player.instanceId,
      issuedAt,
      payload: createServerBuildingActionPayload(target, definition, actionProfile, actionInput),
      clientRequestId: null
    },
    focusDistrictId: target.districtId,
    expectedStateVersion: slice.server?.stateVersion ?? null
  };
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
    formatCooldown: deps.formatCooldown
  });
  if (!target.actionView.enabled || disabledReason) {
    return {
      accepted: false,
      errors: [{ message: disabledReason || "Server akci teď nepovoluje." }]
    };
  }

  const slice = deps.getSlice?.() || null;
  const request = createServerBuildingActionSubmitRequest({
    slice,
    target,
    definition,
    actionProfile,
    actionInput,
    commandId: deps.createCommandId?.("command:building-action") || `command:building-action:${Date.now()}`,
    issuedAt: deps.nowIso?.() || new Date().toISOString()
  });
  if (!request) {
    return {
      accepted: false,
      errors: [{ message: "Server slice kontext není připravený." }]
    };
  }

  const player = slice.player;
  const snapshotToken = deps.getSnapshotToken?.(player.instanceId, player.playerId);
  if (snapshotToken) {
    request.snapshotToken = snapshotToken;
  }

  const response = await deps.fetchJson?.(`${deps.getEndpointBase?.() || "/api/gameplay-slice"}/submit`, request);
  deps.syncResponse?.(response);
  return response;
}
