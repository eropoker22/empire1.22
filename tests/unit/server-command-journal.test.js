import { describe, expect, it } from "vitest";
import {
  createServerCommandJournal,
  createServerGameplayCommandId
} from "../../page-assets/js/app/runtime/serverCommandJournal.js";

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  };
};

const scope = { playerId: "player:1", serverInstanceId: "instance:1" };
const request = {
  command: {
    id: "command:journal:1",
    type: "attack-district",
    playerId: "player:1",
    serverInstanceId: "instance:1",
    payload: { districtId: "district:2" }
  }
};

describe("server command journal", () => {
  it("creates a command id once and preserves the same immutable intent for retry", () => {
    const journal = createServerCommandJournal({ storage: createStorage() });
    const prepared = journal.prepare({
      ...scope,
      commandId: request.command.id,
      commandType: request.command.type,
      payload: request.command.payload,
      request
    });
    const replay = journal.prepare({
      ...scope,
      commandId: request.command.id,
      commandType: "heist-district",
      payload: { targetDistrictId: "district:9" },
      request: { command: { ...request.command, type: "heist-district" } }
    });

    expect(prepared.commandId).toBe(request.command.id);
    expect(replay).toEqual(prepared);
    expect(replay.request.command).toEqual(request.command);
  });

  it("persists ambiguous commands only within their player and instance scope", () => {
    const storage = createStorage();
    const journal = createServerCommandJournal({ storage });
    journal.prepare({
      ...scope,
      commandId: request.command.id,
      commandType: request.command.type,
      payload: request.command.payload,
      request
    });
    journal.beginSubmit(scope, request.command.id, "2026-07-16T00:00:00.000Z");
    journal.markAmbiguous(scope, request.command.id, "NETWORK_ERROR");

    const restored = createServerCommandJournal({ storage });
    expect(restored.get(scope, request.command.id)).toMatchObject({
      status: "ambiguous",
      attemptCount: 1,
      lastErrorCode: "NETWORK_ERROR",
      request
    });
    expect(restored.list({ playerId: "player:2", serverInstanceId: "instance:1" })).toEqual([]);
  });

  it("keeps an ambiguous command until lookup reaches a terminal result", () => {
    const journal = createServerCommandJournal({ storage: createStorage() });
    journal.prepare({
      ...scope,
      commandId: request.command.id,
      commandType: request.command.type,
      payload: request.command.payload,
      request
    });
    journal.markAmbiguous(scope, request.command.id);
    expect(journal.get(scope, request.command.id)?.status).toBe("ambiguous");

    journal.markTerminal(scope, request.command.id, "applied");
    expect(journal.get(scope, request.command.id)?.status).toBe("applied");
    journal.discardTerminal(scope);
    expect(journal.get(scope, request.command.id)).toBeNull();
  });

  it("generates collision-resistant browser command ids without Math.random", () => {
    expect(createServerGameplayCommandId("command:test")).not.toBe(createServerGameplayCommandId("command:test"));
  });
});
