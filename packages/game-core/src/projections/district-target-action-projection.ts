import type { DistrictPanelView } from "@empire/shared-types";
import type {
  ConflictBalanceConfig,
  ResolvedGameModeConfig
} from "../contracts";
import type { CoreGameState } from "../entities/game-state";
import { resolveDistrictRelation } from "../rules";
import {
  hasValidAttackAuthorization,
  validateOccupyEmptyDistrictAuthorization
} from "../validation/spyIntel";
import { createDistrictAttackTargetViews } from "./district-attack-target-projection";
import {
  createDistrictHeistTargetViews,
  createDistrictRobTargetViews
} from "./district-basic-action-projection";
import { createDistrictOccupyTargetViews } from "./district-occupy-target-projection";
import { createDistrictSpyTargetViews } from "./district-spy-target-projection";

type TargetActions = NonNullable<DistrictPanelView["targetActions"]>;
type ActionTarget = {
  sourceDistrictId: string;
  districtId: string;
  enabled: boolean;
};

export interface OpenedDistrictTargetActionInput {
  playerId: string;
  targetDistrictId: string;
  issuedAt: string;
  config?: ResolvedGameModeConfig;
  conflictConfig?: ConflictBalanceConfig;
}

export const createOpenedDistrictTargetActions = (
  state: CoreGameState,
  input: OpenedDistrictTargetActionInput
): TargetActions => {
  const empty = createEmptyTargetActions();
  const player = state.playersById[input.playerId];
  const target = state.districtsById[input.targetDistrictId];

  if (!player || !target) {
    return empty;
  }

  const sourceDistrictIds = findOwnedAdjacentActionSources(
    state,
    input.playerId,
    target.id
  );
  if (sourceDistrictIds.length === 0) {
    return empty;
  }

  const relation = resolveDistrictRelation(state, player, target);
  if (relation === "empty") {
    const occupyAuthorization = validateOccupyEmptyDistrictAuthorization(
      state,
      input.playerId,
      target.id
    );

    return {
      attackTargets: [],
      heistTargets: [],
      robTargets: selectPreferredTarget(sourceDistrictIds, target.id, (sourceDistrictId) =>
        createDistrictRobTargetViews(
          state,
          input.playerId,
          sourceDistrictId,
          input.conflictConfig,
          input.issuedAt,
          {
            dayLengthTicks: input.config?.balance.dayLengthTicks,
            nightLengthTicks: input.config?.balance.nightLengthTicks
          }
        )
      ),
      spyTargets: occupyAuthorization === true
        ? []
        : selectPreferredTarget(sourceDistrictIds, target.id, (sourceDistrictId) =>
            createDistrictSpyTargetViews(
              state,
              input.playerId,
              sourceDistrictId,
              input.issuedAt,
              input.conflictConfig
            )
          ),
      occupyTargets: occupyAuthorization === true
        ? selectPreferredTarget(sourceDistrictIds, target.id, (sourceDistrictId) =>
            createDistrictOccupyTargetViews(
              state,
              input.playerId,
              sourceDistrictId,
              input.conflictConfig,
              input.issuedAt
            )
          )
        : []
    };
  }

  if (relation === "enemy") {
    const attackAuthorizationActive = hasValidAttackAuthorization(
      state,
      input.playerId,
      target.id
    );

    return {
      attackTargets: selectPreferredTarget(sourceDistrictIds, target.id, (sourceDistrictId) =>
        createDistrictAttackTargetViews(
          state,
          input.playerId,
          sourceDistrictId,
          input.issuedAt,
          input.config
        )
      ),
      heistTargets: selectPreferredTarget(sourceDistrictIds, target.id, (sourceDistrictId) =>
        createDistrictHeistTargetViews(
          state,
          input.playerId,
          sourceDistrictId,
          input.conflictConfig,
          input.issuedAt
        )
      ),
      robTargets: [],
      spyTargets: attackAuthorizationActive
        ? []
        : selectPreferredTarget(sourceDistrictIds, target.id, (sourceDistrictId) =>
            createDistrictSpyTargetViews(
              state,
              input.playerId,
              sourceDistrictId,
              input.issuedAt,
              input.conflictConfig
            )
          ),
      occupyTargets: []
    };
  }

  return empty;
};

const createEmptyTargetActions = (): TargetActions => ({
  attackTargets: [],
  spyTargets: [],
  occupyTargets: [],
  robTargets: [],
  heistTargets: []
});

const findOwnedAdjacentActionSources = (
  state: CoreGameState,
  playerId: string,
  targetDistrictId: string
): string[] => {
  const target = state.districtsById[targetDistrictId];
  if (!target) return [];

  return Object.values(state.districtsById)
    .filter((candidate) =>
      candidate.ownerPlayerId === playerId
      && candidate.status !== "destroyed"
      && candidate.status !== "locked"
      && candidate.adjacentDistrictIds.includes(target.id)
      && target.adjacentDistrictIds.includes(candidate.id)
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((candidate) => candidate.id);
};

const selectPreferredTarget = <TTarget extends ActionTarget>(
  sourceDistrictIds: string[],
  targetDistrictId: string,
  createTargets: (sourceDistrictId: string) => TTarget[]
): TTarget[] => {
  const candidates = sourceDistrictIds
    .flatMap((sourceDistrictId) => createTargets(sourceDistrictId))
    .filter((candidate) => candidate.districtId === targetDistrictId)
    .sort((left, right) =>
      Number(right.enabled) - Number(left.enabled)
      || left.sourceDistrictId.localeCompare(right.sourceDistrictId)
    );

  return candidates[0] ? [candidates[0]] : [];
};
