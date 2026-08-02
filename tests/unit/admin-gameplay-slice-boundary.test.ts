import { describe, expect, it, vi } from "vitest";
import { createInMemoryAdminDurableRepositories } from "../../apps/server/src/admin/read-only";
import { createAdminGameplaySliceBoundary } from "../../apps/server/src/netlify/admin-gameplay-slice-boundary";

describe("admin gameplay slice boundary", () => {
  it("logs a classified diagnostic without exposing the database error message", async () => {
    const repositories = createInMemoryAdminDurableRepositories();
    repositories.loginRateLimit.countRecentFailures = async () => {
      throw Object.assign(new Error("password=do-not-log"), { code: "57014" });
    };
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const handler = createAdminGameplaySliceBoundary({
        environment: { NODE_ENV: "test" },
        repositories
      });
      const response = await handler({
        httpMethod: "POST",
        path: "/api/admin/session",
        body: JSON.stringify({ username: "owner", password: "fixture-only" }),
        headers: { "content-type": "application/json" }
      });

      expect(response?.statusCode).toBe(503);
      expect(JSON.parse(response?.body ?? "{}")).toMatchObject({
        accepted: false,
        errors: [{ code: "ADMIN_DATABASE_UNAVAILABLE" }]
      });
      expect(errorLog).toHaveBeenCalledOnce();
      const diagnostic = String(errorLog.mock.calls[0]?.[0] ?? "");
      expect(diagnostic).toContain("[hosted-admin-api] request failed");
      expect(diagnostic).toContain("kind=statement-timeout");
      expect(diagnostic).toContain("code=57014");
      expect(diagnostic).not.toContain("password");
      expect(diagnostic).not.toContain("do-not-log");
    } finally {
      errorLog.mockRestore();
    }
  });
});
