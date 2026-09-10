import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture, createPlayerFixture } from "../../fixtures/game-state-fixtures";
import { createEliminationReadModel } from "../../../packages/game-core/src/projections/elimination-read-model-projection";
import { createFinalLockdownReadModel } from "../../../packages/game-core/src/projections/final-lockdown-read-model-projection";
import { runFinalLockdownLifecycle } from "../../../packages/game-core/src/rules/victory/finalLockdownLifecycle";

const config = resolveModeConfig("free");
function snapshot(kind = "quiet") {
  let state = createCoreStateFixture("instance:match-overview-e2e");
  state.root.phase = "live"; state.serverInstance.status = "running";
  state.serverInstance.startedAt = kind === "ordinary" ? "2026-09-10T10:00:00.000Z" : "2026-09-10T02:40:00.000Z";
  for (let i = 2; i <= 12; i++) {
    const player = createPlayerFixture({ id: `player:${i}`, name: `Gang ${i}`, homeDistrictId: null });
    state.playersById[player.id] = player; state.root.playerIds.push(player.id);
  }
  if (kind.startsWith("final") || kind === "ended") state.finalLockdownState = {
    id: "final:fixture", serverInstanceId: state.serverInstance.id, status: kind === "final-paused" ? "paused" : "active",
    startedAtTick: 0, activeDurationTicks: config.balance.finalLockdown!.activeDurationTicks, activeElapsedTicks: 3510,
    remainingActiveTicks: 810, lastUpdatedTick: 0, pausedByQuietHours: kind === "final-paused", resolvedAtTick: null, finalTopPlayerIds: [], version: 1
  };
  if (kind === "final-active") state.serverInstance.startedAt = "2026-09-10T10:00:00.000Z";
  if (kind === "ended") {
    state.serverInstance.startedAt = "2026-09-10T10:00:00.000Z";
    state.root.tick = 1;
    state.finalLockdownState!.remainingActiveTicks = 1;
    state.finalLockdownState!.activeElapsedTicks = state.finalLockdownState!.activeDurationTicks - 1;
    state = runFinalLockdownLifecycle(state, { config }).nextState;
    if (!state.matchResult) throw new Error("Final fixture must be resolved by the server lifecycle");
  }
  if (kind === "defeated") state.playersById["player:1"].status = "defeated";
  const localConfig = structuredClone(config);
  if (kind === "disabled") { localConfig.balance.elimination!.enabled = false; localConfig.balance.finalLockdown!.enabled = false; }
  const elimination = createEliminationReadModel(state, "player:1", { config: localConfig });
  const finalLockdown = createFinalLockdownReadModel(state, "player:1", { config: localConfig });
  return { server: { serverInstanceId: state.serverInstance.id, stateVersion: state.root.version, currentTick: state.root.tick,
    status: kind === "ended" ? "ended" : kind === "paused" ? "paused" : kind === "lobby" ? "lobby" : "running", generatedAt: state.serverInstance.startedAt,
    logicalTime: kind === "stale" ? "2026-09-10T00:00:00.000Z" : state.serverInstance.startedAt, maxPlayersPerServer: 20 },
    mode: { tickRateMs: config.tickRateMs }, elimination, player: { playerId: "player:1", elimination, finalLockdown } };
}

console.log(JSON.stringify(Object.fromEntries(["quiet", "ordinary", "final-active", "final-paused", "paused", "stale", "lobby", "disabled", "defeated", "ended"].map(kind => [kind, snapshot(kind)]))));
