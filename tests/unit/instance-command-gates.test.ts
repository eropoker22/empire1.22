import type { GameCommand } from "@empire/shared-types";
import { describe, expect, it } from "vitest";
import { usesEntityConflictRevalidation } from "../../apps/server/src/runtime/instance-manager/instance-command-gates";

const commandOfType = (type: GameCommand["type"]): GameCommand => ({ type } as GameCommand);

describe("instance command conflict gates", () => {
  it.each([
    "cancel-drug-lab-production",
    "cancel-pharmacy-production",
    "cancel-production-line",
    "collect-production",
    "craft-item",
    "invite-alliance-member",
    "start-city-event",
    "claim-city-event-reward",
    "respond-alliance-invite",
    "send-alliance-chat-message",
    "send-city-chat-message",
    "upgrade-building"
  ] as const)("revalidates %s against its current entity state", (type) => {
    expect(usesEntityConflictRevalidation(commandOfType(type))).toBe(true);
  });

  it("keeps global version checks for unrelated commands", () => {
    expect(usesEntityConflictRevalidation(commandOfType("build-structure"))).toBe(false);
  });
});
