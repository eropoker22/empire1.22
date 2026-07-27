import type { AccountRegistrationPolicyView } from "@empire/shared-types";
import { ACCOUNT_PASSWORD_MINIMUM_LENGTH } from "./account-password";
import { ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS } from "./account-registration-request";
import { resolveCurrentAccountTermsVersion } from "./account-terms";

export const resolveAccountRegistrationPolicy = (
  environment: Record<string, string | undefined>,
  readiness: { persistenceReady: boolean; authSecurityReady: boolean }
): AccountRegistrationPolicyView => {
  const registrationFlag = environment.NODE_ENV === "production"
    ? readBoolean(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED)
    : environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED !== "false";
  const termsVersion = resolveCurrentAccountTermsVersion(environment);
  const registrationEnabled = readiness.persistenceReady
    && readiness.authSecurityReady
    && registrationFlag
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

const readBoolean = (value: string | undefined): boolean => String(value ?? "").trim().toLowerCase() === "true";
