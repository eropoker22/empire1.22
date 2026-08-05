import type { OccupyDistrictCommand, PendingOccupyOperation } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine/context";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import {
  createOccupyGlobalCooldownKey,
  createOccupySourceCooldownKey,
  applyDistrictOperationLock,
  applyMajorOperationCooldowns,
  resolveOccupyBalance,
  resolveOccupyInfluenceCost,
  resolveOccupyPopulationCost
} from "../rules";
import {
  applyFactionCooldownTicks,
  applyFactionMultiplier,
  getFactionPassiveModifiers
} from "../rules/factions/factionRules";
import { validateOccupy } from "../validation";
import { createPlayerCooldownState } from "./attackDistrictHelpers";
import { applyCarDealerCooldownReductionTicks } from "./carDealerBuildingActions";
import { resolveCityHallNightPatrolPressure } from "./cityHallBuildingActions";
import { bumpDistrictConflictRevision } from "../state";
import {
  consumeEncirclementConfirmation,
  prepareEncirclementConfirmation
} from "../rules/liveness";

/**
 * Responsibility: Starts one validated neutral-district occupation operation.
 * Belongs here: upfront influence payment, cooldown locks, and persisted pending operation creation.
 * Does not belong here: capture resolution, report creation, or result disclosure.
 */
export const handleOccupyDistrict = (
  state: CoreGameState,
  command: OccupyDistrictCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateOccupy(state, command, context.config.balance.conflict);
  if (errors.length > 0) {
    if (errors.length === 1 && errors[0]?.code === "CONSENT_REQUIRED") {
      return prepareEncirclementConfirmation(state, {
        commandId: command.id,
        playerId: command.playerId,
        targetDistrictId: command.payload.districtId,
        sourceDistrictId: command.payload.sourceDistrictId ?? "",
        issuedAt: command.issuedAt
      }, context);
    }
    return { nextState: state, events: [], errors };
  }

  const player = state.playersById[command.playerId]!;
  const sourceDistrict = state.districtsById[command.payload.sourceDistrictId ?? ""]!;
  const targetDistrict = state.districtsById[command.payload.districtId]!;
  const balance = resolveOccupyBalance(context.config.balance.conflict);
  const influenceCost = resolveOccupyInfluenceCost(state, player.id, context.config.balance.conflict);
  const populationCost = resolveOccupyPopulationCost(state, player.id, context.config.balance.conflict);
  const factionModifiers = getFactionPassiveModifiers(state, player.id, context);
  const cityHallNightPatrol = resolveCityHallNightPatrolPressure({
    state,
    context,
    targetDistrict,
    tick: state.root.tick
  });
  const cooldownTicks = Math.max(
    resolveOccupyCooldownGuardrailTicks(context, balance.cooldownTicks),
    Math.ceil(applyFactionCooldownTicks(
      applyCarDealerCooldownReductionTicks({
        baseTicks: balance.cooldownTicks,
        state,
        playerId: player.id,
        config: context.config.balance.carDealer,
        garageConfig: context.config.balance.garage,
        category: "districtOccupy"
      }),
      "occupy",
      factionModifiers
    ) * cityHallNightPatrol.durationMultiplier)
  );
  const heatGain = Math.ceil(resolveOccupyHeatGain(
    balance.heatGain,
    factionModifiers.aggressiveActionHeatGainMultiplier
  ) * cityHallNightPatrol.heatMultiplier);
  const resolveAtTick = state.root.tick + cooldownTicks;
  const resolveAt = new Date(
    Date.parse(command.issuedAt) + cooldownTicks * context.config.tickRateMs
  ).toISOString();
  const operation: PendingOccupyOperation = {
    id: `occupy-operation:${command.id}`,
    commandId: command.id,
    playerId: player.id,
    sourceDistrictId: sourceDistrict.id,
    targetDistrictId: targetDistrict.id,
    issuedAt: command.issuedAt,
    issuedAtTick: state.root.tick,
    resolveAt,
    resolveAtTick,
    cooldownTicks,
    influenceCost,
    populationCost,
    heatGain,
    failureChancePct: balance.failureChancePct,
    populationRefundPct: balance.populationRefundPct,
    version: 1
  };
  const cooldownState = state.cooldownStatesById[player.cooldownStateId]
    ?? createPlayerCooldownState(player.id, player.cooldownStateId);
  const storedAttemptCount = Number(player.metadata?.occupyAttemptCount);
  const attemptCount = Number.isSafeInteger(storedAttemptCount) && storedAttemptCount >= 0
    ? storedAttemptCount
    : Math.max(0, Object.values(state.districtsById)
      .filter((district) => district.ownerPlayerId === player.id && district.status !== "destroyed").length - 1);

  return {
    nextState: consumeEncirclementConfirmation({
      ...state,
      pendingOccupyOperationsById: {
        ...(state.pendingOccupyOperationsById ?? {}),
        [operation.id]: operation
      },
      playersById: {
        ...state.playersById,
        [player.id]: {
          ...player,
          metadata: { ...(player.metadata ?? {}), occupyAttemptCount: attemptCount + 1 },
          lastActionAt: command.issuedAt,
          version: player.version + 1
        }
      },
      districtsById: {
        ...state.districtsById,
        [sourceDistrict.id]: {
          ...sourceDistrict,
          influence: Math.max(0, Number(sourceDistrict.influence || 0) - influenceCost),
          version: sourceDistrict.version + 1
        },
        [targetDistrict.id]: bumpDistrictConflictRevision(applyDistrictOperationLock({
          ...targetDistrict,
          version: targetDistrict.version + 1
        }, "occupy", resolveAtTick))
      },
      cooldownStatesById: {
        ...state.cooldownStatesById,
        [cooldownState.id]: {
          ...cooldownState,
          cooldowns: applyMajorOperationCooldowns({
            ...cooldownState.cooldowns,
            [createOccupyGlobalCooldownKey()]: resolveAtTick,
            [createOccupySourceCooldownKey(sourceDistrict.id)]: resolveAtTick
          }, sourceDistrict.id, state.root.tick, context.config.balance.conflict),
          version: cooldownState.version + (state.cooldownStatesById[cooldownState.id] ? 1 : 0)
        }
      },
      root: { ...state.root, version: state.root.version + 1 }
    }, command.payload.encirclementConfirmationToken),
    events: [],
    errors: []
  };
};

const resolveOccupyHeatGain = (
  baseHeatGain: number,
  aggressiveActionHeatGainMultiplier: number | undefined
): number => {
  const base = Math.max(0, Number(baseHeatGain) || 0);
  const modified = Math.max(0, applyFactionMultiplier(base, aggressiveActionHeatGainMultiplier));
  if (modified > base) return Math.ceil(modified);
  if (modified < base) return Math.floor(modified);
  return modified;
};

const resolveOccupyCooldownGuardrailTicks = (
  context: GameCoreContext,
  configuredCooldownTicks: number
): number => {
  if (context.config.mode !== "free") return 0;
  const guardrailTicks = Math.ceil((8 * 60 * 1000) / Math.max(1, context.config.tickRateMs));
  return configuredCooldownTicks >= guardrailTicks ? guardrailTicks : 0;
};
