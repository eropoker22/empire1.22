import { createServerGameplayCommandId } from "./serverCommandJournal.js";
import {
  getServerGameplaySliceReadModel,
  isServerGameplaySourceReady
} from "./serverGameplayReadModelSource.js";
import { submitServerGameplayCommand } from "./serverGameplayCommandTransport.js";

export function submitServerCityEventCommand({ action, id } = {}) {
  const normalizedId = String(id || "").trim();
  const command = action === "start"
    ? { type: "start-city-event", payload: { offerId: normalizedId } }
    : action === "claim"
      ? { type: "claim-city-event-reward", payload: { pendingRewardId: normalizedId } }
      : null;
  if (!command || !normalizedId) {
    return Promise.resolve({
      accepted: false,
      errors: [{ message: "Neplatná City Events akce." }]
    });
  }
  const slice = getServerGameplaySliceReadModel();
  return submitServerGameplayCommand({
    ...command,
    focusDistrictId: slice?.district?.districtId || slice?.player?.homeDistrictId
  });
}

export function submitServerEmergencyRecoveryCommand() {
  return submitServerGameplayCommand({
    type: "claim-emergency-recovery",
    payload: {},
    focusDistrictId: getServerGameplaySliceReadModel()?.player?.homeDistrictId
  });
}

export function submitServerBountyCommand({ action = "create", payload = {} } = {}) {
  if (!isServerGameplaySourceReady()) {
    return Promise.resolve({
      accepted: false,
      errors: [{ message: "Server-authoritative gameplay runtime není připravený." }]
    });
  }
  const normalizedAction = action === "cancel" ? "cancel" : "create";
  const slice = getServerGameplaySliceReadModel();
  const focusDistrictId = slice?.district?.districtId || slice?.player?.homeDistrictId || null;
  if (!slice?.player || !focusDistrictId) {
    return Promise.resolve({
      accepted: false,
      errors: [{ message: "Bounty akci nejde odeslat bez server slice kontextu." }]
    });
  }
  return submitServerGameplayCommand({
    type: normalizedAction === "cancel" ? "cancel-bounty" : "create-bounty",
    payload,
    focusDistrictId,
    commandId: createServerGameplayCommandId(
      normalizedAction === "cancel" ? "command:bounty-cancel" : "command:bounty-create"
    )
  });
}

export function submitServerAllianceCommand({ type = "", payload = {} } = {}) {
  if (!isServerGameplaySourceReady()) {
    return Promise.resolve({
      accepted: false,
      errors: [{ message: "Server-authoritative gameplay runtime není připravený." }]
    });
  }
  const slice = getServerGameplaySliceReadModel();
  const focusDistrictId = slice?.district?.districtId || slice?.player?.homeDistrictId || null;
  if (!slice?.player || !focusDistrictId) {
    return Promise.resolve({
      accepted: false,
      errors: [{ message: "Aliance akci nejde odeslat bez server slice kontextu." }]
    });
  }
  return submitServerGameplayCommand({
    type,
    payload,
    focusDistrictId,
    commandId: createServerGameplayCommandId(`command:alliance:${String(type || "action")}`)
  });
}

export function submitServerCityChatCommand({ body = "" } = {}) {
  if (!isServerGameplaySourceReady()) {
    return Promise.resolve({
      accepted: false,
      errors: [{ message: "Server-authoritative gameplay runtime není připravený." }]
    });
  }
  const slice = getServerGameplaySliceReadModel();
  const focusDistrictId = slice?.district?.districtId || slice?.player?.homeDistrictId || null;
  if (!slice?.player || !focusDistrictId) {
    return Promise.resolve({
      accepted: false,
      errors: [{ message: "Městský chat nejde odeslat bez server slice kontextu." }]
    });
  }
  return submitServerGameplayCommand({
    type: "send-city-chat-message",
    payload: { body },
    focusDistrictId,
    commandId: createServerGameplayCommandId("command:city-chat:send")
  });
}

export async function activateServerPlayerBoost(boostId) {
  const response = await submitServerGameplayCommand({
    type: "activate-player-boost",
    payload: { boostId },
    focusDistrictId: getServerGameplaySliceReadModel()?.district?.districtId
  });
  if (!response?.accepted) {
    return { ok: false, code: response?.errors?.[0]?.code || "boost_state_conflict" };
  }
  return { ok: true, server: true };
}
