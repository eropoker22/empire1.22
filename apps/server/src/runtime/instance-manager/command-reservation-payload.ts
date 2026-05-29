import { createHash } from "node:crypto";
import type { GameCommand } from "@empire/shared-types";

/**
 * Responsibility: Produces deterministic command payloads for reservation hashing.
 * Belongs here: server runtime idempotence helpers.
 * Does not belong here: gameplay validation or persistence implementation details.
 */
export const createCommandReservationPayload = (command: GameCommand): unknown =>
  normalizeForStableJson(command);

export const createCommandReservationPayloadHash = (command: GameCommand): string => {
  const serialized = JSON.stringify(createCommandReservationPayload(command));
  return `sha256:${createHash("sha256").update(serialized).digest("hex")}`;
};

const normalizeForStableJson = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => entry === undefined ? null : normalizeForStableJson(entry));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entry]) => [key, normalizeForStableJson(entry)])
  );
};
