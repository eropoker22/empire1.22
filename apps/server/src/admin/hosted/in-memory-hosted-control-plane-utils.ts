import {
  HOSTED_WORKER_FRESH_MS,
  type HostedWorkerHeartbeatRecord
} from "./hosted-control-plane-repository";

export const copyInMemoryHostedValue = <T>(value: T): T =>
  value == null ? value : structuredClone(value);

export const isCurrentInMemoryHostedWorker = (
  worker: HostedWorkerHeartbeatRecord | undefined,
  workerIncarnationId: string,
  at: string
) => Boolean(worker?.workerIncarnationId === workerIncarnationId && worker.status === "online" &&
  new Date(worker.lastHeartbeatAt).getTime() > new Date(at).getTime() - HOSTED_WORKER_FRESH_MS);
