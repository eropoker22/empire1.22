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

export interface AdminInstanceReadFacade {
  listInstances(): InstanceSummary[];
  getModeSummary(instanceId: string): ModeSummary;
  getPlayerPopulationSummary(instanceId: string): PlayerPopulationSummary;
  getAlliancePopulationSummary(instanceId: string): AlliancePopulationSummary;
  getInstanceHealthSummary(instanceId: string): InstanceHealthSummary;
}

export const createAdminInstanceReadService = (options: {
  facade?: AdminInstanceReadFacade;
} = {}): AdminInstanceReadService => ({
  listInstances: async () => options.facade?.listInstances() ?? [],
  getModeSummary: async (instanceId) => options.facade?.getModeSummary(instanceId) ?? ({
    instanceId,
    mode: "unknown",
    configKey: "unknown"
  }),
  getPlayerPopulationSummary: async (instanceId) => options.facade?.getPlayerPopulationSummary(instanceId) ?? ({
    instanceId,
    totalPlayers: 0,
    connectedPlayers: 0
  }),
  getAlliancePopulationSummary: async (instanceId) => options.facade?.getAlliancePopulationSummary(instanceId) ?? ({
    instanceId,
    totalAlliances: 0
  }),
  getHealthSummary: async (instanceId) => options.facade?.getInstanceHealthSummary(instanceId) ?? ({
    instanceId,
    status: "healthy",
    warnings: [],
    lastErrorAt: null
  })
});
