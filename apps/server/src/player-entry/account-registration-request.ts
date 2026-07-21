import type { AccountRegistrationRequest } from "@empire/shared-types";
import { entryError } from "./player-entry-error";

export const ACCOUNT_REGISTRATION_MINIMUM_AGE_YEARS = 16;

export const validateAccountRegistrationRequest = (value: unknown): AccountRegistrationRequest => {
  if (!isRecord(value) || !onlyKeys(value, ["username", "gangName", "dateOfBirth", "password", "passwordConfirmation"])) {
    throw entryError("ACCOUNT_REGISTRATION_PAYLOAD_INVALID", "Registrace obsahuje nepovolená nebo chybějící pole.");
  }
  const request = {
    username: String(value.username ?? "").trim(),
    gangName: String(value.gangName ?? "").trim(),
    dateOfBirth: normalizeDateOfBirth(value.dateOfBirth),
    password: String(value.password ?? ""),
    passwordConfirmation: String(value.passwordConfirmation ?? "")
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
