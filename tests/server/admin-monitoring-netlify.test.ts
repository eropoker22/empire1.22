import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import {
  createAdminMonitoringPayload,
  handleAdminMonitoringNetlifyRequest
} from "../../apps/server/src/netlify/admin-monitoring-netlify";

describe("admin monitoring netlify guard", () => {
  it("fails closed in production when EMPIRE_ADMIN_SECRET is missing", async () => {
    const response = await readJson(
      handleAdminMonitoringNetlifyRequest(
        createServerApp(),
        { headers: {} },
        { NODE_ENV: "production" }
      )
    );

    expect(response.statusCode).toBe(403);
    expect(response.json).toEqual({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.admin_monitoring_unauthorized",
          message: "Admin monitoring is unavailable."
        }
      ]
    });
  });

  it("rejects production requests with the wrong admin secret", async () => {
    const response = await readJson(
      handleAdminMonitoringNetlifyRequest(
        createServerApp(),
        {
          headers: {
            "x-empire-admin-secret": "wrong-secret"
          }
        },
        {
          NODE_ENV: "production",
          EMPIRE_ADMIN_SECRET: "correct-secret"
        }
      )
    );

    expect(response.statusCode).toBe(403);
    expect(JSON.stringify(response.json)).not.toContain("correct-secret");
  });

  it("accepts production requests with the correct admin secret and never returns the secret", async () => {
    const response = await readJson(
      handleAdminMonitoringNetlifyRequest(
        createServerApp(),
        {
          headers: {
            "X-Empire-Admin-Secret": "correct-secret"
          }
        },
        {
          NODE_ENV: "production",
          EMPIRE_ADMIN_SECRET: "correct-secret"
        }
      )
    );

    expect(response.statusCode).toBe(200);
    expect(response.json.accepted).toBe(true);
    expect(JSON.stringify(response.json)).not.toContain("correct-secret");
  });

  it("allows non-production access without a configured secret", async () => {
    const response = await readJson(
      handleAdminMonitoringNetlifyRequest(
        createServerApp(),
        { headers: {} },
        { NODE_ENV: "test" }
      )
    );

    expect(response.statusCode).toBe(200);
    expect(response.json.accepted).toBe(true);
  });

  it("returns only admin-safe log fields in the payload", async () => {
    const payload = await createAdminMonitoringPayload(createServerApp());
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain("snapshotToken");
    expect(serialized).not.toContain("sessionToken");
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("EMPIRE_DATABASE_URL");
  });
});

const readJson = async (
  responsePromise: ReturnType<typeof handleAdminMonitoringNetlifyRequest>
) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null
  };
};
