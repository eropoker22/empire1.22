import {
  createServerCommandJournal,
  createServerGameplayCommandId
} from "./serverCommandJournal.js";
import {
  getServerGameplaySliceReadModel,
  isServerGameplaySourceReady,
  setServerGameplaySliceReadModel
} from "./serverGameplayReadModelSource.js";
import {
  cancelPendingServerGameplayCommandRetries,
  capturePendingServerGameplayCommandRetryGeneration,
  isPendingServerGameplayCommandRetryGenerationCurrent,
  waitForPendingServerGameplayCommandRetry
} from "./serverGameplayCommandRetryLifecycle.js";
import {
  isDurableStateVersionConflictResponse,
  MAX_DURABLE_STATE_VERSION_REBASES
} from "./serverGameplayConflictPolicy.js";
export { cancelPendingServerGameplayCommandRetries };
const CONFLICT_ERROR_MESSAGES = Object.freeze({
  DISTRICT_CONFLICT_STATE_CHANGED: "Situace v districtu se mezitím změnila. Načítám aktuální stav.",
  TARGET_OWNER_CHANGED: "District mezitím změnil vlastníka. Původní akci nelze provést.",
  TARGET_NO_LONGER_NEUTRAL: "District už mezitím obsadil jiný hráč.",
  TARGET_ATTACK_PROTECTED: "District se právě vzpamatovává z boje. Další útok bude možný za chvíli.",
  TARGET_HEIST_PROTECTED: "District je po heistu dočasně chráněný.",
  TARGET_STABILIZING: "District se po převzetí ještě stabilizuje.",
  TARGET_LOCKED: "District je dočasně uzamčený.",
  TARGET_DESTROYED: "Zničený district nelze použít pro tuto akci.",
  SOURCE_CONFLICT_LOCKED: "Tento source district právě podporuje jinou operaci.",
  PLAYER_MAJOR_OPERATION_ACTIVE: "Tvůj gang právě dokončuje jinou velkou operaci.",
  SPY_INTEL_ALREADY_ACTIVE: "Na tento district už máš stále platné informace.",
  SPY_SLOT_LIMIT_REACHED: "Oba špionážní sloty jsou právě obsazené.",
  TARGET_LOOT_EXHAUSTED: "Někdo byl rychlejší. V districtu už nezbyl použitelný loot.",
  ALLIANCE_RELATION_CHANGED: "Vztah k vlastníkovi districtu se mezitím změnil.",
  FORMER_ALLY_TRUCE_ACTIVE: "Po rozpadu spojenectví ještě běží příměří.",
  PLAYER_DEFEATED: "Poražený hráč už nemůže spouštět herní akce.",
  PLAYER_HAS_NO_VALID_ORIGIN: "Pro tuto akci nemáš použitelný zdrojový district.",
  LAST_STAND_PROTECTION_ACTIVE: "Poslední bašta hráče je dočasně chráněná."
});

const STALE_CONFLICT_ERROR_CODES = new Set([
  "DISTRICT_CONFLICT_STATE_CHANGED",
  "TARGET_OWNER_CHANGED",
  "TARGET_NO_LONGER_NEUTRAL",
  "ALLIANCE_RELATION_CHANGED"
]);
const serverCommandJournal = createServerCommandJournal();
const submittingCommandIds = new Set();
const resolvingCommandIds = new Set();
const getWindowRef = () => typeof window === "undefined" ? null : window;
const getDocumentRef = () => typeof document === "undefined" ? null : document;

export function prepareServerGameplayCommand({
  type,
  payload,
  focusDistrictId,
  commandId,
  slice,
  player
} = {}) {
  const activeSlice = slice || getServerGameplaySliceReadModel();
  const activePlayer = player || activeSlice?.player || null;
  if (!activeSlice || !activePlayer?.playerId || !activePlayer?.instanceId) {
    throw new Error("Server gameplay command requires an authoritative player and instance scope.");
  }
  const scope = {
    playerId: activePlayer.playerId,
    serverInstanceId: activePlayer.instanceId
  };
  const request = {
    command: {
      id: commandId || createServerGameplayCommandId(`command:${String(type || "district-action")}`),
      type,
      mode: activePlayer.mode || activeSlice.mode?.mode || "free",
      playerId: activePlayer.playerId,
      serverInstanceId: activePlayer.instanceId,
      issuedAt: new Date().toISOString(),
      payload: payload || {},
      clientRequestId: null
    },
    focusDistrictId: focusDistrictId || activeSlice?.district?.districtId || activePlayer.homeDistrictId,
    expectedStateVersion: activeSlice.server?.stateVersion ?? null
  };
  const snapshotToken = getGameplaySliceSnapshotToken(activePlayer.instanceId, activePlayer.playerId);
  if (snapshotToken) request.snapshotToken = snapshotToken;
  const entry = serverCommandJournal.prepare({
    ...scope,
    commandId: request.command.id,
    commandType: request.command.type,
    payload: request.command.payload,
    focusDistrictId: request.focusDistrictId,
    expectedStateVersion: request.expectedStateVersion,
    clientCreatedAt: request.command.issuedAt,
    request
  });
  return { scope, entry, request: entry.request || request };
}

export async function submitServerGameplayCommand({
  type,
  payload,
  focusDistrictId,
  commandId
} = {}) {
  const connectionState = getWindowRef()?.empireStreetsGameplayConnectionState || "connected";
  if (connectionState !== "connected") {
    return {
      accepted: false,
      errors: [{
        message: connectionState === "session_expired"
          ? "Relace vypršela. Obnov přihlášení."
          : "Serverový stav se obnovuje. Akce zatím není dostupná."
      }]
    };
  }
  if (!isServerGameplaySourceReady()) {
    return { accepted: false, errors: [{ message: "Serverový herní stav ještě není načtený." }] };
  }
  const slice = getServerGameplaySliceReadModel();
  const player = slice?.player || null;
  if (!slice || !player?.playerId || !player?.instanceId) {
    return { accepted: false, errors: [{ message: "Chybí serverový kontext pro herní akci." }] };
  }
  let prepared = prepareServerGameplayCommand({
    type,
    payload,
    focusDistrictId,
    commandId,
    slice,
    player
  });
  for (let rebaseCount = 0; ; rebaseCount += 1) {
    const response = await submitPreparedServerGameplayCommand(prepared);
    if (
      !isDurableStateVersionConflictResponse(response)
      || rebaseCount >= MAX_DURABLE_STATE_VERSION_REBASES
    ) return response;
    const refreshedSlice = isMatchingCommandScope(
      response?.readModel,
      prepared.scope,
      prepared.request.focusDistrictId
    )
      ? response.readModel
      : await refreshAuthoritativeGameplaySliceForCommand(prepared.request, prepared.scope);
    const expectedStateVersion = prepared.request.expectedStateVersion;
    if (
      !isMatchingCommandScope(refreshedSlice, prepared.scope, prepared.request.focusDistrictId)
      || !Number.isSafeInteger(expectedStateVersion)
      || refreshedSlice.server.stateVersion <= expectedStateVersion
    ) return response;
    prepared = prepareServerGameplayCommand({
      type: prepared.request.command.type,
      payload: prepared.request.command.payload,
      focusDistrictId: prepared.request.focusDistrictId,
      slice: refreshedSlice,
      player: refreshedSlice.player
    });
  }
}

export async function submitPreparedServerGameplayCommand(prepared) {
  const request = prepared?.request;
  const scope = prepared?.scope || getCurrentCommandScope(request);
  const commandId = String(request?.command?.id || prepared?.entry?.commandId || "");
  if (!commandId) {
    return { accepted: false, errors: [{ message: "Chybí command ID serverové akce." }] };
  }
  if (!scope?.playerId || !scope?.serverInstanceId) {
    return { accepted: false, errors: [{ message: "Chybí scope pro ověření výsledku akce." }] };
  }
  submittingCommandIds.add(commandId);
  try {
    serverCommandJournal.beginSubmit(scope, commandId);
    const body = await submitThroughMountedClient(request)
      ?? await postJson(`${getGameplaySliceEndpointBase()}/submit`, request);
    if (!body || typeof body !== "object" || body.transportFailure === true) {
      return markCommandAmbiguous(scope, commandId);
    }
    const normalizedBody = normalizeConflictCommandResponse(body);
    if (body.committedByClient !== true) syncServerGameplaySliceResponse(normalizedBody);
    serverCommandJournal.markTerminal(
      scope,
      commandId,
      normalizedBody.accepted ? "applied" : "rejected",
      normalizedBody.errors?.[0]?.code || null
    );
    serverCommandJournal.remove(scope, commandId);
    return normalizedBody;
  } catch (_error) {
    return markCommandAmbiguous(scope, commandId);
  } finally {
    submittingCommandIds.delete(commandId);
  }
}

export async function retryPendingServerGameplayCommands() {
  if (getWindowRef()?.empireStreetsGameplayConnectionState !== "connected") return [];
  const scope = getCurrentCommandScope();
  if (!scope) return [];
  const retryGeneration = capturePendingServerGameplayCommandRetryGeneration();
  const entries = serverCommandJournal.list(scope, ["prepared", "submitting", "ambiguous", "resolving"]);
  const results = [];
  for (const entry of entries) {
    if (!isPendingServerGameplayCommandRetryGenerationCurrent(retryGeneration)) break;
    results.push(await resolvePendingCommand(scope, entry, retryGeneration));
  }
  return results;
}

export function syncServerGameplaySliceResponse(response) {
  const currentPlayer = getServerGameplaySliceReadModel()?.player || null;
  const responsePlayer = response?.readModel?.player || currentPlayer;
  if (response?.snapshotToken && responsePlayer?.instanceId && responsePlayer?.playerId) {
    setGameplaySliceSnapshotToken(responsePlayer.instanceId, responsePlayer.playerId, response.snapshotToken);
  }
  if (!response?.readModel || !setServerGameplaySliceReadModel(response.readModel)) return false;
  getDocumentRef()?.dispatchEvent?.(new CustomEvent("empire:gameplay-slice-rendered", {
    detail: {
      gameplaySlice: response.readModel,
      playerView: response.readModel.player || null
    }
  }));
  return true;
}

const getCurrentCommandScope = (request = null) => {
  const player = getServerGameplaySliceReadModel()?.player || null;
  const playerId = player?.playerId || request?.command?.playerId || null;
  const serverInstanceId = player?.instanceId || request?.command?.serverInstanceId || null;
  return playerId && serverInstanceId ? { playerId, serverInstanceId } : null;
};

const markCommandAmbiguous = (scope, commandId) => {
  serverCommandJournal.markAmbiguous(scope, commandId);
  return {
    accepted: false,
    pending: true,
    commandId,
    errors: [{
      code: "COMMAND_RESULT_UNKNOWN",
      message: "Výsledek operace se stále ověřuje. Neodesílej ji znovu."
    }]
  };
};

const resolvePendingCommand = async (scope, entry, retryGeneration) => {
  if (!isPendingServerGameplayCommandRetryGenerationCurrent(retryGeneration)) return null;
  const commandId = String(entry?.commandId || "");
  if (!commandId || submittingCommandIds.has(commandId) || resolvingCommandIds.has(commandId)) return null;
  const request = entry?.request;
  if (
    !request?.command
    || request.command.playerId !== scope.playerId
    || request.command.serverInstanceId !== scope.serverInstanceId
  ) {
    serverCommandJournal.abandon(scope, commandId);
    return null;
  }
  resolvingCommandIds.add(commandId);
    serverCommandJournal.markResolving(scope, commandId);
  try {
    for (const delay of [0, 500, 1000, 2000, 4000, 8000]) {
      if (!await waitForPendingServerGameplayCommandRetry(delay, retryGeneration)) return null;
      const lookup = await lookupCommandResult(scope, entry);
      if (!isPendingServerGameplayCommandRetryGenerationCurrent(retryGeneration)) return null;
      if (!lookup) return markCommandAmbiguous(scope, commandId);
      if (lookup.status === "applied" || lookup.status === "rejected") {
        const normalized = normalizeConflictCommandResponse(lookup);
        syncServerGameplaySliceResponse(normalized);
        serverCommandJournal.markTerminal(
          scope,
          commandId,
          lookup.status,
          normalized.errors?.[0]?.code || null
        );
        serverCommandJournal.remove(scope, commandId);
        return normalized;
      }
      if (lookup.status === "not_found") {
        if (!isPendingServerGameplayCommandRetryGenerationCurrent(retryGeneration)) return null;
        return submitPreparedServerGameplayCommand({ scope, entry, request });
      }
    }
    return isPendingServerGameplayCommandRetryGenerationCurrent(retryGeneration)
      ? markCommandAmbiguous(scope, commandId)
      : null;
  } finally {
    resolvingCommandIds.delete(commandId);
  }
};

const lookupCommandResult = async (scope, entry) => {
  try {
    return await postJson(`${getGameplaySliceEndpointBase()}/command-result`, {
      serverInstanceId: scope.serverInstanceId,
      commandId: entry.commandId,
      districtId: entry.focusDistrictId || null
    });
  } catch (_error) {
    return null;
  }
};

const normalizeConflictCommandResponse = (response) => {
  const errors = Array.isArray(response?.errors)
    ? response.errors.map((error) => {
        const code = String(error?.code || "");
        return CONFLICT_ERROR_MESSAGES[code]
          ? { ...error, message: CONFLICT_ERROR_MESSAGES[code] }
          : error;
      })
    : [];
  if (errors.some((error) => STALE_CONFLICT_ERROR_CODES.has(String(error?.code || "")))) {
    getDocumentRef()?.dispatchEvent?.(new CustomEvent("empire:conflict-state-stale", {
      detail: { commandId: response?.commandResult?.commandId || null, errors }
    }));
  }
  return { ...response, errors };
};

const refreshAuthoritativeGameplaySliceForCommand = async (request, scope) => {
  const focusDistrictId = String(request?.focusDistrictId || "").trim();
  if (!focusDistrictId || !scope) return null;

  const clientApi = getWindowRef()?.EmpireGameplaySliceClient;
  const activeFocusDistrictId = clientApi?.getCurrentRenderState?.()?.districtPanel?.districtId || null;
  if (activeFocusDistrictId === focusDistrictId && typeof clientApi?.selectDistrict === "function") {
    try {
      const renderState = await clientApi.selectDistrict(focusDistrictId);
      if (!renderState || (renderState.connection?.status && renderState.connection.status !== "ready")) {
        return null;
      }
      const readModel = clientApi.getCurrentReadModel?.() || getServerGameplaySliceReadModel();
      if (readModel) setServerGameplaySliceReadModel(readModel);
      return readModel;
    } catch (_error) {
      return null;
    }
  }

  const loadRequest = {
    serverInstanceId: scope.serverInstanceId,
    playerId: scope.playerId,
    districtId: focusDistrictId
  };
  const snapshotToken = getGameplaySliceSnapshotToken(scope.serverInstanceId, scope.playerId);
  if (snapshotToken) loadRequest.snapshotToken = snapshotToken;
  try {
    const response = await postJson(`${getGameplaySliceEndpointBase()}/load`, loadRequest);
    if (!response?.accepted || !response.readModel) return null;
    syncServerGameplaySliceResponse(response);
    return response.readModel;
  } catch (_error) {
    return null;
  }
};

const isMatchingCommandScope = (slice, scope, focusDistrictId) => Boolean(
  slice?.player?.playerId === scope?.playerId
  && slice?.player?.instanceId === scope?.serverInstanceId
  && slice?.server?.serverInstanceId === scope?.serverInstanceId
  && Number.isSafeInteger(slice?.server?.stateVersion)
  && slice.server.stateVersion >= 0
  && slice?.district?.districtId === focusDistrictId
);

const getGameplaySliceEndpointBase = () => {
  const root = getDocumentRef()?.querySelector?.("[data-gameplay-slice-client]");
  return String(root?.dataset?.gameplaySliceEndpointBase || "/api/gameplay-slice").replace(/\/+$/u, "");
};

const getGameplaySliceSnapshotToken = (serverInstanceId, playerId) => {
  try {
    return getWindowRef()?.sessionStorage?.getItem?.(
      `empire:gameplay-slice:snapshot:${serverInstanceId}:${playerId}`
    ) || null;
  } catch (_error) {
    return null;
  }
};

const setGameplaySliceSnapshotToken = (serverInstanceId, playerId, token) => {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) return false;
  try {
    getWindowRef()?.sessionStorage?.setItem?.(
      `empire:gameplay-slice:snapshot:${serverInstanceId}:${playerId}`,
      normalizedToken
    );
    return true;
  } catch (_error) {
    return false;
  }
};

const postJson = async (url, payload) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const submitThroughMountedClient = async (request) => {
  const clientApi = getWindowRef()?.EmpireGameplaySliceClient;
  if (typeof clientApi?.submitCommand !== "function") return null;
  const activeFocusDistrictId = clientApi.getCurrentRenderState?.()?.districtPanel?.districtId || null;
  if (request?.focusDistrictId && activeFocusDistrictId !== request.focusDistrictId) return null;
  const result = await clientApi.submitCommand(request.command);
  if (!result) return null;
  if (result.readModel) setServerGameplaySliceReadModel(result.readModel);
  return {
    accepted: result.accepted,
    errors: result.errors || [],
    readModel: result.readModel || null,
    transportFailure: result.transportFailure === true,
    committedByClient: true
  };
};
