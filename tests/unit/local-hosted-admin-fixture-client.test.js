import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalHostedAdminClient } from "../../scripts/local-hosted/admin-fixture-client.mjs";

const apiOrigin = "http://127.0.0.1:8788";
const browserOrigin = "http://127.0.0.1:4174";

describe("local hosted admin fixture client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes an expired session once and retries the original request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(loginResponse("old-token"))
      .mockResolvedValueOnce(errorResponse("ADMIN_SESSION_EXPIRED"))
      .mockResolvedValueOnce(loginResponse("new-token"))
      .mockResolvedValueOnce(successResponse({ server: { serverInstanceId: "instance:1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = await createClient();
    const request = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "local-hosted-create-1"
      },
      body: JSON.stringify({ displayName: "Local Hosted Test" })
    };

    await expect(client.request("/api/admin/servers", request)).resolves.toEqual({
      server: { serverInstanceId: "instance:1" }
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1]).toEqual([
      `${apiOrigin}/api/admin/servers`,
      expect.objectContaining({
        ...request,
        headers: expect.objectContaining({
          cookie: "empire_admin_session=old-token",
          "idempotency-key": "local-hosted-create-1"
        })
      })
    ]);
    expect(fetchMock.mock.calls[3]).toEqual([
      `${apiOrigin}/api/admin/servers`,
      expect.objectContaining({
        ...request,
        headers: expect.objectContaining({
          cookie: "empire_admin_session=new-token",
          "idempotency-key": "local-hosted-create-1"
        })
      })
    ]);
  });

  it("stops after one refresh when the replacement session is also expired", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(loginResponse("old-token"))
      .mockResolvedValueOnce(errorResponse("ADMIN_SESSION_EXPIRED"))
      .mockResolvedValueOnce(loginResponse("new-token"))
      .mockResolvedValueOnce(errorResponse("ADMIN_SESSION_EXPIRED"));
    vi.stubGlobal("fetch", fetchMock);
    const client = await createClient();

    await expect(client.request("/api/admin/control-plane")).rejects.toThrow(
      "/api/admin/control-plane failed (401, ADMIN_SESSION_EXPIRED)."
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each(["ADMIN_SESSION_REVOKED", "ADMIN_SESSION_INVALID"])(
    "does not refresh for %s",
    async (code) => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(loginResponse("old-token"))
        .mockResolvedValueOnce(errorResponse(code));
      vi.stubGlobal("fetch", fetchMock);
      const client = await createClient();

      await expect(client.request("/api/admin/control-plane")).rejects.toThrow(
        `/api/admin/control-plane failed (401, ${code}).`
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  );
});

const createClient = () => createLocalHostedAdminClient({
  apiOrigin,
  browserOrigin,
  username: "Erik22",
  password: "local-test-password"
});

const loginResponse = (token) => jsonResponse(200, {
  accepted: true,
  data: { expiresAt: "2026-08-03T16:14:00.000Z" },
  errors: []
}, {
  "set-cookie": `empire_admin_session=${token}; Path=/; HttpOnly`
});

const successResponse = (data) => jsonResponse(200, {
  accepted: true,
  data,
  errors: []
});

const errorResponse = (code) => jsonResponse(401, {
  accepted: false,
  data: null,
  errors: [{ code, message: code }]
});

const jsonResponse = (status, payload, headers = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: {
    "content-type": "application/json",
    ...headers
  }
});
