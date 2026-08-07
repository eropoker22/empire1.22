import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  CI_HOSTED_EPHEMERAL_SECRET_NAMES
} from "../../scripts/verify-ci-hosted-artifact-secret-canary.mjs";

const root = resolve(import.meta.dirname, "../..");
const secretNames = [...CI_HOSTED_EPHEMERAL_SECRET_NAMES];

describe("hosted CI environment generator", () => {
  it("rejects execution outside GitHub Actions", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "empire-hosted-non-github-env-"));
    try {
      const environment = {
        ...process.env,
        CI: "true",
        GITHUB_ENV: resolve(directory, "github-env")
      };
      delete environment.GITHUB_ACTIONS;
      const result = spawnSync(
        process.execPath,
        [resolve(root, "scripts/write-ci-hosted-environment.mjs")],
        { cwd: root, env: environment, encoding: "utf8", windowsHide: true }
      );

      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        "CI hosted environment generation is restricted to GitHub Actions"
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("masks every distinct ephemeral secret before exposing it to later steps", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "empire-hosted-ci-env-"));
    const environmentPath = resolve(directory, "github-env");
    try {
      const result = spawnSync(
        process.execPath,
        [resolve(root, "scripts/write-ci-hosted-environment.mjs")],
        {
          cwd: root,
          env: {
            ...process.env,
            CI: "true",
            GITHUB_ACTIONS: "true",
            GITHUB_ENV: environmentPath
          },
          encoding: "utf8",
          windowsHide: true
        }
      );
      expect(result.status, result.stderr).toBe(0);

      const writtenEnvironment = new Map(
        readFileSync(environmentPath, "utf8")
          .trim()
          .split(/\r?\n/u)
          .map((line) => {
            const separator = line.indexOf("=");
            return [line.slice(0, separator), line.slice(separator + 1)];
          })
      );
      const masks = String(result.stdout)
        .split(/\r?\n/u)
        .filter((line) => line.startsWith("::add-mask::"))
        .map((line) => line.slice("::add-mask::".length));
      const secrets = secretNames.map((name) => writtenEnvironment.get(name));

      expect(writtenEnvironment.get("EMPIRE_DATABASE_URL")).toBe(
        "postgresql://empire@127.0.0.1:5432/postgres"
      );
      expect(writtenEnvironment.get("GAMEPLAY_DATABASE_URL")).toBe(
        writtenEnvironment.get("EMPIRE_DATABASE_URL")
      );
      expect(writtenEnvironment.get("EMPIRE_TEST_DATABASE_URL")).toBe(
        "postgresql://empire@127.0.0.1:5432/empire_e2e"
      );
      expect(writtenEnvironment.get("EMPIRE_TEST_DATABASE_URL")).not.toBe(
        writtenEnvironment.get("EMPIRE_DATABASE_URL")
      );
      expect(masks).toHaveLength(secretNames.length);
      expect(new Set(masks).size).toBe(secretNames.length);
      expect(new Set(secrets).size).toBe(secretNames.length);
      expect(masks).toEqual(expect.arrayContaining(secrets));
      for (const value of secrets) {
        expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      }

      const nonMaskOutput = String(result.stdout)
        .split(/\r?\n/u)
        .filter((line) => !line.startsWith("::add-mask::"))
        .join("\n");
      for (const value of secrets) {
        expect(nonMaskOutput).not.toContain(value);
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
