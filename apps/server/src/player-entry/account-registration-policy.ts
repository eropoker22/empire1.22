import type { AccountRegistrationPolicyView } from "@empire/shared-types";
import { ACCOUNT_PASSWORD_MINIMUM_LENGTH } from "./account-password";
import { ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS } from "./account-registration-request";
import { resolveCurrentAccountTermsVersion } from "./account-terms";

export const MAX_PUBLIC_REGISTRATION_WINDOW_MS = 24 * 60 * 60 * 1_000;

export const resolveAccountRegistrationPolicy = (
  environment: Record<string, string | undefined>,
  readiness: { persistenceReady: boolean; authSecurityReady: boolean },
  now: Date = new Date()
): AccountRegistrationPolicyView => {
  const registrationFlag = environment.NODE_ENV === "production"
    ? readBoolean(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED)
    : environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED !== "false";
  const registrationExpiry = resolvePublicRegistrationExpiry(environment, now);
  const registrationWindowOpen = environment.NODE_ENV === "production"
    ? registrationExpiry.valid
    : registrationFlag;
  const termsVersion = resolveCurrentAccountTermsVersion(environment);
  const registrationEnabled = readiness.persistenceReady
    && readiness.authSecurityReady
    && registrationFlag
    && registrationWindowOpen
    && termsVersion !== null;

  return {
    registrationEnabled,
    mode: registrationEnabled ? "open" : "closed",
    expiresAt: registrationEnabled ? registrationExpiry.expiresAt : null,
    passwordMinimumLength: ACCOUNT_PASSWORD_MINIMUM_LENGTH,
    minimumAgeYears: ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS,
    termsAcceptanceRequired: true,
    termsVersion
  };
};

export const isPublicRegistrationWindowOpen = (
  environment: Record<string, string | undefined>,
  now: Date = new Date()
): boolean => {
  if (!readBoolean(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED)) return false;
  if (!isPublicRelease(environment.EMPIRE_RELEASE_ENVIRONMENT)) return true;
  return resolvePublicRegistrationExpiry(environment, now).valid;
};

/**
 * A missing expiry is the durable owner-controlled public-open mode.  An
 * explicit expiry keeps the legacy bounded-window mode available for future
 * temporary events, where the existing 24-hour upper bound still applies.
 */
const resolvePublicRegistrationExpiry = (
  environment: Record<string, string | undefined>,
  now: Date
): { valid: boolean; expiresAt: string | null } => {
  const nowMs = now.getTime();
  const expiresAtValue = String(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT ?? "").trim();
  if (!expiresAtValue) return { valid: true, expiresAt: null };
  const expiresAtMs = Date.parse(expiresAtValue);
  const valid = Number.isFinite(nowMs)
    && Number.isFinite(expiresAtMs)
    && new Date(expiresAtMs).toISOString() === expiresAtValue
    && expiresAtMs > nowMs
    && expiresAtMs <= nowMs + MAX_PUBLIC_REGISTRATION_WINDOW_MS;
  return { valid, expiresAt: valid ? expiresAtValue : null };
};

const readBoolean = (value: string | undefined): boolean => String(value ?? "").trim().toLowerCase() === "true";
const isPublicRelease = (value: string | undefined): boolean => value === "staging" || value === "production";
