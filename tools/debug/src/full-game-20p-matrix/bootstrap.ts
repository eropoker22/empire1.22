import { FREE_HOSTED_STARTING_MATERIAL_IDS } from "@empire/game-config";
import { PLAYER_FACTION_IDS, type HostedStartingPlayerStateView } from "@empire/shared-types";
import type { ServerApp } from "../../../../apps/server/src/app/server-app";
import { ensureGameplaySliceMembershipInState } from "../../../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { enabledSharedCitySpawnDistrictIds } from "../../../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import type { MutableSimulationClock } from "./mutable-clock";
import { FULL_GAME_ARCHETYPES, type FullGameScenario, type SimulationBot } from "./types";

const scenarioArchetypes: Record<FullGameScenario, readonly (typeof FULL_GAME_ARCHETYPES)[number][]> = {
  "balanced-city": FULL_GAME_ARCHETYPES,
  "high-conflict": ["aggressor", "opportunist", "high-heat-criminal", "expander", "bounty-hunter", "balanced"],
  "economy-heavy": ["economist", "market-trader", "turtle", "balanced", "expander", "spymaster"],
  "police-chaos": ["high-heat-criminal", "aggressor", "bounty-hunter", "opportunist", "stealth", "balanced"],
  "alliance-war": ["alliance-diplomat", "aggressor", "turtle", "economist", "spymaster", "balanced"],
  "endgame-pressure": ["expander", "aggressor", "opportunist", "economist", "bounty-hunter", "balanced"]
};

export const bootstrapTwentyPlayers = async (
  server: ServerApp,
  clock: MutableSimulationClock,
  instanceId: string,
  scenario: FullGameScenario,
  seedOffset: number
): Promise<SimulationBot[]> => {
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error("Simulation runtime is missing during player bootstrap.");
  const bots: SimulationBot[] = [];
  const archetypes = scenarioArchetypes[scenario];
  const factionRotation = Array.from({ length: 20 }, (_, index) => PLAYER_FACTION_IDS[index % PLAYER_FACTION_IDS.length]!);

  for (let index = 0; index < 20; index += 1) {
    const accountId = `simulation:${seedOffset}:${index + 1}`;
    const registration = await server.gameplaySessionService.getOrCreateRegistration({
      accountId,
      serverInstanceId: instanceId,
      nowIso: clock.nowIso()
    });
    const factionId = factionRotation[index]!;
    const joined = ensureGameplaySliceMembershipInState(runtime.state, {
      serverInstanceId: instanceId,
      playerId: registration.playerId,
      factionId,
      mode: "free",
      startingPlayerState: createSimulationStartingState(index)
    });
    if (!joined.accepted) throw new Error(`Player ${index + 1} bootstrap rejected: ${joined.errors[0]?.code}`);
    runtime.state = joined.state;
    const session = await server.gameplaySessionService.createSession({
      registration,
      nowIso: clock.nowIso(),
      ttlMs: runtime.config.technical.sessionTtlMs
    });
    if (!server.gameplaySessionTokenCodec) throw new Error("Gameplay session token codec is required for the full-game simulation.");
    const sessionToken = server.gameplaySessionTokenCodec.seal({
      sessionId: session.sessionId,
      accountId: session.accountId,
      serverInstanceId: session.serverInstanceId,
      playerId: session.playerId,
      factionId,
      issuedAt: session.createdAt,
      expiresAt: session.expiresAt,
      version: session.version
    });
    bots.push({
      accountId,
      playerId: registration.playerId,
      sessionToken,
      factionId,
      archetype: archetypes[(index + seedOffset) % archetypes.length]!,
      startingDistrictId: null
    });
  }

  server.instanceManager.startInstance(instanceId);
  for (let index = 0; index < bots.length; index += 1) {
    const bot = bots[index]!;
    const districtId = enabledSharedCitySpawnDistrictIds[(index + seedOffset) % enabledSharedCitySpawnDistrictIds.length]!;
    const response = await server.gameplaySliceTransport.submit({
      sessionToken: bot.sessionToken,
      focusDistrictId: districtId,
      expectedStateVersion: runtime.state.root.version,
      command: {
        id: `full-game:${seedOffset}:spawn:${index + 1}`,
        type: "select-spawn-district",
        mode: "free",
        playerId: bot.playerId,
        serverInstanceId: instanceId,
        issuedAt: clock.nowIso(),
        clientRequestId: `full-game:${seedOffset}:spawn:${index + 1}`,
        payload: { districtId }
      }
    });
    if (!response.accepted) throw new Error(`Spawn rejected for player ${index + 1}: ${response.errors[0]?.code}`);
    bot.startingDistrictId = districtId;
  }
  return bots;
};

const createSimulationStartingState = (index: number): HostedStartingPlayerStateView => ({
  cleanCash: 20_000,
  dirtyCash: 5_000,
  population: 250,
  influence: 500,
  spySlots: 2,
  materials: Object.fromEntries(FREE_HOSTED_STARTING_MATERIAL_IDS.map((id) => [
    id,
    id === "bazooka" || id === "defense-tower" ? 2 : id === "combat-module" ? 8 : 20 + (index % 3)
  ])) as HostedStartingPlayerStateView["materials"]
});
