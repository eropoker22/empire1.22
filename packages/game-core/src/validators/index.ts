import type { CorePlayerCommand } from "../commands";
import type { CoreError } from "../errors";
import type { CoreGameState } from "../entities";
import type { GameCoreContext } from "../engine";
import { validateBuildStructure } from "../validation";
import { validateCollect } from "../validation";
import { validateCraft } from "../validation";

/**
 * Responsibility: Legacy validation facade kept for compatibility with older imports.
 * Belongs here: central command-to-validator dispatch without business orchestration.
 * Does not belong here: transport auth, state mutation, or UI concerns.
 */
export const validateCommand = (
  state: CoreGameState,
  command: CorePlayerCommand,
  context: GameCoreContext
): CoreError[] => {
  switch (command.type) {
    case "build-structure":
      // Deprecated dev-only compatibility path. Main gameplay uses fixed district.buildingIds.
      return validateBuildStructure(state, command, context);
    case "collect-production":
      return validateCollect(state, command, context);
    case "craft-item":
      return validateCraft(state, command, context);
    default:
      return [];
  }
};
