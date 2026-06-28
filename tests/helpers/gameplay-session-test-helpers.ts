import type {
  LoadGameplaySliceRequest,
  PlayerFactionId,
  SelectSpawnDistrictCommand,
  ServerInstanceId
} from "@empire/shared-types";
import type { ServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import { claimNextSharedCitySpawnDistrict } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-spawn";
import { sharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";

export interface DevGameplaySessionInput {
  serverInstanceId: ServerInstanceId;
  playerId: string;
  districtId?: string | null;
  preferredStartDistrictId?: string | null;
  factionId?: PlayerFactionId | string | null;
  accountId?: string;
  autoSelectSpawn?: boolean;
  spawnDistrictId?: string;
}

export interface DevGameplaySessionFixture {
  serverInstanceId: ServerInstanceId;
  playerId: string;
  accountId: string;
  sessionToken: string;
  loadRequest: LoadGameplaySliceRequest;
}

export const createDevGameplaySession = async (
  server: ServerApp,
  input: DevGameplaySessionInput
): Promise<DevGameplaySessionFixture> => {
  const accountId = input.accountId ?? `dev:${input.playerId}`;
  const loadRequest: LoadGameplaySliceRequest = {
    serverInstanceId: input.serverInstanceId,
    playerId: input.playerId,
    districtId: input.districtId,
    preferredStartDistrictId: input.preferredStartDistrictId,
    factionId: input.factionId
  };

  const ensureResult = await ensureGameplaySliceSessionResult(server.instanceManager, loadRequest, {
    allowImplicitInstanceCreation: true
  });
  if (!ensureResult.accepted) {
    throw new Error(`Failed to create gameplay membership for test: ${ensureResult.errors[0]?.code ?? "unknown"}`);
  }

  const runtime = server.instanceManager.getInstanceById(input.serverInstanceId);
  if (!runtime) {
    throw new Error("Failed to create gameplay runtime for test session.");
  }
  if (!server.gameplaySessionTokenCodec) {
    throw new Error("Gameplay session token codec is required for test session.");
  }

  const nowIso = runtime.clock.nowIso();
  const session = await server.gameplaySessionService.createSession({
    registration: {
      id: `test-registration:${input.serverInstanceId}:${input.playerId}`,
      accountId,
      serverInstanceId: input.serverInstanceId,
      playerId: input.playerId,
      status: "active",
      createdAt: nowIso,
      version: 1
    },
    nowIso,
    ttlMs: runtime.config.technical.sessionTtlMs
  });
  const sessionToken = server.gameplaySessionTokenCodec.seal({
    sessionId: session.sessionId,
    accountId: session.accountId,
    serverInstanceId: session.serverInstanceId,
    playerId: session.playerId,
    factionId: runtime.state.playersById[input.playerId]?.factionId ?? input.factionId ?? null,
    issuedAt: session.createdAt,
    expiresAt: session.expiresAt,
    version: session.version
  });

  let loadFocusDistrictId = input.districtId;
  if (input.autoSelectSpawn) {
    const spawnDistrictId = input.spawnDistrictId ?? findAvailableSpawnDistrictId(runtime, input.playerId);
    const response = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: runtime.state.root.version,
      focusDistrictId: spawnDistrictId,
      command: createSelectSpawnCommand({
        id: `command:test-select-spawn:${input.playerId}`,
        mode: runtime.record.mode,
        playerId: input.playerId,
        serverInstanceId: input.serverInstanceId,
        districtId: spawnDistrictId
      })
    });
    if (!response.accepted) {
      throw new Error(`Failed to select test spawn: ${response.errors[0]?.code ?? "unknown"}`);
    }
    const requestedFocusExists = typeof input.districtId === "string" && Boolean(runtime.state.districtsById[input.districtId]);
    loadFocusDistrictId = requestedFocusExists ? input.districtId : spawnDistrictId;
  }

  return {
    serverInstanceId: input.serverInstanceId,
    playerId: input.playerId,
    accountId,
    sessionToken,
    loadRequest: {
      ...loadRequest,
      districtId: loadFocusDistrictId,
      sessionToken
    }
  };
};

export const loadWithDevGameplaySession = async (
  server: ServerApp,
  input: DevGameplaySessionInput
) => {
  const session = await createDevGameplaySession(server, input);
  const response = await server.gameplaySliceTransport.load(session.loadRequest);
  return {
    ...session,
    response
  };
};

export const seedDevSpawnSelection = (
  server: ServerApp,
  input: {
    serverInstanceId: ServerInstanceId;
    playerId: string;
    requestedDistrictId?: string | null;
  }
): string => {
  const runtime = server.instanceManager.getInstanceById(input.serverInstanceId);
  if (!runtime) {
    throw new Error("Failed to seed spawn selection without a runtime.");
  }
  const player = runtime.state.playersById[input.playerId];
  if (!player) {
    throw new Error("Failed to seed spawn selection without a player.");
  }
  if (player.homeDistrictId) {
    return player.homeDistrictId;
  }

  const districtId = claimNextSharedCitySpawnDistrict(
    runtime.state,
    input.playerId,
    input.requestedDistrictId
  );
  if (!districtId) {
    throw new Error("Failed to seed spawn selection without an available spawn district.");
  }

  runtime.state.playersById[input.playerId] = {
    ...player,
    homeDistrictId: districtId,
    metadata: {
      ...(player.metadata ?? {}),
      spawnSelectionStatus: "ready_to_play"
    },
    version: player.version + 1
  };
  runtime.state.root.version += 1;
  return districtId;
};

const findAvailableSpawnDistrictId = (
  runtime: NonNullable<ReturnType<ServerApp["instanceManager"]["getInstanceById"]>>,
  playerId: string
): string => {
  const currentHome = runtime.state.playersById[playerId]?.homeDistrictId;
  if (currentHome) {
    return currentHome;
  }
  const available = sharedCitySpawnDistrictIds.find((districtId) => !runtime.state.districtsById[districtId]?.ownerPlayerId);
  if (!available) {
    throw new Error("No available spawn district for test session.");
  }
  return available;
};

const createSelectSpawnCommand = (input: {
  id: string;
  mode: "free" | "war";
  playerId: string;
  serverInstanceId: string;
  districtId: string;
}): SelectSpawnDistrictCommand => ({
  id: input.id,
  type: "select-spawn-district",
  mode: input.mode,
  playerId: input.playerId,
  serverInstanceId: input.serverInstanceId,
  issuedAt: new Date(0).toISOString(),
  payload: {
    districtId: input.districtId
  },
  clientRequestId: null
});
