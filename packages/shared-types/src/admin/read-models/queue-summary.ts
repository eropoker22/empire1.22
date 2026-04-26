/**
 * Responsibility: Admin-safe summary of queue sizes and backlog indicators.
 * Belongs here: event/command queue health used for diagnostics.
 * Does not belong here: queue implementations or runtime-only buffers.
 */
export interface QueueSummary {
  instanceId: string;
  queuedEvents: number;
  queuedCommands: number;
}

