import type { ServerApp } from "../../../../apps/server/src/app/server-app";
import type { FullGameExecutionMetrics } from "./executor";
import { reevaluateGameReport } from "./evaluator";
import {
  FULL_GAME_EVALUATION_VERSION,
  FULL_GAME_HARNESS_REVISION,
  type FullGameReport,
  type FullGameScenario,
  type PlayerSimulationMetrics,
  type SimulationBot
} from "./types";

export interface OwnershipTracking {
  ownerByDistrict: Record<string, string | null>;
  maxByPlayer: Record<string, number>;
  capturedByPlayer: Record<string, number>;
  lostByPlayer: Record<string, number>;
}

export const initializeOwnershipTracking = (
  server: ServerApp,
  instanceId: string,
  bots: SimulationBot[]
): OwnershipTracking => {
  const state = requiredRuntime(server, instanceId).state;
  const ownerByDistrict = Object.fromEntries(Object.values(state.districtsById)
    .map((district) => [district.id, district.ownerPlayerId]));
  const counts = districtCounts(state);
  return {
    ownerByDistrict,
    maxByPlayer: Object.fromEntries(bots.map((bot) => [bot.playerId, counts[bot.playerId] ?? 0])),
    capturedByPlayer: {},
    lostByPlayer: {}
  };
};

export const updateOwnershipTracking = (
  state: ReturnType<typeof requiredRuntime>["state"],
  tracking: OwnershipTracking
): number => {
  let changes = 0;
  for (const district of Object.values(state.districtsById)) {
    const before = tracking.ownerByDistrict[district.id] ?? null;
    const after = district.ownerPlayerId ?? null;
    if (before !== after) {
      changes += 1;
      if (before) tracking.lostByPlayer[before] = (tracking.lostByPlayer[before] ?? 0) + 1;
      if (after) tracking.capturedByPlayer[after] = (tracking.capturedByPlayer[after] ?? 0) + 1;
      tracking.ownerByDistrict[district.id] = after;
    }
  }
  const counts = districtCounts(state);
  for (const [playerId, count] of Object.entries(counts)) {
    tracking.maxByPlayer[playerId] = Math.max(tracking.maxByPlayer[playerId] ?? 0, count);
  }
  return changes;
};

export const buildReport = (input: {
  seed: string;
  scenario: FullGameScenario;
  server: ServerApp;
  instanceId: string;
  bots: SimulationBot[];
  metrics: FullGameExecutionMetrics;
  initial: Record<string, { cash: number; dirtyCash: number; influence: number; heat: number }>;
  ownership: OwnershipTracking;
  ownershipChanges: number;
  restartRecoveryVerified: boolean;
  idempotenceVerified: boolean;
  concurrencyVerified: boolean;
  stalled: boolean;
  finalResultPersisted: boolean;
  postGameMutationBlocked: boolean;
  postGameTickImmutable: boolean;
  sourceRevision: string;
}): FullGameReport => {
  const runtime = requiredRuntime(input.server, input.instanceId);
  const state = runtime.state;
  const factionsRepresented = [...new Set(input.bots.map((bot) => bot.factionId))].sort();
  const playerMetrics = createPlayerMetrics(input, state);
  const bounties = Object.values(state.bountiesById ?? {});
  const alliances = Object.values(state.alliancesById);
  const report: FullGameReport = {
    schemaVersion: 2,
    evaluationVersion: FULL_GAME_EVALUATION_VERSION,
    harnessRevision: FULL_GAME_HARNESS_REVISION,
    sourceRevision: input.sourceRevision,
    seed: input.seed,
    scenario: input.scenario,
    passed: false,
    failureCodes: [],
    errors: [],
    architecture: ["gameplay session identity", "gameplaySliceTransport", "command ingress", "atomic command dispatcher", "game-core handlers", "transactional persistence boundary", "authoritative projections", "durable worker tick", "snapshot recovery"],
    durationTicks: state.root.tick,
    durationGameTimeMs: state.root.tick * runtime.config.tickRateMs,
    commandsAttempted: input.metrics.commandsAttempted,
    commandsAccepted: input.metrics.commandsAccepted,
    commandsRejected: input.metrics.commandsRejected,
    rejectionsByReason: input.metrics.rejectionsByReason,
    rejectionAudit: input.metrics.rejectionAudit,
    decisionSkips: input.metrics.decisionSkips,
    playersStarted: 20,
    playersEliminated: Object.values(state.playersById).filter((player) => player.status === "defeated").length,
    playersFinished: state.matchResult?.ranking.length ?? 0,
    factionsRepresented,
    alliancesCreated: alliances.length,
    maxAllianceSize: Math.max(0, ...alliances.map((alliance) => alliance.memberIds.length)),
    districtOwnershipChanges: input.ownershipChanges,
    attacks: input.metrics.actionCoverage["attack-district"]?.success ?? 0,
    spies: input.metrics.actionCoverage["spy-district"]?.success ?? 0,
    robberies: input.metrics.actionCoverage["rob-district"]?.success ?? 0,
    heists: input.metrics.actionCoverage["heist-district"]?.success ?? 0,
    marketTrades: input.metrics.actionCoverage["buy-player-market-listing"]?.success ?? 0,
    marketVolume: calculateMarketVolume(state),
    bountiesCreated: bounties.length,
    bountiesClaimed: bounties.filter((bounty) => bounty.status === "claimed").length,
    bountyLifecycle: {
      created: bounties.length,
      claimed: bounties.filter((bounty) => bounty.status === "claimed").length,
      paid: bounties.filter((bounty) => bounty.status === "claimed" && bounty.claimedByPlayerId).length,
      cancelled: bounties.filter((bounty) => bounty.status === "cancelled").length,
      expired: bounties.filter((bounty) => bounty.status === "expired").length,
      invalid: Math.max(0, (input.metrics.actionCoverage["create-bounty"]?.executed ?? 0) - (input.metrics.actionCoverage["create-bounty"]?.success ?? 0))
    },
    cityEventRewardClaims: input.metrics.actionCoverage["claim-city-event-reward"]?.success ?? 0,
    cityEventClaimableRewardsObserved: input.metrics.cityEventClaimableRewardIds.length,
    cityEventBlockedRewardsObserved: input.metrics.cityEventBlockedRewardIds.length,
    policeRaids: input.metrics.eventCounts["police-raid-triggered"] ?? 0,
    cityEvents: (input.metrics.eventCounts["city-event-succeeded"] ?? 0) + (input.metrics.eventCounts["city-event-failed"] ?? 0),
    purgeStarted: (state.eliminationState?.eliminationCount ?? 0) > 0,
    purgeCompleted: (state.eliminationState?.eliminationCount ?? 0) > 0
      && Object.values(state.playersById).filter((player) => player.status === "active").length <= 8,
    finalLockdownStarted: (input.metrics.eventCounts["final-lockdown-started"] ?? 0) > 0,
    finalLockdownCompleted: state.finalLockdownState?.status === "resolved",
    winnerId: state.matchResult?.winnerPlayerId ?? null,
    finalResultPersisted: input.finalResultPersisted,
    restartRecoveryVerified: input.restartRecoveryVerified,
    idempotenceVerified: input.idempotenceVerified,
    concurrencyVerified: input.concurrencyVerified,
    postGameMutationBlocked: input.postGameMutationBlocked,
    postGameTickImmutable: input.postGameTickImmutable,
    stalled: input.stalled,
    invariantChecks: input.metrics.invariantChecks,
    invariantViolations: input.metrics.invariantViolations,
    unexpectedErrors: input.metrics.unexpectedErrors,
    actionCoverage: input.metrics.actionCoverage,
    players: playerMetrics,
    traceTail: input.metrics.traces
  };
  return reevaluateGameReport(report);
};

const createPlayerMetrics = (
  input: Parameters<typeof buildReport>[0],
  state: ReturnType<typeof requiredRuntime>["state"]
): PlayerSimulationMetrics[] => {
  const counts = districtCounts(state);
  const ranking = new Map((state.matchResult?.ranking ?? []).map((entry) => [entry.subjectId, entry.rank]));
  return input.bots.map((bot) => {
    const player = state.playersById[bot.playerId]!;
    const resources = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
    const police = state.policeStatesById[player.policeStateId];
    const actions = input.metrics.acceptedActionsByPlayer[player.id] ?? {};
    const outcomes = input.metrics.outcomesByPlayer[player.id] ?? {};
    const ownedBuildings = Object.values(state.buildingsById).filter((building) => building.ownerPlayerId === player.id);
    const bounties = Object.values(state.bountiesById ?? {});
    const initial = input.initial[player.id]!;
    const eliminationReason = typeof player.metadata?.eliminationReason === "string"
      ? player.metadata.eliminationReason
      : null;
    const eliminatedAt = Number(player.metadata?.eliminatedAtTick);
    return {
      playerId: player.id, faction: bot.factionId, archetype: bot.archetype, startingDistrict: bot.startingDistrictId,
      finalDistrictCount: counts[player.id] ?? 0, maxDistrictCount: input.ownership.maxByPlayer[player.id] ?? 0,
      cleanCashEarned: Math.max(0, Number(resources.cash ?? 0) - initial.cash), dirtyCashEarned: Math.max(0, Number(resources["dirty-cash"] ?? 0) - initial.dirtyCash),
      influenceEarned: Math.max(0, ownedInfluence(state, player.id) - initial.influence), buildingsOwned: ownedBuildings.length,
      buildingUpgrades: actions["upgrade-building"] ?? 0, productionStarted: actions["craft-item"] ?? 0, productionCompleted: actions["collect-production"] ?? 0,
      marketOffers: actions["create-player-market-listing"] ?? 0, marketTrades: actions["buy-player-market-listing"] ?? 0, marketVolume: 0,
      bountiesCreated: bounties.filter((bounty) => bounty.createdByPlayerId === player.id).length,
      bountiesClaimed: bounties.filter((bounty) => bounty.claimedByPlayerId === player.id).length,
      bountyValuePaid: bounties.filter((bounty) => bounty.createdByPlayerId === player.id).reduce((sum, bounty) => sum + bounty.rewardCleanCash, 0),
      bountyValueEarned: bounties.filter((bounty) => bounty.claimedByPlayerId === player.id).reduce((sum, bounty) => sum + bounty.rewardCleanCash, 0),
      spyAttempts: actions["spy-district"] ?? 0, spySuccesses: outcomes.spySuccesses ?? 0, spyFailures: outcomes.spyFailures ?? 0,
      robberies: actions["rob-district"] ?? 0, heists: actions["heist-district"] ?? 0, attacksStarted: actions["attack-district"] ?? 0,
      attacksWon: outcomes.attacksWon ?? 0, attacksLost: outcomes.attacksLost ?? 0,
      districtsCaptured: input.ownership.capturedByPlayer[player.id] ?? 0, districtsLost: input.ownership.lostByPlayer[player.id] ?? 0,
      heatGenerated: Math.max(0, Number(police?.heat ?? 0) - initial.heat), maxHeat: Number(police?.heat ?? 0),
      policeRaids: police?.lastRaidCreatedAtTick ? 1 : 0, policePenalties: police?.activeFlags?.length ?? 0,
      allianceJoined: Boolean(player.allianceId), allianceId: player.allianceId,
      purgeOutcome: eliminationReason === "scheduled_weakest_player"
        ? "eliminated-by-purge"
        : player.status === "defeated" ? "defeated-other" : "survived",
      finalLockdownOutcome: state.matchResult?.winnerPlayerId === player.id ? "winner" : "ranked",
      eliminatedAt: player.status === "defeated" && Number.isFinite(eliminatedAt) ? eliminatedAt : null,
      eliminationReason,
      finalPlacement: ranking.get(player.id) ?? 20, winner: state.matchResult?.winnerPlayerId === player.id
    };
  }).sort((left, right) => left.finalPlacement - right.finalPlacement);
};

export const captureInitialPlayerState = (server: ServerApp, instanceId: string, bots: SimulationBot[]) => {
  const state = requiredRuntime(server, instanceId).state;
  return Object.fromEntries(bots.map((bot) => {
    const player = state.playersById[bot.playerId]!;
    const resources = state.resourceStatesById[player.resourceStateId]?.balances ?? {};
    return [bot.playerId, { cash: Number(resources.cash ?? 0), dirtyCash: Number(resources["dirty-cash"] ?? 0), influence: ownedInfluence(state, bot.playerId), heat: Number(state.policeStatesById[player.policeStateId]?.heat ?? 0) }];
  }));
};

export const lifecycleSignature = (state: ReturnType<typeof requiredRuntime>["state"]): string =>
  `${state.root.phase}:${state.eliminationState?.eliminatedPlayerIds.length ?? 0}:${state.finalLockdownState?.status ?? "none"}`;

export const stateDigest = (state: ReturnType<typeof requiredRuntime>["state"]): string => JSON.stringify({
  root: state.root, players: state.playersById, districts: state.districtsById,
  resources: state.resourceStatesById, market: state.market, bounties: state.bountiesById,
  alliances: state.alliancesById, police: state.policeStatesById,
  finalLockdown: state.finalLockdownState, matchResult: state.matchResult
});

export const rotateBots = (bots: SimulationBot[], offset: number): SimulationBot[] =>
  bots.map((_, index) => bots[(index + offset) % bots.length]!);
export const seedNumber = (seed: string): number =>
  [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);

const calculateMarketVolume = (state: ReturnType<typeof requiredRuntime>["state"]): number =>
  ((state.market as { transactions?: Array<{ totalPrice?: number }> } | undefined)?.transactions ?? [])
    .reduce((sum, transaction) => sum + Number(transaction.totalPrice ?? 0), 0);
const districtCounts = (state: ReturnType<typeof requiredRuntime>["state"]): Record<string, number> =>
  Object.values(state.districtsById).reduce<Record<string, number>>((counts, district) => {
    if (district.ownerPlayerId && district.status !== "destroyed") {
      counts[district.ownerPlayerId] = (counts[district.ownerPlayerId] ?? 0) + 1;
    }
    return counts;
  }, {});
const ownedInfluence = (state: ReturnType<typeof requiredRuntime>["state"], playerId: string): number =>
  Object.values(state.districtsById)
    .filter((district) => district.ownerPlayerId === playerId && district.status !== "destroyed")
    .reduce((sum, district) => sum + Number(district.influence ?? 0), 0);
const requiredRuntime = (server: ServerApp, instanceId: string) => {
  const runtime = server.instanceManager.getInstanceById(instanceId);
  if (!runtime) throw new Error(`Runtime ${instanceId} is missing.`);
  return runtime;
};
