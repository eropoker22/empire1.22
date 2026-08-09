import { resolveModeConfig } from "@empire/game-config";

export const assertLifecycleSnapshotScope = (snapshot, server, { mutate = false } = {}) => {
  if (snapshot.instanceId !== server.serverInstanceId
    || snapshot.state.root.serverInstanceId !== server.serverInstanceId
    || snapshot.state.serverInstance.id !== server.serverInstanceId
    || snapshot.mode !== "free"
    || snapshot.state.root.playerIds.length !== 20
    || Object.keys(snapshot.state.playersById).length !== 20
    || snapshot.state.serverPacingState?.eliminationEnabled !== true
    || server.registrationClosedAt === null
    || server.effectiveFinalLockdownTrigger !== 8) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_SNAPSHOT_SCOPE_INVALID");
  }
  if (mutate && (!snapshot.state.serverPacingState.registrationClosedAt
    || snapshot.state.serverPacingState.registrationBaselinePlayers !== server.registrationBaselinePlayers
    || snapshot.state.serverPacingState.effectiveFinalLockdownTrigger !== server.effectiveFinalLockdownTrigger
    || snapshot.state.serverPacingState.effectiveFirstEliminationTick !== server.effectiveFirstEliminationTick)) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_SNAPSHOT_NOT_SYNCHRONIZED");
  }
};

export const prepareQuietHoursDeferral = (source, advanceSnapshotClock) => {
  if (source.state.matchResult || source.state.finalLockdownState) {
    throw new Error("REMOTE_STAGING_LIFECYCLE_QUIET_HOURS_PHASE_INVALID");
  }
  const config = resolveModeConfig("free");
  const quietHours = config.balance.elimination?.quietHours;
  if (!quietHours?.enabled || quietHours.timeZone !== "Europe/Bratislava"
    || quietHours.startHour !== 0 || quietHours.endHour !== 6
    || quietHours.behavior !== "defer_to_window_end") {
    throw new Error("REMOTE_STAGING_LIFECYCLE_QUIET_HOURS_CONFIG_INVALID");
  }
  const isQuiet = (tick) => {
    const hour = localHourAtTick(source, tick, config.tickRateMs, quietHours.timeZone);
    return hour >= quietHours.startHour && hour < quietHours.endHour;
  };
  const maxTicks = Math.ceil((48 * 60 * 60 * 1000) / config.tickRateMs);
  let startTick = null;
  for (let tick = source.state.root.tick + 1; tick <= source.state.root.tick + maxTicks; tick += 1) {
    if (isQuiet(tick) && !isQuiet(tick - 1)) {
      startTick = tick;
      break;
    }
  }
  if (!Number.isInteger(startTick)) throw new Error("REMOTE_STAGING_LIFECYCLE_QUIET_HOURS_START_NOT_FOUND");
  let endTick = startTick + 1;
  while (endTick <= startTick + maxTicks && isQuiet(endTick)) endTick += 1;
  if (isQuiet(endTick)) throw new Error("REMOTE_STAGING_LIFECYCLE_QUIET_HOURS_END_NOT_FOUND");
  const insideTick = Math.min(endTick - 2, startTick + Math.ceil((60 * 60 * 1000) / config.tickRateMs));
  const snapshot = advanceSnapshotClock(source, startTick - 1);
  snapshot.state.eliminationState = {
    ...(snapshot.state.eliminationState ?? {
      eliminatedPlayerIds: [], eliminationCount: 0, lastEliminationTick: null
    }),
    nextEliminationTick: startTick,
    deferredFromTick: null
  };
  return {
    snapshot,
    evidence: {
      phase: "quiet-hours-deferral",
      timezone: quietHours.timeZone,
      scheduledTick: startTick,
      allowedTick: endTick,
      preparedTick: startTick - 1,
      boundaryChecks: [
        { id: "before-start", tick: startTick - 1, inQuietHours: isQuiet(startTick - 1) },
        { id: "start", tick: startTick, inQuietHours: isQuiet(startTick) },
        { id: "inside", tick: insideTick, inQuietHours: isQuiet(insideTick) },
        { id: "before-end", tick: endTick - 1, inQuietHours: isQuiet(endTick - 1) },
        { id: "end", tick: endTick, inQuietHours: isQuiet(endTick) }
      ]
    }
  };
};

const localHourAtTick = (source, tick, tickRateMs, timeZone) => {
  const startedAtMs = Date.parse(source.state.serverInstance.startedAt || new Date(0).toISOString());
  const at = new Date((Number.isFinite(startedAtMs) ? startedAtMs : 0) + (tick * tickRateMs));
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone, hour: "2-digit", hourCycle: "h23"
  }).formatToParts(at).find((part) => part.type === "hour")?.value;
  return Number.parseInt(hour ?? "0", 10);
};
