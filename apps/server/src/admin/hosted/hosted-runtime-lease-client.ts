import * as crypto from "node:crypto";
import type { RuntimeTickLeaseFence } from "../../runtime/instance-manager/atomic-command-transaction";
import type { HostedControlPlaneRepository } from "./hosted-control-plane-repository";

type InstanceHeartbeatInput = Omit<
  Parameters<HostedControlPlaneRepository["writeInstanceHeartbeat"]>[0],
  "workerId" | "workerIncarnationId"
>;

export const createHostedRuntimeLeaseClient = (options: {
  controlPlane: HostedControlPlaneRepository;
  workerId: string;
  workerIncarnationId?: string;
  now: () => Date;
}) => {
  const workerIncarnationId = options.workerIncarnationId?.trim()
    || `worker-incarnation:${crypto.randomUUID()}`;
  const acquire = (serverInstanceId: string, now: string, expiresAt: string) =>
    options.controlPlane.acquireRuntimeLease({ serverInstanceId, workerId: options.workerId,
      workerIncarnationId, now, expiresAt });
  const release = (serverInstanceId: string, at: string) =>
    options.controlPlane.releaseRuntimeLease(serverInstanceId, options.workerId, workerIncarnationId, at);
  const writeInstanceHeartbeat = (input: InstanceHeartbeatInput) =>
    options.controlPlane.writeInstanceHeartbeat({ ...input, workerId: options.workerId, workerIncarnationId });
  const tickFence = (serverInstanceId: string): RuntimeTickLeaseFence => ({
    workerId: options.workerId,
    workerIncarnationId,
    isCurrent: () => options.controlPlane.isRuntimeLeaseCurrent({ serverInstanceId, workerId: options.workerId,
      workerIncarnationId, at: options.now().toISOString() })
  });
  return { acquire, release, tickFence, workerIncarnationId, writeInstanceHeartbeat };
};
