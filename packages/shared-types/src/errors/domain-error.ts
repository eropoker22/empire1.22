/**
 * Responsibility: Minimal cross-layer error shape for predictable server responses.
 * Belongs here: stable error codes and message fields safe for transport boundaries.
 * Does not belong here: stack traces, logger sinks, or framework-specific exceptions.
 */
export interface DomainError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

