import { createDistrictSummaryViews } from "@empire/game-core";
import type { DistrictSummaryView } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";

/**
 * Responsibility: Server-side projection service for district list/map summaries.
 * Belongs here: adapting authoritative state into a client-safe district collection.
 * Does not belong here: client selection state or command validation.
 */
export const createDistrictListProjection = (
  runtime: ServerInstanceRuntime,
  playerId: string
): DistrictSummaryView[] => createDistrictSummaryViews(runtime.state, playerId);
