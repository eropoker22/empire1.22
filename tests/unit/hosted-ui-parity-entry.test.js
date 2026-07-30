import { describe, expect, it } from "vitest";
import { shouldIgnoreHostedConsoleError } from "../e2e/helpers/hostedUiParityEntry.js";

describe("hosted UI parity console diagnostics", () => {
  it("ignores only the expected session probe and validated spawn retry statuses", () => {
    expect(shouldIgnoreHostedConsoleError({
      pathname: "/api/account/session",
      text: "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
    })).toBe(true);
    expect(shouldIgnoreHostedConsoleError({
      pathname: "/api/lobby/spawn-confirm",
      text: "Failed to load resource: the server responded with a status of 409 (Conflict)"
    })).toBe(true);
    expect(shouldIgnoreHostedConsoleError({
      pathname: "/api/gameplay-slice/submit",
      text: "Failed to load resource: the server responded with a status of 409 (Conflict)"
    })).toBe(false);
    expect(shouldIgnoreHostedConsoleError({
      pathname: "/api/lobby/spawn-confirm",
      text: "Failed to load resource: the server responded with a status of 500 (Internal Server Error)"
    })).toBe(false);
  });
});
