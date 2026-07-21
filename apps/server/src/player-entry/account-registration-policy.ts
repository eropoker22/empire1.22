import * as crypto from "node:crypto";
import type { AccountRegistrationPolicyView } from "@empire/shared-types";
import { ACCOUNT_PASSWORD_MINIMUM_LENGTH } from "./account-password";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/u;

export const resolveAccountRegistrationPolicy = (
  environment: Record<string, string | undefined>,
  persistenceReady: boolean
): AccountRegistrationPolicyView => {
  const production = environment.NODE_ENV === "production";
  const registrationFlag = production
    ? readBoolean(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED)
    : environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED !== "false";
  const inviteHash = normalizedInviteHash(environment);
  const inviteRequired = production || Boolean(inviteHash);
  const registrationEnabled = persistenceReady
    && registrationFlag
    && (!production || Boolean(inviteHash));

  return {
    registrationEnabled,
    inviteRequired,
    mode: registrationEnabled ? "closed_alpha" : "closed",
    passwordMinimumLength: ACCOUNT_PASSWORD_MINIMUM_LENGTH
  };
};

export const isValidClosedAlphaInvite = (
  value: unknown,
  environment: Record<string, string | undefined>
): boolean => {
  const expected = normalizedInviteHash(environment);
  if (!expected) return environment.NODE_ENV !== "production";
  const supplied = crypto.createHash("sha256").update(String(value ?? "")).digest("hex");
  return crypto.timingSafeEqual(hexBytes(supplied), hexBytes(expected));
};

const normalizedInviteHash = (environment: Record<string, string | undefined>): string | null => {
  const value = String(environment.EMPIRE_CLOSED_ALPHA_INVITE_CODE_HASH ?? "").trim().toLowerCase();
  return SHA256_HEX_PATTERN.test(value) ? value : null;
};

const readBoolean = (value: string | undefined): boolean => String(value ?? "").trim().toLowerCase() === "true";
const hexBytes = (value: string): Uint8Array => Uint8Array.from(
  value.match(/.{1,2}/gu) ?? [],
  (pair) => Number.parseInt(pair, 16)
);
