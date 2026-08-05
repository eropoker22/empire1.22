import { describe, expect, it, vi } from "vitest";
import { createGameplaySessionTokenCodec } from "../../apps/server/src/transport/gameplay-session-token-codec";
import { withPublicRequestDiagnostics } from "../../apps/server/src/netlify/public-request-diagnostic";
import { createJsonResponse } from "../../apps/server/src/netlify/netlify-json-response";

const SHA = "a".repeat(40);

describe("public request diagnostics", () => {
  it("logs safe request metadata and hashes identity from a signed gameplay session", async () => {
    const codec = createGameplaySessionTokenCodec({ secret: "request-diagnostic-secret-with-at-least-32-characters" });
    const token = codec.seal({
      sessionId: "session:private",
      accountId: "account:private",
      serverInstanceId: "instance:free:private",
      playerId: "player:private",
      issuedAt: new Date(Date.now() - 1_000).toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      version: 1
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    let performanceTick = 100;

    try {
      const handler = withPublicRequestDiagnostics(
        async () => createJsonResponse(200, {
          accepted: false,
          errors: [{ code: "SPY_INTEL_ALREADY_ACTIVE", message: "not logged" }]
        }),
        {
          environment: {
            EMPIRE_BUILD_SHA: SHA,
            EMPIRE_RELEASE_ENVIRONMENT: "staging",
            EMPIRE_RUNTIME_REGION: "fra"
          },
          sessionTokenCodec: codec,
          now: () => new Date("2026-08-05T12:00:00.000Z"),
          performanceNow: () => (performanceTick += 25)
        }
      );
      const response = await handler({
        httpMethod: "post",
        path: "/api/gameplay-slice/submit?password=must-not-log",
        body: JSON.stringify({ password: "must-not-log" }),
        headers: {
          cookie: `empire_gameplay_session=${token}`,
          "x-request-id": "request:accepted-123"
        }
      });

      expect(response.headers["x-request-id"]).toBe("request:accepted-123");
      expect(log).toHaveBeenCalledOnce();
      const serialized = String(log.mock.calls[0]?.[0] ?? "");
      const entry = JSON.parse(serialized);
      expect(entry).toMatchObject({
        timestamp: "2026-08-05T12:00:00.000Z",
        level: "warn",
        event: "http_request",
        component: "netlify-api",
        requestId: "request:accepted-123",
        method: "POST",
        route: "/api/gameplay-slice/submit",
        status: 200,
        durationMs: 25,
        buildSha: SHA,
        workerId: null,
        environment: "staging",
        region: "fra",
        errorCode: "SPY_INTEL_ALREADY_ACTIVE"
      });
      expect(entry.serverInstanceHash).toMatch(/^[0-9a-f]{16}$/u);
      expect(entry.playerHash).toMatch(/^[0-9a-f]{16}$/u);
      expect(serialized).not.toContain("private");
      expect(serialized).not.toContain(token);
      expect(serialized).not.toContain("must-not-log");
      expect(serialized).not.toContain("not logged");
    } finally {
      log.mockRestore();
    }
  });

  it("uses a safe unknown route and generic code for an unhandled error", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const handler = withPublicRequestDiagnostics(
        async () => { throw new Error("password=must-not-log"); },
        {
          environment: {},
          sessionTokenCodec: null,
          now: () => new Date("2026-08-05T12:00:00.000Z"),
          performanceNow: () => 10
        }
      );
      await expect(handler({
        httpMethod: "GET",
        path: "/private/value?token=must-not-log",
        body: null
      })).rejects.toThrow("must-not-log");

      const serialized = String(log.mock.calls[0]?.[0] ?? "");
      expect(JSON.parse(serialized)).toMatchObject({
        route: "unknown",
        status: 500,
        level: "error",
        errorCode: "UNHANDLED_REQUEST_ERROR",
        serverInstanceHash: null,
        playerHash: null
      });
      expect(serialized).not.toContain("must-not-log");
    } finally {
      log.mockRestore();
    }
  });
});
