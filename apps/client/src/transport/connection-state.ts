/**
 * Responsibility: Client transport readiness and reconnect state contract.
 * Belongs here: UI-safe connection status used by loading/error boundaries.
 * Does not belong here: gameplay authority or command outcomes.
 */
export interface ConnectionState {
  status: "idle" | "connecting" | "ready" | "reconnecting" | "error";
  lastErrorMessage: string | null;
  staleData: boolean;
}

