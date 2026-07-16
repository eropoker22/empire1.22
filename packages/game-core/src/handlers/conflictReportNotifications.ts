import type {
  HeistDistrictCommand,
  Notification,
  ResourceState,
  RobDistrictCommand,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { createNotification } from "../events";
import { composeEntityId } from "../utils";
import { resolvePlayerSpyBoostEffects, resolveSpy } from "../rules";

export const createSpyReportNotification = (input: {
  command: SpyDistrictCommand;
  playerId: string;
  targetDistrictId: string;
  targetOwnerPlayerId: string | null;
  targetSecurityRevision: number;
  purpose: "attack_owned_district" | "occupy_empty_district";
  reportResult: ReturnType<typeof resolveSpy>;
  blockedUntilTick: number | null;
  tick: number;
  eventId: string;
  boostSnapshot: ReturnType<typeof resolvePlayerSpyBoostEffects>;
  authorizationTtlTicks: number;
}): Notification => createNotification({
  id: composeEntityId("notification", `${input.command.id}:spy-report`),
  recipientType: "player", recipientId: input.playerId, category: "report.spy",
  title: `Spy report: ${input.targetDistrictId}`, bodyKey: "report.spy",
  payload: {
    reportId: composeEntityId("report", `${input.command.id}:spy`), reportType: "spy",
    actionType: "spy-district", playerId: input.playerId, attackerPlayerId: input.command.playerId,
    sourceDistrictId: input.command.payload.sourceDistrictId, targetDistrictId: input.targetDistrictId,
    targetOwnerPlayerId: input.targetOwnerPlayerId,
    targetStateAtSpy: input.targetOwnerPlayerId ? "owned" : "empty",
    targetSecurityRevision: input.targetSecurityRevision,
    purpose: input.reportResult.result === "success" ? input.purpose : null,
    result: input.reportResult.result, detectedDefense: input.reportResult.detectedDefense,
    trapDetected: input.reportResult.trapDetected, occupyUnlocked: input.reportResult.occupyUnlocked,
    revealedType: input.reportResult.revealedType, revealedDefense: input.reportResult.revealedDefense,
    heatGained: input.reportResult.heatGained, extraIntelBlocks: input.reportResult.extraIntelBlocks,
    boostSnapshot: input.boostSnapshot.boostId ? input.boostSnapshot : null,
    blockedUntilTick: input.blockedUntilTick,
    authorizationScope: input.reportResult.result === "success" ? input.purpose : null,
    issuedAtTick: input.tick,
    authorizationExpiresAtTick: input.reportResult.result === "success"
      ? input.tick + input.authorizationTtlTicks : null,
    tick: input.tick, createdAt: input.command.issuedAt, eventId: input.eventId
  },
  createdAt: input.command.issuedAt,
  readAt: null
});

export const createHeistReportNotification = (input: {
  command: HeistDistrictCommand;
  sourceDistrictId: string;
  targetOwnerPlayerId: string;
  outcome: string;
  loot: Record<string, number>;
  gangLosses: number;
  heatGained: number;
  successChance: number;
  detectionChance: number;
  attackerIdentified: boolean;
  tick: number;
}): Notification => createNotification({
  id: composeEntityId("notification", `${input.command.id}:heist-report`),
  recipientType: "player",
  recipientId: input.command.playerId,
  category: "report.heist",
  title: `Heist report: ${input.command.payload.targetDistrictId}`,
  bodyKey: "report.heist",
  payload: {
    reportId: composeEntityId("report", `${input.command.id}:heist`), reportType: "heist",
    actionType: "heist-district", playerId: input.command.playerId,
    sourceDistrictId: input.sourceDistrictId, targetDistrictId: input.command.payload.targetDistrictId,
    targetOwnerPlayerId: input.targetOwnerPlayerId, style: input.command.payload.style,
    result: input.outcome, loot: input.loot, gangLosses: input.gangLosses,
    heatGained: input.heatGained, successChance: input.successChance,
    detectionChance: input.detectionChance, attackerIdentified: input.attackerIdentified,
    tick: input.tick, createdAt: input.command.issuedAt
  },
  createdAt: input.command.issuedAt,
  readAt: null
});

export const createRobReportNotification = (input: {
  command: RobDistrictCommand;
  sourceDistrictId: string;
  result: string;
  loot: Record<string, number>;
  playerHeat: number;
  districtHeat: number;
  cooldownTicks: number;
  poolChangedBeforeResolution: boolean;
  resolvedLootPoolRevision: number;
  tick: number;
}): Notification => createNotification({
  id: composeEntityId("notification", `${input.command.id}:rob-report`),
  recipientType: "player",
  recipientId: input.command.playerId,
  category: "report.rob",
  title: `Rob report: ${input.command.payload.targetDistrictId}`,
  bodyKey: "report.rob",
  payload: {
    reportId: composeEntityId("report", `${input.command.id}:rob`), reportType: "rob",
    actionType: "rob-district", playerId: input.command.playerId,
    sourceDistrictId: input.sourceDistrictId, targetDistrictId: input.command.payload.targetDistrictId,
    result: input.result, loot: input.loot, playerHeat: input.playerHeat,
    districtHeat: input.districtHeat, cooldownTicks: input.cooldownTicks,
    poolChangedBeforeResolution: input.poolChangedBeforeResolution,
    expectedLootPoolRevision: input.command.payload.expectedLootPoolRevision ?? null,
    resolvedLootPoolRevision: input.resolvedLootPoolRevision,
    tick: input.tick, createdAt: input.command.issuedAt
  },
  createdAt: input.command.issuedAt,
  readAt: null
});

export const createPlayerResourceState = (id: string, playerId: string, tick: number): ResourceState => ({
  id, ownerType: "player", ownerId: playerId, balances: {}, incomeModifiers: {},
  lastUpdatedTick: tick, version: 1
});

export const resolveSingleOwnedOrigin = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): string | undefined => {
  const target = state.districtsById[targetDistrictId];
  const origins = Object.values(state.districtsById).filter((district) =>
    district.ownerPlayerId === playerId
    && district.adjacentDistrictIds.includes(target.id)
    && target.adjacentDistrictIds.includes(district.id)
  );
  return origins.length === 1 ? origins[0].id : undefined;
};
