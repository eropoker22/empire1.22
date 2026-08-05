import { describe, expect, it } from "vitest";
import { applyCommand, createCityChatReadModel } from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import type { GameCommand, Player } from "@empire/shared-types";
import { createCoreStateFixture, createPlayerFixture } from "../../fixtures/game-state-fixtures";

const BASE_TIME = "2026-01-01T00:00:00.000Z";

describe("server-authoritative city chat", () => {
  it("stores one server message and projects it to another player", () => {
    const state = createState();
    const result = applyCommand(
      state,
      command("player:1", "  Ahoj\n město!  "),
      context(BASE_TIME)
    );

    expect(result.errors).toEqual([]);
    expect(result.nextState.root.version).toBe(state.root.version + 1);
    expect(Object.values(result.nextState.cityChatMessagesById ?? {})).toEqual([
      expect.objectContaining({
        authorPlayerId: "player:1",
        body: "Ahoj město!",
        createdAt: BASE_TIME
      })
    ]);

    expect(createCityChatReadModel(result.nextState, "player:2")).toMatchObject({
      currentPlayerId: "player:2",
      canSend: true,
      messages: [{
        authorPlayerId: "player:1",
        authorName: "Erik",
        authorGangName: "Neon Wolves",
        authorColor: "#ec4899",
        body: "Ahoj město!"
      }]
    });
  });

  it("rate limits one author and rejects empty or oversized messages", () => {
    const state = createState();
    const sent = applyCommand(state, command("player:1", "První"), context(BASE_TIME));
    const limited = applyCommand(
      sent.nextState,
      command("player:1", "Druhá", "command:city-chat:2"),
      context("2026-01-01T00:00:01.000Z")
    );

    expect(limited.errors[0]?.code).toBe("CITY_CHAT_RATE_LIMITED");
    expect(applyCommand(state, command("player:1", " \n "), context(BASE_TIME)).errors[0]?.code)
      .toBe("CITY_CHAT_EMPTY");
    expect(applyCommand(state, command("player:1", "x".repeat(241)), context(BASE_TIME)).errors[0]?.code)
      .toBe("CITY_CHAT_TOO_LONG");
  });

  it("retains only the newest 100 server messages", () => {
    const state = createState();
    state.cityChatMessagesById = Object.fromEntries(Array.from({ length: 100 }, (_, index) => {
      const id = `city-chat:old:${index}`;
      return [id, {
        id,
        authorPlayerId: index % 2 ? "player:1" : "player:2",
        body: `Zpráva ${index}`,
        createdAt: new Date(Date.parse(BASE_TIME) + index * 2_000).toISOString(),
        version: 1
      }];
    }));

    const result = applyCommand(
      state,
      command("player:1", "Nejnovější", "command:city-chat:new"),
      context("2026-01-01T00:10:00.000Z")
    );

    const messages = Object.values(result.nextState.cityChatMessagesById ?? {});
    expect(result.errors).toEqual([]);
    expect(messages).toHaveLength(100);
    expect(messages.some((message) => message.id === "city-chat:old:0")).toBe(false);
    expect(messages.some((message) => message.body === "Nejnovější")).toBe(true);
  });
});

const createState = () => {
  const state = createCoreStateFixture();
  state.playersById["player:1"] = {
    ...state.playersById["player:1"],
    name: "Erik",
    color: "#ec4899",
    metadata: { displayName: "Erik", gangName: "Neon Wolves" }
  };
  const secondPlayer = createPlayerFixture({
    id: "player:2",
    accountId: "account:2",
    name: "Friend",
    homeDistrictId: "district:1",
    resourceStateId: "resource:2",
    cooldownStateId: "cooldown:2",
    effectStateId: "effect:2",
    policeStateId: "police:2"
  }) as Player;
  state.playersById[secondPlayer.id] = secondPlayer;
  state.root.playerIds.push(secondPlayer.id);
  return state;
};

const command = (
  playerId: string,
  body: string,
  id = "command:city-chat:1"
): GameCommand => ({
  id,
  type: "send-city-chat-message",
  mode: "free",
  playerId,
  serverInstanceId: "instance:1",
  issuedAt: BASE_TIME,
  payload: { body },
  clientRequestId: null
});

const context = (nowIso: string) => ({
  config: resolveModeConfig("free"),
  clock: {
    now: () => new Date(nowIso),
    nowIso: () => nowIso
  }
});
