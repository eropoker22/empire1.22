import { describe, expect, it } from "vitest";
import {
  classifyHostedApiError,
  createSafeHostedApiErrorDiagnostic
} from "../../apps/server/src/bootstrap/hosted-api-error-diagnostic";

describe("hosted API safe error diagnostics", () => {
  it("distinguishes pool checkout pressure from connection establishment timeouts", () => {
    expect(classifyHostedApiError(new Error("timeout exceeded when trying to connect")))
      .toBe("pool-acquire-timeout");
    expect(classifyHostedApiError(new Error("Connection terminated due to connection timeout")))
      .toBe("connection-open-timeout");
  });

  it("classifies PostgreSQL and network error codes without logging raw messages", () => {
    const error = Object.assign(new Error("secret database detail"), { code: "57014" });
    const diagnostic = createSafeHostedApiErrorDiagnostic(error, "2026-08-01T05:34:00.000Z");

    expect(diagnostic).toContain("time=2026-08-01T05:34:00.000Z");
    expect(diagnostic).toContain("kind=statement-timeout");
    expect(diagnostic).toContain("code=57014");
    expect(diagnostic).not.toContain("secret database detail");
    expect(classifyHostedApiError(Object.assign(new Error("reset"), { code: "ECONNRESET" })))
      .toBe("network-error");
  });

  it("keeps unknown failures safely redacted", () => {
    const diagnostic = createSafeHostedApiErrorDiagnostic(
      new Error("password=do-not-log"),
      "2026-08-01T05:34:00.000Z"
    );

    expect(diagnostic).toContain("name=Error");
    expect(diagnostic).toContain("kind=unknown");
    expect(diagnostic).not.toContain("password");
    expect(diagnostic).not.toContain("do-not-log");
  });
});
