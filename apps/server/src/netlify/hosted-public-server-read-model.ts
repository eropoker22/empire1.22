import type { AdminInstanceSummaryView } from "@empire/shared-types";
import type { AdminDurableRepositories } from "../admin/read-only";
import type { HostedServerRecord } from "../admin/hosted";

const PUBLIC_HEARTBEAT_MAX_AGE_MS = 60_000;

export interface HostedPublicServerCandidate {
  hosted: HostedServerRecord;
  summary: AdminInstanceSummaryView;
}

export const listHostedPublicServerCandidates = async (
  repositories: AdminDurableRepositories,
  now = new Date()
): Promise<HostedPublicServerCandidate[]> => {
  if (repositories.kind !== "postgres") {
    throw new Error("Hosted public server reads require PostgreSQL.");
  }

  const [hosted, summaries] = await Promise.all([
    repositories.hosted.listServers(),
    repositories.monitoring.listKnownInstances()
  ]);
  const summaryById = new Map(summaries.map((entry) => [entry.serverInstanceId, entry]));

  return hosted.flatMap((entry) => {
    const summary = summaryById.get(entry.serverInstanceId);
    const lastHeartbeatAt = entry.lastWorkerHeartbeatAt
      ? Date.parse(entry.lastWorkerHeartbeatAt)
      : Number.NaN;
    const ready = entry.provisioningState === "ready"
      && entry.joinPolicy === "open"
      && (entry.status === "lobby" || entry.status === "running")
      && Boolean(entry.currentSnapshotId)
      && Boolean(summary)
      && summary!.playerCount < entry.capacity
      && summary!.workerStatus === "live"
      && Number.isFinite(lastHeartbeatAt)
      && now.getTime() - lastHeartbeatAt <= PUBLIC_HEARTBEAT_MAX_AGE_MS;

    return ready && summary ? [{ hosted: entry, summary }] : [];
  });
};
