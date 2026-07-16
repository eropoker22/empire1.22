import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const helperPath = path.resolve("tests/e2e/helpers/livenessClosedAlphaScenario.ts");

for (const scenario of ["corridor", "last-stand-defeat"]) {
  test(`closed-alpha liveness scenario: ${scenario}`, () => {
    const result = spawnSync(process.execPath, [
      "scripts/run-local-bin.mjs",
      "vite-node/vite-node.mjs",
      helperPath,
      `--scenario=${scenario}`
    ], { cwd: process.cwd(), encoding: "utf8", windowsHide: true });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1))).toMatchObject({ scenario, passed: true });
  });
}
