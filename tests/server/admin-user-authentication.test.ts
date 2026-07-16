import { describe, expect, it } from "vitest";
import {
  createAdminSessionService,
  createInMemoryAdminDurableRepositories,
  hashAdminPassword,
  normalizeAdminUsername,
  verifyAdminPassword,
  type AdminUserRecord
} from "../../apps/server/src/admin/read-only";

const PASSWORD = "TestPassword-Only-For-Fixtures";
const ENV = { NODE_ENV: "test", EMPIRE_ADMIN_FINGERPRINT_SECRET: "test-fingerprint-secret-at-least-32-characters" };

describe("durable admin user authentication", () => {
  it("uses salted scrypt hashes and timing-safe verification", async () => {
    const first = await hashAdminPassword(PASSWORD);
    const second = await hashAdminPassword(PASSWORD);
    expect(first.passwordAlgorithm).toBe("scrypt");
    expect(first.passwordHash).not.toBe(PASSWORD);
    expect(first.passwordSalt).not.toBe(second.passwordSalt);
    expect(first.passwordHash).not.toBe(second.passwordHash);
    expect(await verifyAdminPassword(PASSWORD, user(first))).toBe(true);
    expect(await verifyAdminPassword("WrongPassword-Only-For-Test", user(first))).toBe(false);
  });

  it.each(["disabled", "locked"] as const)("rejects a %s account with the generic response", async (status) => {
    const repositories = createInMemoryAdminDurableRepositories({ users: [user(await hashAdminPassword(PASSWORD), status)] });
    const service = createAdminSessionService({ repositories, environment: ENV });
    const result = await service.login({ username: "TestOwner", password: PASSWORD, fingerprint: "192.0.2.1", correlationId: "request:1" });
    expect(result.accepted).toBe(false);
    expect(result.errors[0]).toMatchObject({ code: "ADMIN_AUTH_INVALID", message: "Přihlášení se nezdařilo." });
  });

  it("revokes existing sessions after password rotation", async () => {
    const repositories = createInMemoryAdminDurableRepositories({ users: [user(await hashAdminPassword(PASSWORD))] });
    const service = createAdminSessionService({ repositories, environment: ENV });
    const login = await service.login({ username: "TestOwner", password: PASSWORD, fingerprint: "192.0.2.1", correlationId: "request:1" });
    expect(login.accepted).toBe(true);
    if (!login.accepted) return;
    const nextPassword = await hashAdminPassword("SecondPassword-Only-For-Fixtures");
    await repositories.users.rotatePassword({ adminUserId: "admin-user:test", ...nextPassword,
      passwordChangedAt: "2026-07-16T10:05:00.000Z", updatedAt: "2026-07-16T10:05:00.000Z" });
    const authentication = await service.authenticate(login.token, "request:2");
    expect(authentication.accepted).toBe(false);
    expect(authentication.errors[0]?.code).toBe("ADMIN_SESSION_REVOKED");
  });
});

const user = (
  password: Awaited<ReturnType<typeof hashAdminPassword>>,
  status: AdminUserRecord["status"] = "active"
): AdminUserRecord => ({
  adminUserId: "admin-user:test", username: "TestOwner", normalizedUsername: normalizeAdminUsername("TestOwner"),
  ...password, passwordVersion: 1, role: "owner", status, displayName: "Test Owner",
  createdAt: "2026-07-16T10:00:00.000Z", updatedAt: "2026-07-16T10:00:00.000Z", lastLoginAt: null,
  passwordChangedAt: "2026-07-16T10:00:00.000Z", version: 1
});
