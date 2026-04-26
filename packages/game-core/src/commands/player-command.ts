import type { GameCommand } from "@empire/shared-types/commands/game-command";

/**
 * Responsibility: Core-local alias for incoming player commands.
 * Belongs here: command typing used by validators and command application.
 * Does not belong here: transport controllers or UI dispatch code.
 */
export type CorePlayerCommand = GameCommand;
