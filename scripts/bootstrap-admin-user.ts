import "./load-local-environment";
import * as crypto from "node:crypto";
import type { AdminRole } from "@empire/shared-types";
import { hashAdminPassword, normalizeAdminUsername } from "../apps/server/src/admin/read-only/admin-password";
import { createPostgresAdminAuditRepository, createPostgresAdminSessionRepository, createPostgresAdminUserRepository } from "../apps/server/src/admin/read-only/postgres-admin-security-repositories";
import { createPostgresDatabase, getDatabaseMigrationStatus } from "../apps/server/src/runtime/persistence/postgres";

const rotatePassword = process.argv.includes("--rotate-password");
const usernameArgument = process.argv.find((argument) => argument.startsWith("--username="))?.slice("--username=".length);
const username = String(usernameArgument ?? process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = String((rotatePassword ? process.env.EMPIRE_ADMIN_NEW_PASSWORD : process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD) ?? "");
const role = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_ROLE ?? "owner") as AdminRole;
const displayName = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_DISPLAY_NAME ?? username).trim();
const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? "").trim();

if (!databaseUrl) throw new Error("EMPIRE_DATABASE_URL is required.");
if (!username || !password || !displayName) throw new Error("Admin bootstrap username, password, and display name are required.");
if (!(["viewer", "operator", "owner"] as string[]).includes(role)) throw new Error("Admin bootstrap role is invalid.");

const database = createPostgresDatabase(databaseUrl);
try {
  const migrationStatus = await getDatabaseMigrationStatus(database,
    new URL("../apps/server/src/runtime/persistence/postgres/migrations/", import.meta.url));
  if (!migrationStatus.current) throw new Error("Database migrations are not current. Run npm run db:migrate first.");

  const users = createPostgresAdminUserRepository(database);
  const sessions = createPostgresAdminSessionRepository(database);
  const audit = createPostgresAdminAuditRepository(database);
  const normalizedUsername = normalizeAdminUsername(username);
  const existing = await users.getByNormalizedUsername(normalizedUsername);
  const at = new Date().toISOString();
  let user = existing;

  if (!existing && rotatePassword) {
    throw new Error("Admin user does not exist; bootstrap the user before rotating its password.");
  } else if (!existing) {
    const passwordFields = await hashAdminPassword(password);
    user = await users.create({
      adminUserId: `admin-user:${crypto.randomUUID()}`,
      username,
      normalizedUsername,
      ...passwordFields,
      passwordVersion: 1,
      role,
      status: "active",
      displayName,
      createdAt: at,
      updatedAt: at,
      lastLoginAt: null,
      passwordChangedAt: at,
      version: 1
    });
  } else if (rotatePassword) {
    const passwordFields = await hashAdminPassword(password);
    user = await users.rotatePassword({ adminUserId: existing.adminUserId, ...passwordFields, passwordChangedAt: at, updatedAt: at });
    await sessions.revokeSessionsForUser(existing.adminUserId, at);
  } else {
    user = await users.updateProfileAndRole({
      adminUserId: existing.adminUserId,
      username,
      normalizedUsername,
      displayName,
      role,
      status: existing.status,
      updatedAt: at
    });
  }

  await audit.append({
    id: `admin-audit:${crypto.randomUUID()}`,
    adminSessionId: null,
    actorId: user.adminUserId,
    role: user.role,
    action: rotatePassword ? "admin-password-rotated" : "admin-user-bootstrap",
    targetInstanceId: null,
    result: "success",
    createdAt: at,
    correlationId: `admin-bootstrap:${crypto.randomUUID()}`
  });
  console.log(`Admin user ${user.username} is ready with role ${user.role}.`);
} finally {
  await database.close();
}
