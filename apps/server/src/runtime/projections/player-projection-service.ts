import { createPlayerView } from "@empire/game-core";
import type { PlayerView } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

/**
 * Responsibility: Server-side projection service for player-facing views.
 * Belongs here: composition of core projections with instance runtime context.
 * Does not belong here: client rendering or state mutation.
 */
export const createPlayerProjection = (
  runtime: ServerInstanceRuntime,
  playerId: string
): PlayerView => createPlayerView(runtime.state, playerId, { config: runtime.config });
