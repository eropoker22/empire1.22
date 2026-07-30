import type { AdminControlPlaneAvailabilityView } from "@empire/shared-types";
import { createAdminIdempotencyKey } from "./admin-app-dom";
import { createAdminCreateController } from "./admin-create-controller";
import { adminActionLabel } from "./admin-action-confirmation-dialog-view";
import { createAdminLifecycleActionController } from "./admin-lifecycle-action-controller";
import type { AdminApiClient } from "./admin-monitoring-client";
import { createAdminRegistrationController } from "./admin-registration-controller";
import type { AdminDashboardNotice } from "./read-only-admin-page";

interface WizardState {
  wizardOpen: boolean;
  wizardStep: number;
  idempotencyKey: string | null;
}

export const createAdminAppControllers = (options: {
  client: AdminApiClient;
  target: () => HTMLElement | null;
  selectedInstanceId: () => string | null;
  selectInstance: (instanceId: string) => void;
  controlPlane: () => AdminControlPlaneAvailabilityView | null;
  actionReasons: Map<string, string>;
  wizardState: () => WizardState;
  updateWizardState: (next: Partial<WizardState>) => void;
  render: () => void;
  refresh: () => Promise<void>;
  clearAudit: () => void;
  setNotice: (notice: AdminDashboardNotice) => void;
  onServerArchived: () => void;
}) => {
  const registration = createAdminRegistrationController({
    client: options.client,
    target: options.target,
    selectedInstanceId: options.selectedInstanceId,
    controlPlane: options.controlPlane,
    actionReasons: options.actionReasons,
    render: options.render,
    refresh: options.refresh,
    createKey: createAdminIdempotencyKey,
    onActionAccepted: (instanceId, action) => {
      options.actionReasons.delete(instanceId);
      options.clearAudit();
      options.setNotice({ tone: "success", title: "Registrace serveru změněna", message: adminActionLabel(action) });
    }
  });
  const lifecycle = createAdminLifecycleActionController({
    client: options.client,
    target: options.target,
    controlPlane: options.controlPlane,
    selectedInstanceId: options.selectedInstanceId,
    actionReasons: options.actionReasons,
    createKey: createAdminIdempotencyKey,
    render: options.render,
    refresh: options.refresh,
    onAccepted: (_instanceId, action, result) => {
      options.clearAudit();
      if (action === "delete") options.onServerArchived();
      options.setNotice({
        tone: "success",
        title: action === "delete" ? "Server archivován" : "Lifecycle požadavek přijat",
        message: `${adminActionLabel(action)} · ${result.status} · ${result.actionRequestId}`
      });
    }
  });
  const creation = createAdminCreateController({
    client: options.client,
    target: options.target,
    state: options.wizardState,
    updateState: options.updateWizardState,
    selectInstance: options.selectInstance,
    render: options.render,
    refresh: options.refresh,
    createKey: createAdminIdempotencyKey,
    onCreated: (_instanceId, displayName) => {
      options.clearAudit();
      options.setNotice({
        tone: "success",
        title: "Server vytvořen",
        message: `${displayName} byl zařazen do provisioningu.`
      });
    }
  });
  return { registration, lifecycle, creation };
};
