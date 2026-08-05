import "./load-local-environment";
import { verifyAdminPassword, normalizeAdminUsername } from "../apps/server/src/admin/read-only/admin-password";
import { createPostgresAdminUserRepository } from "../apps/server/src/admin/read-only/postgres-admin-security-repositories";
import { createPostgresDatabase } from "../apps/server/src/runtime/persistence/postgres";

const databaseUrl = String(process.env.EMPIRE_DATABASE_URL ?? "").trim();
const username = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_USERNAME ?? "").trim();
const password = String(process.env.EMPIRE_ADMIN_BOOTSTRAP_PASSWORD ?? "");
if (!databaseUrl || !username || !password) throw new Error("Live admin verification requires local database and admin credentials.");

const database = createPostgresDatabase(databaseUrl);
try {
  const user = await createPostgresAdminUserRepository(database).getByNormalizedUsername(normalizeAdminUsername(username));
  if (!user) throw new Error("Live admin user was not found.");
  if (user.username !== username || user.normalizedUsername !== normalizeAdminUsername(username)) throw new Error("Live admin username is invalid.");
  if (user.role !== "owner" || user.status !== "active") throw new Error("Live admin role or status is invalid.");
  if (!user.passwordHash || !user.passwordSalt || user.passwordHash === password) throw new Error("Live admin password storage is invalid.");
  if (!await verifyAdminPassword(password, user)) throw new Error("Live admin password verification failed.");
  const columns = await database.query<{ count: string | number }>(
    `SELECT count(*) AS count FROM information_schema.columns
     WHERE table_schema='public' AND table_name='empire_admin_users'
       AND column_name IN ('password','plain_password','plaintext_password')`
  );
  if (Number(columns.rows[0]?.count ?? 0) !== 0) throw new Error("Live admin table exposes a plaintext password column.");
  const auditLeak = await database.query<{ count: string | number }>(
    `SELECT count(*) AS count FROM empire_admin_access_audit
     WHERE row_to_json(empire_admin_access_audit)::text LIKE '%' || $1 || '%'`,
    [password]
  );
  if (Number(auditLeak.rows[0]?.count ?? 0) !== 0) throw new Error("Live admin password appears in audit metadata.");
  const activeOwners = await database.query<{ count: string | number }>(
    "SELECT count(*) AS count FROM empire_admin_users WHERE role='owner' AND status='active'"
  );
  if (Number(activeOwners.rows[0]?.count ?? 0) !== 1) throw new Error("Live admin owner count is invalid.");
  const bootstrapAudit = await database.query<{ count: string | number }>(
    `SELECT count(*) AS count FROM empire_admin_access_audit
     WHERE actor_id=$1 AND action IN ('admin-user-bootstrap','admin-password-rotated') AND result='success'`,
    [user.adminUserId]
  );
  if (Number(bootstrapAudit.rows[0]?.count ?? 0) < 1) throw new Error("Live admin bootstrap audit is missing.");
  process.stdout.write("Production admin owner verified.\n");
} finally {
  await database.close();
}
