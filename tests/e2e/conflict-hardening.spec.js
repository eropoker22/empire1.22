import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";

const helperPath = path.resolve("tests/e2e/helpers/conflictHardeningScenario.ts");

for (const scenario of ["alliance-defense", "attack-stabilization", "spy-heist-rob"]) {
  test(`canonical conflict scenario: ${scenario}`, () => {
    const result = spawnSync(process.execPath, [
      "scripts/run-local-bin.mjs",
      "vite-node/vite-node.mjs",
      helperPath,
      `--scenario=${scenario}`
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const output = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    expect(output).toMatchObject({ scenario, passed: true });
  });
}
