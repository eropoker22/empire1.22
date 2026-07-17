import type {
  AttackDistrictCommand,
  HeistDistrictCommand,
  OccupyDistrictCommand,
  PlayerProgressionCapabilityView,
  RobDistrictCommand,
  SpyDistrictCommand
} from "@empire/shared-types";
import type { GameCoreContext } from "../../engine/context";
import type { CoreGameState } from "../../entities";
import { validateAttack } from "../../validation/validateAttack";
import { validateHeist } from "../../validation/validateHeist";
import { validateOccupy } from "../../validation/validateOccupy";
import { validateRob } from "../../validation/validateRob";
import { validateSpy } from "../../validation/validateSpy";
import { calculatePlayerFrontier, resolveAllianceCorridorRoutes } from "../map/frontier";
import { resolveCityEventCapability, resolveCollectCapability } from "./playerEconomyCapabilities";

export type PlayerProgressionCapabilities = Record<string, PlayerProgressionCapabilityView>;

interface Candidate {
  sourceDistrictId: string;
  targetDistrictId: string;
  routeDistrictId: string | null;
}

const unavailable = (reasonCode: string, evidence: string[] = []): PlayerProgressionCapabilityView => ({
  canExecuteNow: false,
  canExecuteLater: false,
  nextAvailableAtTick: null,
  reasonCode,
  sourceDistrictId: null,
  targetDistrictId: null,
  routeDistrictId: null,
  recommendedPayloadPreview: null,
  evidence
});

/**
 * The liveness projection uses minimum deterministic command payloads and the
 * exact pure validators used by gameplay ingress. It must not advertise an
 * action that its server command would reject.
 */
export const resolvePlayerProgressionCapabilities = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
): PlayerProgressionCapabilities => {
  const player = state.playersById[playerId];
  if (!player || player.status !== "active") {
    return unavailableAll(player?.status === "defeated" ? "PLAYER_DEFEATED" : "PLAYER_NOT_ACTIVE");
  }
  const candidates = resolveCandidates(state, playerId);
  const enemy = candidates.filter((candidate) => Boolean(state.districtsById[candidate.targetDistrictId]?.ownerPlayerId));
  const neutral = candidates.filter((candidate) => !state.districtsById[candidate.targetDistrictId]?.ownerPlayerId);
  const loadout = resolveMinimumAttackLoadout(state, playerId, context);
  const conflictConfig = context?.config.balance.conflict;

  return {
    spy: resolveCandidateCapability("spy", candidates, (candidate) => {
      const command: SpyDistrictCommand = {
        ...baseCommand(state, playerId, "spy-district"),
        payload: {
          districtId: candidate.targetDistrictId,
          sourceDistrictId: candidate.sourceDistrictId,
          routeDistrictId: candidate.routeDistrictId ?? undefined,
          expectedRouteVersion: candidate.routeDistrictId ? state.districtsById[candidate.routeDistrictId]?.version : undefined
        }
      };
      return { errors: validateSpy(state, command), payload: command.payload };
    }),
    attack: loadout
      ? resolveCandidateCapability("attack", enemy, (candidate) => {
          const target = state.districtsById[candidate.targetDistrictId];
          const source = state.districtsById[candidate.sourceDistrictId];
          const command: AttackDistrictCommand = {
            ...baseCommand(state, playerId, "attack-district"),
            payload: {
              districtId: candidate.targetDistrictId,
              sourceDistrictId: candidate.sourceDistrictId,
              weapons: loadout,
              expectedConflictRevision: Number(target?.conflictRevision ?? 0),
              expectedTargetVersion: target?.version,
              expectedSourceVersion: source?.version,
              routeDistrictId: candidate.routeDistrictId ?? undefined,
              expectedRouteVersion: candidate.routeDistrictId ? state.districtsById[candidate.routeDistrictId]?.version : undefined
            }
          };
          return { errors: validateAttack(state, command, context), payload: command.payload };
        })
      : unavailable("ATTACK_LOADOUT_UNAVAILABLE", ["No canonical attack loadout is affordable."]),
    heist: resolveCandidateCapability("heist", enemy, (candidate) => {
      const target = state.districtsById[candidate.targetDistrictId];
      const source = state.districtsById[candidate.sourceDistrictId];
      const minMembers = Math.max(1, Number(context?.config.balance.conflict?.heist?.styles.stealth.minMembers ?? 1));
      const command: HeistDistrictCommand = {
        ...baseCommand(state, playerId, "heist-district"),
        payload: {
          targetDistrictId: candidate.targetDistrictId,
          sourceDistrictId: candidate.sourceDistrictId,
          style: "stealth",
          gangMembersSent: minMembers,
          expectedConflictRevision: Number(target?.conflictRevision ?? 0),
          expectedTargetVersion: target?.version,
          expectedSourceVersion: source?.version,
          routeDistrictId: candidate.routeDistrictId ?? undefined,
          expectedRouteVersion: candidate.routeDistrictId ? state.districtsById[candidate.routeDistrictId]?.version : undefined
        }
      };
      return { errors: validateHeist(state, command, conflictConfig), payload: command.payload };
    }),
    rob: resolveCandidateCapability("rob", neutral, (candidate) => {
      const target = state.districtsById[candidate.targetDistrictId];
      const source = state.districtsById[candidate.sourceDistrictId];
      const command: RobDistrictCommand = {
        ...baseCommand(state, playerId, "rob-district"),
        payload: {
          targetDistrictId: candidate.targetDistrictId,
          sourceDistrictId: candidate.sourceDistrictId,
          expectedConflictRevision: Number(target?.conflictRevision ?? 0),
          expectedTargetVersion: target?.version,
          expectedSourceVersion: source?.version,
          routeDistrictId: candidate.routeDistrictId ?? undefined,
          expectedRouteVersion: candidate.routeDistrictId ? state.districtsById[candidate.routeDistrictId]?.version : undefined
        }
      };
      return { errors: validateRob(state, command, conflictConfig), payload: command.payload };
    }),
    occupy: resolveCandidateCapability("occupy", neutral, (candidate) => {
      const target = state.districtsById[candidate.targetDistrictId];
      const command: OccupyDistrictCommand = {
        ...baseCommand(state, playerId, "occupy-district"),
        payload: {
          districtId: candidate.targetDistrictId,
          sourceDistrictId: candidate.sourceDistrictId,
          expectedConflictRevision: Number(target?.conflictRevision ?? 0),
          routeDistrictId: candidate.routeDistrictId ?? undefined,
          expectedRouteVersion: candidate.routeDistrictId ? state.districtsById[candidate.routeDistrictId]?.version : undefined
        }
      };
      return { errors: validateOccupy(state, command, conflictConfig), payload: command.payload };
    }),
    "collect-production": resolveCollectCapability(state, playerId, context),
    "market-sell": unavailable("NO_CANONICAL_MARKET_SELL"),
    "start-production": unavailable("NO_CANONICAL_PRODUCTION_START"),
    "start-city-event": resolveCityEventCapability(state, playerId, context, "start"),
    "claim-city-event-reward": resolveCityEventCapability(state, playerId, context, "claim")
  };
};

const baseCommand = <TType extends string>(state: CoreGameState, playerId: string, type: TType) => ({
  id: `capability:${playerId}:${type}`,
  type,
  mode: state.serverInstance.mode,
  playerId,
  serverInstanceId: state.serverInstance.id,
  issuedAt: new Date(0).toISOString(),
  clientRequestId: null
});

const resolveCandidates = (state: CoreGameState, playerId: string): Candidate[] => {
  const frontier = calculatePlayerFrontier(state, playerId);
  const direct = [...frontier.emptyDistrictIds, ...frontier.enemyDistrictIds].flatMap((targetDistrictId) =>
    Object.values(state.districtsById)
      .filter((district) => district.ownerPlayerId === playerId
        && district.status !== "destroyed"
        && district.status !== "locked"
        && district.adjacentDistrictIds.includes(targetDistrictId))
      .map((district) => ({ sourceDistrictId: district.id, targetDistrictId, routeDistrictId: null }))
  );
  const corridors = resolveAllianceCorridorRoutes(state, playerId).map((route) => ({
    sourceDistrictId: route.sourceDistrictId,
    targetDistrictId: route.targetDistrictId,
    routeDistrictId: route.routeDistrictId
  }));
  return [...direct, ...corridors].sort((left, right) =>
    left.targetDistrictId.localeCompare(right.targetDistrictId)
    || left.sourceDistrictId.localeCompare(right.sourceDistrictId)
    || String(left.routeDistrictId ?? "").localeCompare(String(right.routeDistrictId ?? ""))
  );
};

const resolveCandidateCapability = (
  action: string,
  candidates: Candidate[],
  validate: (candidate: Candidate) => { errors: Array<{ code: string }>; payload: object }
): PlayerProgressionCapabilityView => {
  let failed: { candidate: Candidate; code: string } | null = null;
  for (const candidate of candidates) {
    const result = validate(candidate);
    if (result.errors.length === 0) {
      return {
        canExecuteNow: true,
        canExecuteLater: false,
        nextAvailableAtTick: null,
        reasonCode: null,
        sourceDistrictId: candidate.sourceDistrictId,
        targetDistrictId: candidate.targetDistrictId,
        routeDistrictId: candidate.routeDistrictId,
        recommendedPayloadPreview: result.payload as Record<string, unknown>,
        evidence: [`CANONICAL_${action.toUpperCase()}_VALIDATOR_PASSED`]
      };
    }
    failed ??= { candidate, code: String(result.errors[0]?.code || "ACTION_BLOCKED") };
  }
  return {
    ...unavailable(failed?.code ?? "NO_VALID_TARGET", failed ? [`CANONICAL_${action.toUpperCase()}_VALIDATOR_REJECTED`] : []),
    sourceDistrictId: failed?.candidate.sourceDistrictId ?? null,
    targetDistrictId: failed?.candidate.targetDistrictId ?? null,
    routeDistrictId: failed?.candidate.routeDistrictId ?? null
  };
};

const resolveMinimumAttackLoadout = (
  state: CoreGameState,
  playerId: string,
  context?: GameCoreContext
): Partial<Record<"baseball-bat" | "pistol" | "grenade" | "smg" | "bazooka", number>> | null => {
  const player = state.playersById[playerId];
  const inventory = state.resourceStatesById[player?.resourceStateId ?? ""]?.balances ?? {};
  const population = Math.max(0, Number(player?.population ?? inventory.population ?? 0));
  const weapons = context?.config.balance.attackWeapons;
  if (!weapons) return null;
  for (const weaponId of ["baseball-bat", "pistol", "grenade", "smg", "bazooka"] as const) {
    if (Number(inventory[weaponId] ?? 0) >= 1 && population >= Number(weapons[weaponId].populationRequired ?? 0)) {
      return { [weaponId]: 1 };
    }
  }
  return null;
};

const unavailableAll = (reasonCode: string): PlayerProgressionCapabilities =>
  Object.fromEntries([
    "spy", "attack", "heist", "rob", "occupy", "collect-production",
    "market-sell", "start-production", "start-city-event", "claim-city-event-reward"
  ].map((key) => [key, unavailable(reasonCode)]));
