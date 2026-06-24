import type { DomainError } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import type { CommandResultRecord } from "../persistence";

/**
 * Responsibility: Structured result of applying one command inside an instance runtime.
 * Belongs here: transport-safe outcome metadata produced by orchestration boundaries.
 * Does not belong here: client projections or persistence records.
 */
export interface InstanceCommandDispatchResult {
  runtime: ServerInstanceRuntime;
  errors: DomainError[];
  commandResult?: CommandResultRecord | null;
}
