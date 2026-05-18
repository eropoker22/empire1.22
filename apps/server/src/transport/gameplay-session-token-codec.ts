import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlayerFactionId, PlayerId, ServerInstanceId } from "@empire/shared-types";
import { systemClock, type Clock } from "../runtime/scheduling/clock";

const TOKEN_VERSION = "v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface GameplaySessionTokenPayload {
  serverInstanceId: ServerInstanceId;
  playerId: PlayerId;
  factionId?: PlayerFactionId | string | null;
  issuedAt: string;
  expiresAt: string;
}

export interface GameplaySessionTokenCodec {
  seal(payload: GameplaySessionTokenPayload): string;
  open(token: string): GameplaySessionTokenPayload | null;
}

export interface GameplaySessionTokenCodecOptions {
  secret: string;
  clock?: Clock;
}

/**
 * Responsibility: Tamper-resistant gameplay session token for server-fed slice requests.
 * Belongs here: binding player/session identity to a signed transport token.
 * Does not belong here: OAuth providers, account lookup, or gameplay rules.
 */
export const createGameplaySessionTokenCodec = (
  options: GameplaySessionTokenCodecOptions
): GameplaySessionTokenCodec => {
  const clock = options.clock ?? systemClock;

  return {
    seal: (payload) => {
      const payloadPart = toBase64Url(JSON.stringify(payload));
      const signature = signTokenPart(payloadPart, options.secret);
      return [TOKEN_VERSION, payloadPart, signature].join(".");
    },
    open: (token) => {
      const [version, payloadPart, signature] = String(token || "").split(".");
      if (version !== TOKEN_VERSION || !payloadPart || !signature) {
        return null;
      }

      const expectedSignature = signTokenPart(payloadPart, options.secret);
      if (!timingSafeEqualString(signature, expectedSignature)) {
        return null;
      }

      try {
        const parsed = JSON.parse(fromBase64Url(payloadPart));
        return isGameplaySessionTokenPayload(parsed) && !isExpired(parsed.expiresAt, clock)
          ? parsed
          : null;
      } catch (_error) {
        return null;
      }
    }
  };
};

const signTokenPart = (payloadPart: string, secret: string): string =>
  createHmac("sha256", secret)
    .update(`${TOKEN_VERSION}.${payloadPart}`)
    .digest("base64url");

const timingSafeEqualString = (left: string, right: string): boolean => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

const toBase64Url = (value: string): string =>
  bytesToBase64(encoder.encode(value))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");

const fromBase64Url = (value: string): string => {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return decoder.decode(bytes);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }

  return btoa(binary);
};

const isExpired = (expiresAt: string, clock: Clock): boolean => {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= clock.now().getTime();
};

const isGameplaySessionTokenPayload = (
  value: unknown
): value is GameplaySessionTokenPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GameplaySessionTokenPayload>;
  return (
    typeof candidate.serverInstanceId === "string" &&
    candidate.serverInstanceId.trim().length > 0 &&
    typeof candidate.playerId === "string" &&
    candidate.playerId.trim().length > 0 &&
    typeof candidate.issuedAt === "string" &&
    candidate.issuedAt.trim().length > 0 &&
    typeof candidate.expiresAt === "string" &&
    candidate.expiresAt.trim().length > 0 &&
    (
      candidate.factionId === undefined ||
      candidate.factionId === null ||
      typeof candidate.factionId === "string"
    )
  );
};
