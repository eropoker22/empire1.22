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
  selectedInstanceId: string | null;
  selectedLogs: AdminOverviewLogDetailViewModel;
}

export const createAdminOverviewViewModel = (
  instances: AdminInstanceViewModel[],
  selectedLogs?: Partial<AdminOverviewLogDetailViewModel>
): AdminOverviewViewModel => {
  const selectedInstanceId = selectedLogs?.instanceId ?? instances[0]?.instanceId ?? null;

  return {
    instances,
    selectedInstanceId,
    selectedLogs: {
      instanceId: selectedInstanceId,
      commands: selectedLogs?.commands ?? [],
      events: selectedLogs?.events ?? [],
      diagnostics: selectedLogs?.diagnostics ?? []
    }
  };
};
