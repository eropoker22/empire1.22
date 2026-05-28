import { addAuditEvent } from "./audit-log";
import {
  arePlayersAllied,
  isAllianceCoordinatedAttack,
  resolveAllianceAttackTargetScore
} from "./alliance-simulation";
import { resolveActivityProbability } from "./bot-player";
import { FREE_BR_BOT_STRATEGIES } from "./bot-strategies";
import { maybeAssistAlly, tryBuildingAction, tryCraft } from "./economy-actions";
import { findLeader } from "./final-score";
import { clamp } from "./math";
import type { SeededRng } from "./seeded-rng";
import {
  addHeat,
  computeAttackPower,
  computeDefensePower,
  getAdjacentTargets,
  getBottomPlayers,
  getOwnedDistricts,
  isCooldownReady,
  pickDistrictByAttackValue,
  pickDistrictByValue,
  setDistrictOwner
} from "./state-helpers";
import { isQuietHours } from "./time-helpers";
import type { FreeBrActionType, FreeBrPlayer, FreeBrSimulationState } from "./types";

export const runBotActionsForStep = (state: FreeBrSimulationState, rng: SeededRng): void => {
  const dangerZone = new Set(getBottomPlayers(state, state.config.balance.elimination?.dangerZoneSize ?? 3).map((player) => player.id));
  const leader = findLeader(state);
  const quietHours = isQuietHours(state, state.tick);
  for (const player of rng.shuffle(state.players.filter((candidate) => candidate.status === "active"))) {
    const highHeat = player.heat > player.heatTolerance * 180;
    const probability = resolveActivityProbability(player, {
      quietHours,
      dangerZone: dangerZone.has(player.id),
      leader: leader?.id === player.id,
      highHeat
    });
    if (!rng.chance(probability)) continue;
    if (dangerZone.has(player.id) && rng.chance(0.18)) {
      maybeAssistAlly(state, rng, player);
    }
    performBestAction(state, rng, player, dangerZone);
  }
};

const performBestAction = (
  state: FreeBrSimulationState,
  rng: SeededRng,
  player: FreeBrPlayer,
  dangerZone: Set<string>
): void => {
  const owned = getOwnedDistricts(state, player.id);
  if (owned.length === 0) return;

  const highHeat = player.heat > player.heatTolerance * 160;
  const shouldCoolDown = highHeat && rng.chance(0.38);
  if (shouldCoolDown && tryBuildingAction(state, rng, player, ["clinic", "courthouse", "city_hall", "school"])) return;

  if (dangerZone.has(player.id)) {
    if (tryOccupy(state, rng, player, true)) return;
    if (tryAttack(state, rng, player, true)) return;
    if (tryCraft(state, rng, player)) return;
  }

  const strategy = FREE_BR_BOT_STRATEGIES[player.strategyId];
  const actionWeights: Partial<Record<FreeBrActionType, number>> = {
    "attack-district": player.aggression * 4.5,
    "occupy-district": (1 + strategy.economy + player.downtownPreference) * 2.3,
    "spy-district": 1.8 + player.downtownPreference,
    "craft-item": 1 + player.economyPreference * 2.4 + player.defensePreference,
    "run-building-action": 1 + player.economyPreference * 2 + strategy.crime * state.scenario.crimeMultiplier
  };
  const action = rng.weightedPick<FreeBrActionType>(actionWeights);

  if (action === "attack-district" && tryAttack(state, rng, player, false)) return;
  if (action === "occupy-district" && tryOccupy(state, rng, player, false)) return;
  if (action === "spy-district" && trySpy(state, rng, player)) return;
  if (action === "craft-item" && tryCraft(state, rng, player)) return;
  if (action === "run-building-action" && tryBuildingAction(state, rng, player)) return;

  if (trySpy(state, rng, player)) return;
  if (tryOccupy(state, rng, player, false)) return;
  if (tryCraft(state, rng, player)) return;
  if (tryBuildingAction(state, rng, player)) return;
  tryAttack(state, rng, player, false);
};

const trySpy = (state: FreeBrSimulationState, rng: SeededRng, player: FreeBrPlayer): boolean => {
  const conflict = state.config.balance.conflict;
  if (!conflict || !isCooldownReady(state, player, "spy")) return false;
  const targets = getAdjacentTargets(state, player)
    .filter((district) => district.ownerPlayerId !== player.id && !player.spyIntel.has(district.id));
  if (targets.length === 0) return false;
  const target = pickDistrictByValue(rng, targets, player);
  player.spyIntel.add(target.id);
  player.cooldowns.spy = state.tick + conflict.spyCooldownTicks;
  player.lastActionTick = state.tick;
  state.stats[player.id].spyActions += 1;
  state.hourlyCounters.spies += 1;
  addHeat(state, player, 0.4, target);
  addAuditEvent(state, {
    player,
    actionType: "spy-district",
    targetDistrictId: target.id,
    targetPlayerId: target.ownerPlayerId,
    result: "intel-gained",
    heatDelta: 0.4,
    notes: target.isDowntown ? "downtown scout" : "adjacent scout"
  });
  return true;
};

const tryOccupy = (state: FreeBrSimulationState, rng: SeededRng, player: FreeBrPlayer, urgent: boolean): boolean => {
  const conflict = state.config.balance.conflict;
  if (!conflict || !isCooldownReady(state, player, "occupy")) return false;
  const candidates = getAdjacentTargets(state, player)
    .filter((district) => !district.ownerPlayerId && district.status !== "destroyed")
    .filter((district) => urgent || player.spyIntel.has(district.id) || rng.chance(0.15));
  if (candidates.length === 0) return false;
  const target = pickDistrictByValue(rng, candidates, player);
  setDistrictOwner(state, target, player.id);
  player.cooldowns.occupy = state.tick + (conflict.occupyCooldownTicks ?? conflict.spyCooldownTicks);
  player.lastActionTick = state.tick;
  state.stats[player.id].occupiedNeutralDistricts += 1;
  state.stats[player.id].districtsCaptured += 1;
  state.stats[player.id].maxControlledDistricts = Math.max(state.stats[player.id].maxControlledDistricts, getOwnedDistricts(state, player.id).length);
  state.hourlyCounters.occupations += 1;
  const heatGain = conflict.occupyHeatGain ?? 2;
  addHeat(state, player, heatGain, target);
  if (target.isDowntown) recordDowntownCapture(state, player, target.id);
  addAuditEvent(state, {
    player,
    actionType: "occupy-district",
    targetDistrictId: target.id,
    result: target.isDowntown ? "downtown-occupied" : "neutral-occupied",
    heatDelta: heatGain,
    districtDelta: 1,
    notes: player.spyIntel.has(target.id) ? "spy intel used" : "opportunistic neutral capture"
  });
  return true;
};

const tryAttack = (state: FreeBrSimulationState, rng: SeededRng, player: FreeBrPlayer, urgent: boolean): boolean => {
  const conflict = state.config.balance.conflict;
  if (!conflict || !isCooldownReady(state, player, "attack")) return false;
  const leader = findLeader(state);
  const candidates = getAdjacentTargets(state, player)
    .filter((district) => district.ownerPlayerId && district.ownerPlayerId !== player.id)
    .filter((district) => !arePlayersAllied(player, state.players.find((candidate) => candidate.id === district.ownerPlayerId)))
    .filter((district) => urgent || player.spyIntel.has(district.id) || rng.chance(0.28 + player.riskTolerance * 0.2));
  if (candidates.length === 0) return false;

  const target = pickDistrictByAttackValue(
    state,
    rng,
    candidates,
    player,
    leader,
    (targetPlayerId) => resolveAllianceAttackTargetScore(state, player, targetPlayerId, leader)
  );
  const defender = state.players.find((candidate) => candidate.id === target.ownerPlayerId) ?? null;
  if (!defender) return false;
  if (arePlayersAllied(player, defender)) return false;
  const coordinated = isAllianceCoordinatedAttack(state, player, defender.id);
  const attackPower = computeAttackPower(state, player, coordinated);
  const defensePower = computeDefensePower(state, defender, target);
  const winChance = clamp(0.12, 0.88, attackPower / Math.max(1, attackPower + defensePower) + (urgent ? 0.05 : 0));
  const won = rng.chance(winChance);
  const heatGain = conflict.attackHeatGain ?? 8;
  player.cooldowns.attack = state.tick + conflict.attackCooldownTicks;
  player.lastActionTick = state.tick;
  state.stats[player.id].attacksMade += 1;
  state.hourlyCounters.attacks += 1;
  if (target.isDowntown) state.counters.attacksOnDowntown += 1;
  if (state.finalLockdown.status === "active" || state.finalLockdown.status === "paused") {
    state.counters.attacksDuringFinalLockdown += 1;
  }
  addHeat(state, player, heatGain, target);

  if (coordinated) {
    state.counters.allianceCoordinatedAttacks += 1;
    const alliance = state.alliances.find((candidate) => candidate.id === player.allianceId);
    if (alliance) alliance.helpedActions += 1;
  }

  if (won) {
    setDistrictOwner(state, target, player.id);
    state.stats[player.id].attacksWon += 1;
    state.stats[player.id].districtsCaptured += 1;
    state.stats[defender.id].districtsLost += 1;
    state.stats[player.id].maxControlledDistricts = Math.max(state.stats[player.id].maxControlledDistricts, getOwnedDistricts(state, player.id).length);
    if (target.isDowntown) recordDowntownCapture(state, player, target.id);
  } else {
    state.stats[player.id].attacksLost += 1;
    target.heat += heatGain * 0.35;
  }

  addAuditEvent(state, {
    player,
    actionType: "attack-district",
    targetDistrictId: target.id,
    targetPlayerId: defender.id,
    result: won ? "won" : "lost",
    heatDelta: heatGain,
    districtDelta: won ? 1 : 0,
    notes: [
      target.isDowntown ? "downtown target" : "",
      defender.id === leader?.id ? "leader target" : "",
      coordinated ? "alliance-coordinated" : ""
    ].filter(Boolean).join(" · ")
  });
  return true;
};

const recordDowntownCapture = (state: FreeBrSimulationState, player: FreeBrPlayer, districtId: number): void => {
  state.counters.downtownCaptures += 1;
  state.counters.firstDowntownCapture ??= {
    tick: state.tick,
    districtId,
    playerId: player.id,
    factionId: player.factionId,
    strategyId: player.strategyId
  };
};
