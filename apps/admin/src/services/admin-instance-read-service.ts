import type {
  AlliancePopulationSummary,
  InstanceHealthSummary,
  InstanceSummary,
  ModeSummary,
  PlayerPopulationSummary
} from "@empire/shared-types";

/**
 * Responsibility: Admin read service for instance lists and instance-level population/health data.
 * Belongs here: read-only fetching contracts for monitoring views.
 * Does not belong here: gameplay logic or direct runtime mutation.
 */
export interface AdminInstanceReadService {
  listInstances(): Promise<InstanceSummary[]>;
  getModeSummary(instanceId: string): Promise<ModeSummary>;
  getPlayerPopulationSummary(instanceId: string): Promise<PlayerPopulationSummary>;
  getAlliancePopulationSummary(instanceId: string): Promise<AlliancePopulationSummary>;
  getHealthSummary(instanceId: string): Promise<InstanceHealthSummary>;
}

export const createAdminInstanceReadService = (): AdminInstanceReadService => ({
  listInstances: async () => [],
  getModeSummary: async (instanceId) => ({
    instanceId,
    mode: "unknown",
    configKey: "unknown"
  }),
  getPlayerPopulationSummary: async (instanceId) => ({
    instanceId,
    totalPlayers: 0,
    connectedPlayers: 0
  }),
  getAlliancePopulationSummary: async (instanceId) => ({
    instanceId,
    totalAlliances: 0
  }),
  getHealthSummary: async (instanceId) => ({
    instanceId,
    status: "healthy",
    warnings: [],
    lastErrorAt: null
  })
});

