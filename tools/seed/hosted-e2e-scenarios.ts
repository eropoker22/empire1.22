import { resolveModeConfig } from "@empire/game-config";
import type { InstanceSnapshotDto } from "../../apps/server/src/runtime/persistence";

export const HOSTED_E2E_SCENARIOS = [
  "realistic-new-player",
  "city-events"
] as const;

export type HostedE2eScenario = typeof HOSTED_E2E_SCENARIOS[number];

export const applyHostedE2eScenario = (
  source: InstanceSnapshotDto,
  scenario: HostedE2eScenario,
  createdAt: string
): InstanceSnapshotDto => {
  const snapshot = structuredClone(source);
  if (scenario === "city-events") {
    const config = resolveModeConfig(snapshot.state.serverInstance.mode);
    const cityEventStartTick = config.balance.dayNight!.phases.day.durationTicks;
    snapshot.state.root.tick = cityEventStartTick;
    snapshot.state.serverInstance.currentTick = cityEventStartTick;
    snapshot.state.playerCityEventStatesByPlayerId = {};
    snapshot.runtime.commandRateLimitWindow = {
      tick: cityEventStartTick,
      commandCountsByPlayerId: {}
    };
  }
  snapshot.state.root.version += 1;
  snapshot.tick = snapshot.state.root.tick;
  snapshot.integrity.rootVersion = snapshot.state.root.version;
  snapshot.createdAt = createdAt;
  snapshot.snapshotId = [
    "snapshot",
    snapshot.instanceId,
    snapshot.tick,
    snapshot.integrity.rootVersion
  ].join(":");
  return snapshot;
};

export const isHostedE2eScenario = (value: string): value is HostedE2eScenario =>
  HOSTED_E2E_SCENARIOS.includes(value as HostedE2eScenario);
