import { describe, expect, it } from "vitest";
import { applyCommand } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCombatStateFixture } from "../../fixtures/game-state-fixtures";
import { createAttackDistrictCommandFixture, createSpyDistrictCommandFixture } from "../../fixtures/command-fixtures";
import { resolvePendingDistrictAction } from "../../fixtures/timed-operation-fixtures";
import { createExecutionMetrics } from "../../../tools/debug/src/full-game-20p-matrix/executor";
import { recordResolvedSimulationEvents } from "../../../tools/debug/src/full-game-20p-matrix/resolved-outcomes";

describe("full game simulation measures resolved actions", () => {
  it.each([createAttackDistrictCommandFixture, createSpyDistrictCommandFixture])("waits for actual worker results", createCommand => {
    const context = { config: resolveModeConfig("free") };
    const metrics = createExecutionMetrics();
    const state = createCombatStateFixture();
    const command = createCommand();
    if (command.type === "spy-district") {
      state.notificationsById = {};
      state.root.notificationIds = [];
    }
    const started = applyCommand(state, command, context);
    expect(started.errors).toEqual([]);
    recordResolvedSimulationEvents(metrics, started.events);
    expect(metrics.outcomesByPlayer["player:1"]).toBeUndefined();
    const resolved = resolvePendingDistrictAction(started.nextState, context);
    recordResolvedSimulationEvents(metrics, resolved.events);
    const outcomes = metrics.outcomesByPlayer["player:1"];
    const event = resolved.events.find(entry => ["district-attacked", "district-spied"].includes(entry.type))!;
    const payload = event.payload as Record<string, unknown>;
    if (event.type === "district-attacked") {
      expect((outcomes.attacksWon ?? 0) + (outcomes.attacksLost ?? 0)).toBe(1);
      expect(outcomes.attacksWon ?? 0).toBe(payload.attackSucceeded ? 1 : 0);
    } else {
      expect((outcomes.spySuccesses ?? 0) + (outcomes.spyFailures ?? 0)).toBe(1);
      expect(outcomes.spySuccesses ?? 0).toBe(payload.result === "success" ? 1 : 0);
    }
  });
});
