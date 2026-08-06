import { describe, expect, it } from "vitest";
import { validateAccountRegistrationRequest } from "../../apps/server/src/player-entry/account-registration-request";
import { entryErrorCode } from "../../apps/server/src/player-entry/player-entry-error";

const TERMS_VERSION = "closed-alpha-internal-v1";

describe("account registration request", () => {
  it("normalizes supported identity fields and requires current terms", () => {
    expect(validateAccountRegistrationRequest({
      username: "  ＡlphaBoss  ",
      gangName: "  Alpha Gang  ",
      dateOfBirth: "1990-04-12",
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
      termsAccepted: true,
      termsVersion: TERMS_VERSION
    }, TERMS_VERSION)).toEqual({
      username: "AlphaBoss",
      gangName: "Alpha Gang",
      dateOfBirth: "1990-04-12",
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
      termsAccepted: true,
      termsVersion: TERMS_VERSION
    });
  });

  it("rejects missing and unknown fields", () => {
    expect(captureCode(() => validateAccountRegistrationRequest({}, TERMS_VERSION)))
      .toBe("ACCOUNT_REGISTRATION_PAYLOAD_INVALID");
    expect(captureCode(() => validateAccountRegistrationRequest({
      username: "AlphaBoss",
      gangName: "Alpha Gang",
      dateOfBirth: "1990-04-12",
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      unexpected: true
    }, TERMS_VERSION))).toBe("ACCOUNT_REGISTRATION_PAYLOAD_INVALID");
  });

  it.each([
    { username: 12345 },
    { gangName: ["Alpha Gang"] },
    { dateOfBirth: { value: "1990-04-12" } },
    { password: 123456789012 },
    { passwordConfirmation: 123456789012 },
    { termsVersion: 1 }
  ])("rejects coerced registration field types: %#", (override) => {
    expect(captureCode(() => validateAccountRegistrationRequest({
      username: "AlphaBoss",
      gangName: "Alpha Gang",
      dateOfBirth: "1990-04-12",
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      ...override
    }, TERMS_VERSION))).toBe("ACCOUNT_REGISTRATION_PAYLOAD_INVALID");
  });

  it.each([
    [{ username: "" }, "ACCOUNT_USERNAME_INVALID"],
    [{ username: "bad name" }, "ACCOUNT_USERNAME_INVALID"],
    [{ gangName: "<script>" }, "ACCOUNT_PROFILE_INVALID"],
    [{ dateOfBirth: "2026-02-30" }, "ACCOUNT_DATE_OF_BIRTH_INVALID"],
    [{ password: "short", passwordConfirmation: "short" }, "ACCOUNT_PASSWORD_TOO_SHORT"],
    [{ passwordConfirmation: "different-password" }, "ACCOUNT_PASSWORD_CONFIRMATION_MISMATCH"],
    [{ termsAccepted: false }, "ACCOUNT_TERMS_ACCEPTANCE_REQUIRED"],
    [{ termsVersion: "stale-version" }, "ACCOUNT_TERMS_ACCEPTANCE_REQUIRED"]
  ])("rejects invalid payload %#", (override, expectedCode) => {
    expect(captureCode(() => validateAccountRegistrationRequest({
      username: "AlphaBoss",
      gangName: "Alpha Gang",
      dateOfBirth: "1990-04-12",
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      ...override
    }, TERMS_VERSION))).toBe(expectedCode);
  });

  it("rejects extreme password payloads before hashing", () => {
    const password = "x".repeat(1025);
    expect(captureCode(() => validateAccountRegistrationRequest({
      username: "AlphaBoss",
      gangName: "Alpha Gang",
      dateOfBirth: "1990-04-12",
      password,
      passwordConfirmation: password,
      termsAccepted: true,
      termsVersion: TERMS_VERSION
    }, TERMS_VERSION))).toBe("ACCOUNT_REGISTRATION_PAYLOAD_INVALID");
  });
});

const captureCode = (operation: () => unknown): string => {
  try {
    operation();
    return "NO_ERROR";
  } catch (error) {
    return entryErrorCode(error);
  }
};
