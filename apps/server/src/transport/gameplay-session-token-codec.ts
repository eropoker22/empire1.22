import { systemClock, type Clock } from "../runtime/scheduling/clock";
import { fromBase64Url, toBase64Url } from "./gameplay-session-token-encoding";
import {
  isGameplaySessionTokenActive,
  isGameplaySessionTokenPayload,
  type GameplaySessionTokenPayload
} from "./gameplay-session-token-payload";
import {
  signGameplaySessionTokenPart,
  timingSafeEqualString
} from "./gameplay-session-token-signing";

const TOKEN_VERSION = "v1";
export type { GameplaySessionTokenPayload } from "./gameplay-session-token-payload";

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
      const signature = signGameplaySessionTokenPart(TOKEN_VERSION, payloadPart, options.secret);
      return [TOKEN_VERSION, payloadPart, signature].join(".");
    },
    open: (token) => {
      const [version, payloadPart, signature] = String(token || "").split(".");
      if (version !== TOKEN_VERSION || !payloadPart || !signature) {
        return null;
      }

      const expectedSignature = signGameplaySessionTokenPart(TOKEN_VERSION, payloadPart, options.secret);
      if (!timingSafeEqualString(signature, expectedSignature)) {
        return null;
      }

      try {
        const parsed = JSON.parse(fromBase64Url(payloadPart));
        return isGameplaySessionTokenPayload(parsed) && isGameplaySessionTokenActive(parsed, clock)
          ? parsed
          : null;
      } catch (_error) {
        return null;
      }
    }
  };
};
