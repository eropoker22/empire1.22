import type { AccountRegistrationPolicyView } from "@empire/shared-types";
import { ACCOUNT_PASSWORD_MINIMUM_LENGTH } from "./account-password";
import { ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS } from "./account-registration-request";

export const resolveAccountRegistrationPolicy = (
  environment: Record<string, string | undefined>,
  persistenceReady: boolean
): AccountRegistrationPolicyView => {
  const registrationFlag = environment.NODE_ENV === "production"
    ? readBoolean(environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED)
    : environment.EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED !== "false";
  const registrationEnabled = persistenceReady && registrationFlag;

  return {
    registrationEnabled,
    mode: registrationEnabled ? "open" : "closed",
    passwordMinimumLength: ACCOUNT_PASSWORD_MINIMUM_LENGTH,
    minimumAgeYears: ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS
  };
};

const readBoolean = (value: string | undefined): boolean => String(value ?? "").trim().toLowerCase() === "true";
