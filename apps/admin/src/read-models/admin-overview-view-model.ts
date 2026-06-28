import type {
  InstanceDiagnosticsSummary,
  InstanceHealthSummary,
  ServerInstanceSummary
} from "@empire/shared-types";
import type { AdminCommandLogEntry, AdminEventLogEntry, AdminDiagnosticLogEntry } from "../services";
import type { AdminInstanceViewModel } from "./admin-instance-view-model";

export interface AdminOverviewLogDetailViewModel {
  instanceId: string | null;
  commands: AdminCommandLogEntry[];
  events: AdminEventLogEntry[];
  diagnostics: AdminDiagnosticLogEntry[];
}

export interface AdminOverviewViewModel {
  instances: AdminInstanceViewModel[];
  serverSummaries: ServerInstanceSummary[];
  healthSummary: {
    totalInstances: number;
    runningInstances: number;
    crashedInstances: number;
  };
  selectedInstanceId: string | null;
  selectedHealth: InstanceHealthSummary | null;
  selectedDiagnostics: InstanceDiagnosticsSummary | null;
  selectedLogs: AdminOverviewLogDetailViewModel;
}

export const createAdminOverviewViewModel = (
  instances: AdminInstanceViewModel[],
  options: {
    serverSummaries?: ServerInstanceSummary[];
    healthSummary?: {
      totalInstances: number;
      runningInstances: number;
      crashedInstances: number;
    };
    selectedHealth?: InstanceHealthSummary | null;
    selectedDiagnostics?: InstanceDiagnosticsSummary | null;
    selectedLogs?: Partial<AdminOverviewLogDetailViewModel>;
  } = {}
): AdminOverviewViewModel => {
  const selectedInstanceId = options.selectedLogs?.instanceId ?? instances[0]?.instanceId ?? null;

  return {
    instances,
    serverSummaries: options.serverSummaries ?? [],
    healthSummary: options.healthSummary ?? {
      totalInstances: instances.length,
      runningInstances: instances.filter((instance) => instance.status === "running").length,
      crashedInstances: instances.filter((instance) => instance.status === "crashed").length
    },
    selectedInstanceId,
    selectedHealth: options.selectedHealth ?? null,
    selectedDiagnostics: options.selectedDiagnostics ?? null,
    selectedLogs: {
      instanceId: selectedInstanceId,
      commands: options.selectedLogs?.commands ?? [],
      events: options.selectedLogs?.events ?? [],
      diagnostics: options.selectedLogs?.diagnostics ?? []
    }
  };
};
