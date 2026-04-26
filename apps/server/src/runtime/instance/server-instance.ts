import type { ServerInstanceRuntime } from "./server-instance-runtime";

/**
 * Responsibility: Canonical server-side instance alias used outside runtime internals.
 * Belongs here: stable naming for the isolated authoritative instance container.
 * Does not belong here: lifecycle orchestration or persistence implementation.
 */
export type ServerInstance = ServerInstanceRuntime;

