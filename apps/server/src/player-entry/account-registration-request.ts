import type { AccountRegistrationRequest } from "@empire/shared-types";
import { ACCOUNT_PASSWORD_MINIMUM_LENGTH } from "./account-password";
import { validateAccountTermsAcceptance } from "./account-terms";
import { entryError } from "./player-entry-error";
import { validGangName, validPlayerUsername } from "./player-entry-policy";

export const ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS = 16;

export const validateAccountRegistrationRequest = (
  value: unknown,
  expectedTermsVersion: string | null
): AccountRegistrationRequest => {
  if (!isRecord(value) || !onlyKeys(value, [
    "username",
    "gangName",
    "dateOfBirth",
    "password",
    "passwordConfirmation",
    "termsAccepted",
    "termsVersion"
  ])) {
    throw entryError("ACCOUNT_REGISTRATION_PAYLOAD_INVALID", "Registrace obsahuje nepovolená nebo chybějící pole.");
  }
  const username = String(value.username ?? "").normalize("NFKC").trim();
  const gangName = String(value.gangName ?? "").normalize("NFKC").trim();
  const password = String(value.password ?? "");
  const passwordConfirmation = String(value.passwordConfirmation ?? "");
  if (!validPlayerUsername(username)) {
    throw entryError("ACCOUNT_USERNAME_INVALID", "Uživatelské jméno není platné.");
  }
  if (!validGangName(gangName)) {
    throw entryError("ACCOUNT_PROFILE_INVALID", "Profil účtu není platný.");
  }
  if (password.length < ACCOUNT_PASSWORD_MINIMUM_LENGTH) {
    throw entryError(
      "ACCOUNT_PASSWORD_TOO_SHORT",
      `Heslo musí obsahovat alespoň ${ACCOUNT_PASSWORD_MINIMUM_LENGTH} znaků.`
    );
  }
  if (password.length > 1024 || passwordConfirmation.length > 1024) {
    throw entryError("ACCOUNT_REGISTRATION_PAYLOAD_INVALID", "Registrační payload je příliš dlouhý.");
  }
  const terms = validateAccountTermsAcceptance(value.termsAccepted, value.termsVersion, expectedTermsVersion);
  const request = {
    username,
    gangName,
    dateOfBirth: normalizeDateOfBirth(value.dateOfBirth),
    password,
    passwordConfirmation,
    ...terms
  };
  if (request.password !== request.passwordConfirmation) {
    throw entryError("ACCOUNT_PASSWORD_CONFIRMATION_MISMATCH", "Zadaná hesla se neshodují.");
  }
  return request;
};

export const normalizeDateOfBirth = (value: unknown): string => {
  const dateOfBirth = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateOfBirth);
  if (!match) throw entryError("ACCOUNT_DATE_OF_BIRTH_INVALID", "Zadej platné datum narození.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw entryError("ACCOUNT_DATE_OF_BIRTH_INVALID", "Zadej platné datum narození.");
  }
  return dateOfBirth;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const onlyKeys = (value: Record<string, unknown>, allowed: string[]): boolean =>
  allowed.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.includes(key));
