import { buildSync } from "esbuild";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export async function advanceHostedProductionClock({ serverInstanceId, firstDueTick, buildingId, playerId }) {
  if (process.env.EMPIRE_LOCAL_HOSTED_CONTROLLED_PRODUCTION_CLOCK !== "1") return null;
  const bundle = `.tmp/hosted-production-clock-${process.pid}.mjs`;
  buildSync({ entryPoints: ["tests/e2e/fixtures/advance-hosted-production-clock.mjs"], bundle: true, platform: "node", format: "esm",
    external: ["pg"], tsconfig: "tsconfig.base.json", outfile: bundle });
  const result = await exec(process.execPath, [bundle, serverInstanceId, String(firstDueTick), buildingId, playerId], {
    timeout: 45000, env: { ...process.env, NODE_ENV: "test" } });
  return JSON.parse(result.stdout.trim());
}
