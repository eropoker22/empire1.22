import * as crypto from "node:crypto";
import type {
  AdminAuditEntryView,
  AdminLifecycleActionRequestView,
  AdminLifecycleActionResultView,
  AdminSessionView
} from "@empire/shared-types";
import type { HostedControlPlaneRepository } from "./hosted-control-plane-repository";

export const archiveHostedServer = async (input: {
  repository: HostedControlPlaneRepository;
  session: AdminSessionView;
  serverInstanceId: string;
  action: AdminLifecycleActionRequestView;
  idempotencyKey: string;
  requestHash: string;
  at: string;
  audit: AdminAuditEntryView;
}) => {
  const actionRequestId = `hosted-archive:${crypto.randomUUID()}`;
  const result = await input.repository.archiveServerTransaction({
    serverInstanceId: input.serverInstanceId,
    adminUserId: input.session.adminUserId,
    expectedVersion: input.action.expectedVersion,
    actionRequestId,
    idempotencyKey: input.idempotencyKey,
    requestHash: input.requestHash,
    at: input.at,
    audit: input.audit
  });
  if (result.kind === "not-found") return reject("ADMIN_INSTANCE_NOT_FOUND", "Admin instance was not found.");
  if (result.kind === "operation-active") {
    return reject("SERVER_LIFECYCLE_OPERATION_ACTIVE", "Server právě dokončuje jinou lifecycle operaci.");
  }
  if (result.kind === "stale-version") {
    return reject("ADMIN_STALE_VERSION", "Server version changed. Refresh before retrying.");
  }
  if (result.kind === "conflict") {
    return reject("ADMIN_IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different request.");
  }
  return accept<AdminLifecycleActionResultView>({
    replayed: result.kind === "replayed",
    actionRequestId: result.actionRequestId,
    serverInstanceId: input.serverInstanceId,
    action: "delete",
    status: "completed",
    expectedVersion: input.action.expectedVersion
  });
};

const accept = <T>(data: T) => ({ accepted: true as const, data, errors: [] as [] });
const reject = (code: string, message: string) => ({
  accepted: false as const,
  data: null,
  errors: [{ code, message }]
});
