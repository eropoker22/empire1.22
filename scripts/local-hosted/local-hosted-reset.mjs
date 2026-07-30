import { execFileSync, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  LOCAL_HOSTED_BACKUP_DIRECTORY,
  LOCAL_HOSTED_DATABASE_NAME,
  LOCAL_HOSTED_DATABASE_URL,
  LOCAL_HOSTED_POSTGRES_CONTAINER
} from "./local-hosted-config.mjs";

const CONFIRMATION = "RESET_LOCAL_HOSTED_TEST_DATA";

export const resetLocalHostedTestData = async ({
  args,
  environment,
  nodeExecutable,
  managedRuntimeActive
}) => {
  const confirmation = args.find((argument) => argument.startsWith("--confirm="))
    ?.slice("--confirm=".length);
  if (confirmation !== CONFIRMATION) {
    throw new Error(
      `Reset odmítnut. Použij --confirm=${CONFIRMATION}.`
    );
  }
  if (managedRuntimeActive) {
    throw new Error("Reset odmítnut. Nejdřív spusť npm run dev:local-hosted:stop.");
  }
  assertSafeLocalDatabase();
  assertLocalComposePostgres();
  await mkdir(LOCAL_HOSTED_BACKUP_DIRECTORY, { recursive: true });
  const backupPath = path.join(
    LOCAL_HOSTED_BACKUP_DIRECTORY,
    `${LOCAL_HOSTED_DATABASE_NAME}-${safeTimestamp()}.dump`
  );
  await dumpDatabase(backupPath);
  execFileSync("docker", [
    "exec",
    LOCAL_HOSTED_POSTGRES_CONTAINER,
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "empire_dev",
    "-d",
    "postgres",
    "-c",
    `DROP DATABASE IF EXISTS ${LOCAL_HOSTED_DATABASE_NAME} WITH (FORCE);`,
    "-c",
    `CREATE DATABASE ${LOCAL_HOSTED_DATABASE_NAME} OWNER empire_dev;`
  ], { stdio: "inherit", windowsHide: true });
  runNode(nodeExecutable, [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    "scripts/database-migrations.ts"
  ], environment);
  runNode(nodeExecutable, [
    "scripts/run-local-bin.mjs",
    "vite-node/vite-node.mjs",
    "scripts/bootstrap-admin-user.ts"
  ], environment);
  console.log(`Bezpečný dump: ${backupPath}`);
  console.log("Lokální hosted data byla resetována; Docker volume zůstalo zachované.");
};

const assertSafeLocalDatabase = () => {
  const database = new URL(LOCAL_HOSTED_DATABASE_URL);
  if (!["127.0.0.1", "localhost", "::1"].includes(database.hostname)
    || database.pathname.slice(1) !== LOCAL_HOSTED_DATABASE_NAME
    || !/(?:^|_)hosted_(?:local_)?(?:dev|test|e2e)(?:_|$)/u.test(LOCAL_HOSTED_DATABASE_NAME)) {
    throw new Error("Reset odmítnut: databáze není canonical lokální dev/test databáze.");
  }
};

const assertLocalComposePostgres = () => {
  const inspected = JSON.parse(execFileSync("docker", [
    "inspect",
    LOCAL_HOSTED_POSTGRES_CONTAINER
  ], { encoding: "utf8", windowsHide: true }))[0];
  const project = inspected?.Config?.Labels?.["com.docker.compose.project"];
  const databaseVolume = inspected?.Mounts?.find((mount) =>
    mount.Destination === "/var/lib/postgresql/data"
  );
  if (project !== "streets" || databaseVolume?.Type !== "volume") {
    throw new Error("Reset odmítnut: PostgreSQL container neodpovídá lokálnímu compose projektu streets.");
  }
};

const dumpDatabase = (backupPath) => new Promise((resolve, reject) => {
  const output = createWriteStream(backupPath, { flags: "wx" });
  const child = spawn("docker", [
    "exec",
    LOCAL_HOSTED_POSTGRES_CONTAINER,
    "pg_dump",
    "-U",
    "empire_dev",
    "-d",
    LOCAL_HOSTED_DATABASE_NAME,
    "-Fc"
  ], { windowsHide: true, stdio: ["ignore", "pipe", "inherit"] });
  child.stdout.pipe(output);
  child.once("error", reject);
  child.once("exit", (code) => {
    output.end();
    if (code === 0) resolve();
    else reject(new Error(`pg_dump selhal s exit code ${code}.`));
  });
});

const runNode = (nodeExecutable, args, environment) => {
  execFileSync(nodeExecutable, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
    windowsHide: true
  });
};

const safeTimestamp = () => new Date().toISOString()
  .replaceAll(":", "-")
  .replace(/\.\d{3}Z$/u, "Z");
