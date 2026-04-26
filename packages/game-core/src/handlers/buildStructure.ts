import type { BuildStructureCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreEvent } from "../events";
import type { CoreError } from "../errors";
import { createEvent, CORE_EVENT_TYPES } from "../events";
import { placeBuilding } from "../state/mutators";
import { validateBuildStructure } from "../validation";
import type { GameCoreContext } from "../engine/context";

/**
 * Responsibility: Deprecated dev-only handler for the early build-structure vertical slice.
 * Belongs here: command-scoped orchestration for compatibility tests and tooling.
 * Does not belong here: UI dispatch or persistence.
 *
 * @deprecated Main gameplay uses fixed district.buildingIds and run-building-action.
 */
export const handleBuildStructure = (
  state: CoreGameState,
  command: BuildStructureCommand,
  context: GameCoreContext
): { nextState: CoreGameState; events: CoreEvent[]; errors: CoreError[] } => {
  const errors = validateBuildStructure(state, command, context);

  if (errors.length > 0) {
    return {
      nextState: state,
      events: [],
      errors
    };
  }

  const { nextState, building } = placeBuilding(state, command, context);

  return {
    nextState,
    events: [
      createEvent(CORE_EVENT_TYPES.buildingPlaced, {
        buildingId: building.id,
        districtId: building.districtId,
        playerId: building.ownerPlayerId,
        buildingTypeId: building.buildingTypeId
      })
    ],
    errors: []
  };
};
