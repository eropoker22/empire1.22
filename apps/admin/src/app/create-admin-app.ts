import { createAdminAppShell } from "./admin-app-shell";
import { createAdminCommandDispatcher } from "../commands";
import {
  createAdminInstanceReadService,
  createAdminLogReadService,
  createAdminSnapshotReadService,
  createAdminDiagnosticsReadService
} from "../services";

/**
 * Responsibility: Composition root for the admin application.
 * Belongs here: wiring read services and command boundaries for admin UI modules.
 * Does not belong here: direct gameplay state access or server authority logic.
 */
export const createAdminApp = () => {
  const instanceReadService = createAdminInstanceReadService();
  const logReadService = createAdminLogReadService();
  const snapshotReadService = createAdminSnapshotReadService();
  const diagnosticsReadService = createAdminDiagnosticsReadService();
  const adminCommandDispatcher = createAdminCommandDispatcher({
    execute: (_command) => {
      return;
    }
  });

  return createAdminAppShell({
    mount: () => {
      void instanceReadService.listInstances();
      void logReadService.getCommandVolumeSummary("instance:placeholder");
      void snapshotReadService.getSnapshotSummary("instance:placeholder");
      void diagnosticsReadService.getDiagnosticsSummary("instance:placeholder");
      void adminCommandDispatcher.dispatch({
        id: "noop",
        type: "inspect-logs",
        instanceId: "instance:placeholder",
        issuedAt: new Date(0).toISOString(),
        actorAdminId: "admin:placeholder",
        payload: {
          limit: 0
        }
      });
    }
  });
};

