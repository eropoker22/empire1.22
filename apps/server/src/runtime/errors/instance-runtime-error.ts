/**
 * Responsibility: Runtime-level error shape for instance lifecycle and infrastructure boundaries.
 * Belongs here: explicit error codes for manager, scheduler, and restore flows.
 * Does not belong here: raw thrown values from external libraries.
 */
export interface InstanceRuntimeError {
  code: string;
  message: string;
  instanceId?: string;
}

