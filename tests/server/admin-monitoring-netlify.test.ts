import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import {
  createInMemoryAdminDurableRepositories,
  type AdminDurableRepositories
} from "../../apps/server/src/admin/read-only";
import { createAdminReadOnlyNetlifyHandler } from "../../apps/server/src/netlify/admin-read-only-netlify";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { ensureDefaultLobbyServers } from "../../apps/server/src/netlify/gameplay-slice-function-default-servers";
import { createAdminReadOnlySeed } from "../fixtures/admin-read-only-fixture";

const TEST_ENV = { NODE_ENV: "test", EMPIRE_ADMIN_BOOTSTRAP_SECRET: "correct-secret", EMPIRE_ADMIN_ROLE: "viewer" };

describe("read-only admin Netlify boundary", () => {
  it("creates a short-lived HttpOnly session and authenticates reads by cookie", async () => {
    const repositories = createInMemoryAdminDurableRepositories(createAdminReadOnlySeed());
    const handler = createAdminReadOnlyNetlifyHandler({ repositories, environment: TEST_ENV });
    const wrong = await json(handler(request("POST", "/api/admin/session", { secret: "wrong" })));
    expect(wrong.statusCode).toBe(401);
    expect(JSON.stringify(wrong.json)).not.toContain("correct-secret");

    const login = await json(handler(request("POST", "/api/admin/session", { secret: "correct-secret" })));
    expect(login.statusCode).toBe(200);
    expect(login.headers["set-cookie"]).toMatch(/HttpOnly; Path=\/api\/admin; SameSite=Strict/);
    expect(login.json.data).toMatchObject({ actorId: "admin:local", role: "viewer", authenticationMethod: "closed-alpha-bootstrap" });
    const overview = await json(handler(request("GET", "/api/admin/overview", null, cookie(login))));
    expect(overview.statusCode).toBe(200);
    expect(overview.json.data.counts).toMatchObject({ known: 2, live: 1, offline: 1, players: 7 });
  });

  it("uses Secure cookies and validates Origin in production", async () => {
    const repositories = createInMemoryAdminDurableRepositories();
    const environment = { NODE_ENV: "production", EMPIRE_ADMIN_BOOTSTRAP_ENABLED: "true", EMPIRE_ADMIN_BOOTSTRAP_SECRET: "prod-secret",
      EMPIRE_ADMIN_ACTOR_ID: "admin:owner", EMPIRE_ADMIN_DISPLAY_NAME: "Owner", EMPIRE_ADMIN_ROLE: "owner", EMPIRE_ALLOWED_ORIGINS: "https://empire.test" };
    const handler = createAdminReadOnlyNetlifyHandler({ repositories, environment });
    expect((await handler(request("POST", "/api/admin/session", { secret: "prod-secret" }))).statusCode).toBe(403);
    const login = await handler(request("POST", "/api/admin/session", { secret: "prod-secret" }, { origin: "https://empire.test" }));
    expect(login.statusCode).toBe(200);
    expect(login.headers["set-cookie"]).toContain("Secure");
  });

  it("rate limits repeated failures durably and audits authentication/access/logout", async () => {
    const repositories = createInMemoryAdminDurableRepositories(createAdminReadOnlySeed());
    const handler = createAdminReadOnlyNetlifyHandler({ repositories, environment: TEST_ENV });
    for (let index = 0; index < 5; index += 1) {
      expect((await handler(request("POST", "/api/admin/session", { secret: "wrong" }))).statusCode).toBe(401);
    }
    expect((await handler(request("POST", "/api/admin/session", { secret: "wrong" }))).statusCode).toBe(429);

    const cleanRepositories = createInMemoryAdminDurableRepositories(createAdminReadOnlySeed());
    const cleanHandler = createAdminReadOnlyNetlifyHandler({ repositories: cleanRepositories, environment: TEST_ENV });
    const login = await cleanHandler(request("POST", "/api/admin/session", { secret: "correct-secret" }));
    const headers = cookie(login);
    await cleanHandler(request("GET", "/api/admin/overview", null, headers));
    await cleanHandler(request("GET", "/api/admin/instances/server%3AA", null, headers));
    const logout = await cleanHandler(request("DELETE", "/api/admin/session", {}, headers));
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");
    expect((await cleanHandler(request("GET", "/api/admin/overview", null, headers))).statusCode).toBe(401);
    expect((await cleanRepositories.audit.list(20)).map((entry) => entry.action)).toEqual(expect.arrayContaining([
      "login-success", "overview-access", "instance-detail-access", "logout", "session-revoked"
    ]));
  });

  it("expires sessions and enforces owner-only audit reads", async () => {
    const repositories = createInMemoryAdminDurableRepositories(createAdminReadOnlySeed());
    let now = new Date("2026-07-16T10:00:00.000Z");
    const handler = createAdminReadOnlyNetlifyHandler({ repositories, environment: TEST_ENV, now: () => now });
    const login = await handler(request("POST", "/api/admin/session", { secret: "correct-secret" }));
    const headers = cookie(login);
    const forbidden = await handler(request("GET", "/api/admin/audit", null, headers));
    expect(forbidden.statusCode).toBe(403);
    now = new Date("2026-07-16T10:31:00.000Z");
    const expired = await handler(request("GET", "/api/admin/overview", null, headers));
    expect(expired.statusCode).toBe(401);
    expect(JSON.parse(expired.body).errors[0].code).toBe("ADMIN_SESSION_EXPIRED");
    expect((await repositories.audit.list(20)).map((entry) => entry.action)).toEqual(expect.arrayContaining([
      "forbidden-access", "session-expired"
    ]));
  });

  it("keeps every detail row scoped and excludes raw or secret payload keys", async () => {
    const repositories = createInMemoryAdminDurableRepositories(createAdminReadOnlySeed());
    const handler = createAdminReadOnlyNetlifyHandler({ repositories, environment: TEST_ENV });
    const login = await handler(request("POST", "/api/admin/session", { secret: "correct-secret" }));
    const detailA = await json(handler(request("GET", "/api/admin/instances/server%3AA", null, cookie(login))));
    const detailB = await json(handler(request("GET", "/api/admin/instances/server%3AB", null, cookie(login))));
    expect(detailA.json.data.players).toHaveLength(2);
    expect(detailA.json.data.districts).toHaveLength(10);
    expect(detailA.json.data.police.maxPlayerHeat).toBe(20);
    expect(detailA.json.data.commands).toHaveLength(5);
    expect(detailB.json.data.players).toHaveLength(5);
    expect(detailB.json.data.districts).toHaveLength(30);
    expect(detailB.json.data.police.maxPlayerHeat).toBe(80);
    expect(detailB.json.data.commands).toHaveLength(14);
    expect(rows(detailB.json.data).every((row) => row.serverInstanceId === "server:B")).toBe(true);
    expect(JSON.stringify(detailB.json)).not.toContain("server:A");
    expect(forbiddenKeys(JSON.stringify(detailB.json))).toEqual([]);
  });

  it("returns the same durable authority from handlers with different local registries", async () => {
    const shared = createInMemoryAdminDurableRepositories(createAdminReadOnlySeed());
    const serverA = createServerApp();
    const serverB = createServerApp();
    ensureDefaultLobbyServers(serverB);
    const handlerA = createGameplaySliceFunctionHandler({ server: serverA, adminRepositories: shared, environment: TEST_ENV });
    const handlerB = createGameplaySliceFunctionHandler({ server: serverB, adminRepositories: shared, environment: TEST_ENV });
    const login = await handlerA(event("POST", "/api/admin/session", { secret: "correct-secret" }));
    const headers = cookie(login);
    const [overviewA, overviewB, detailA, detailB] = await Promise.all([
      handlerA(event("GET", "/api/admin/overview", null, headers)), handlerB(event("GET", "/api/admin/overview", null, headers)),
      handlerA(event("GET", "/api/admin/instances/server%3AB", null, headers)), handlerB(event("GET", "/api/admin/instances/server%3AB", null, headers))
    ]);
    expect(JSON.parse(overviewA.body).data).toEqual(JSON.parse(overviewB.body).data);
    expect(JSON.parse(detailA.body).data).toEqual(JSON.parse(detailB.body).data);
    expect(serverA.instanceManager.listInstances()).toHaveLength(0);
    expect(serverB.instanceManager.listInstances().length).toBeGreaterThan(0);
  });

  it("fails production repository configuration closed and does not seed default servers", async () => {
    const server = createServerApp();
    const handler = createGameplaySliceFunctionHandler({ server, adminRepositories: createInMemoryAdminDurableRepositories(),
      environment: { NODE_ENV: "production", GAMEPLAY_SLICE_SNAPSHOT_SECRET: "snapshot", GAMEPLAY_SLICE_SESSION_SECRET: "session" } });
    const response = await handler(event("GET", "/api/admin/overview", null));
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).errors[0].code).toBe("ADMIN_CONFIGURATION_UNAVAILABLE");
    expect(server.instanceManager.listInstances()).toHaveLength(0);
  });
});

const request = (httpMethod: string, path: string, body: unknown, headers: Record<string, string> = {}) => ({
  httpMethod, path, body, headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.10", ...headers }
});
const event = (httpMethod: string, path: string, body: unknown, headers: Record<string, string> = {}) => ({
  httpMethod, path, body: body === null ? null : JSON.stringify(body), headers: { "content-type": "application/json", ...headers }
});
const cookie = (response: { headers: Record<string, string> }): Record<string, string> => ({ cookie: response.headers["set-cookie"]!.split(";")[0]! });
const json = async (response: Promise<{ statusCode: number; headers: Record<string, string>; body: string }>) => {
  const value = await response; return { ...value, json: value.body ? JSON.parse(value.body) : null };
};
const rows = (detail: Record<string, unknown>): Array<{ serverInstanceId: string }> => [
  ...(detail.players as Array<{ serverInstanceId: string }>), ...(detail.districts as Array<{ serverInstanceId: string }>),
  detail.economy as { serverInstanceId: string }, detail.production as { serverInstanceId: string }, detail.police as { serverInstanceId: string },
  detail.liveness as { serverInstanceId: string }, detail.snapshot as { serverInstanceId: string },
  ...(detail.alliances as Array<{ serverInstanceId: string }>), ...(detail.commands as Array<{ serverInstanceId: string }>),
  ...(detail.events as Array<{ serverInstanceId: string }>), ...(detail.diagnostics as Array<{ serverInstanceId: string }>)]
;
const forbiddenKeys = (serialized: string): string[] => ["payloadPreview", "rawPayload", "commandPayload", "eventPayload", "apiKey",
  "accessToken", "refreshToken", "secret", "authorization", "cookie", "password"].filter((key) => serialized.includes(`\"${key}\"`));
