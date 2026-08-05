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
  const registrationWindowOpen = environment.NODE_ENV === "production"
    ? isPublicRegistrationWindowOpen(environment, now)
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
  const nowMs = now.getTime();
  const expiresAtValue = String(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_EXPIRES_AT ?? "");
  const expiresAtMs = Date.parse(expiresAtValue);
  return Number.isFinite(nowMs)
    && Number.isFinite(expiresAtMs)
    && new Date(expiresAtMs).toISOString() === expiresAtValue
    && expiresAtMs > nowMs
    && expiresAtMs <= nowMs + MAX_PUBLIC_REGISTRATION_WINDOW_MS;
};

const readBoolean = (value: string | undefined): boolean => String(value ?? "").trim().toLowerCase() === "true";
const isPublicRelease = (value: string | undefined): boolean => value === "staging" || value === "production";
