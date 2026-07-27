import { entryError } from "./player-entry-error";

const TERMS_VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/u;

export const resolveCurrentAccountTermsVersion = (
  environment: Record<string, string | undefined>
): string | null => {
  const value = String(environment.EMPIRE_ACCOUNT_TERMS_VERSION ?? "").trim();
  return TERMS_VERSION_PATTERN.test(value) ? value : null;
};

export const validateAccountTermsAcceptance = (
  accepted: unknown,
  suppliedVersion: unknown,
  expectedVersion: string | null
): { termsAccepted: true; termsVersion: string } => {
  const termsVersion = String(suppliedVersion ?? "").trim();
  if (accepted !== true || !expectedVersion || termsVersion !== expectedVersion) {
    throw entryError(
      "ACCOUNT_TERMS_ACCEPTANCE_REQUIRED",
      "Pro založení účtu musíš přijmout aktuální podmínky a ochranu osobních údajů."
    );
  }
  return { termsAccepted: true, termsVersion };
};

export const validAccountTermsVersion = (value: unknown): value is string =>
  TERMS_VERSION_PATTERN.test(String(value ?? "").trim());
