import type { CoreGameState } from "@empire/game-core";
import type { InstanceSnapshotDto } from "../dto";

/**
 * Responsibility: Restores authoritative state from a validated snapshot DTO.
 * Belongs here: pure mapping from persistence snapshot shape back to core state.
 * Does not belong here: runtime scheduler creation or repository access.
 */
export const restoreInstanceState = (snapshot: InstanceSnapshotDto): CoreGameState => snapshot.state;

