/**
 * Responsibility: Admin-readable metadata for the active mode of one instance.
 * Belongs here: mode label, config identity, and operational mode metadata.
 * Does not belong here: hidden balancing values that are not meant for admin read-models.
 */
export interface ModeSummary {
  instanceId: string;
  mode: string;
  configKey: string;
}

