import { randomUUID } from "node:crypto";

export const probeRollbackOnlyTickLease = async (pool) => {
  const client = await pool.connect();
  const serverInstanceId = `preflight:instance:${randomUUID()}`;
  const lockId = `preflight:tick-lock:${randomUUID()}`;
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query(
      `INSERT INTO empire_server_instances
       (id,server_instance_id,schema_version,mode,status,payload,created_at,updated_at)
       VALUES ($1,$2,1,'free','preflight','{}'::jsonb,now(),now())`,
      [`preflight:server-row:${randomUUID()}`, serverInstanceId]
    );
    const acquired = await client.query(
      `INSERT INTO empire_tick_locks
       (id,server_instance_id,schema_version,lock_owner,locked_until,payload,created_at,updated_at)
       VALUES ($1,$2,1,'hosted-preflight',now()+interval '10 seconds','{}'::jsonb,now(),now())
       RETURNING server_instance_id`,
      [lockId, serverInstanceId]
    );
    if (acquired.rowCount !== 1) return false;
    const released = await client.query(
      `UPDATE empire_tick_locks SET locked_until=now(),updated_at=now()
       WHERE server_instance_id=$1 AND lock_owner='hosted-preflight'
       RETURNING server_instance_id`,
      [serverInstanceId]
    );
    return released.rowCount === 1;
  } catch (_error) {
    return false;
  } finally {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
};
