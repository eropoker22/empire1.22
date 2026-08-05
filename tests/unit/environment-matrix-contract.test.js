import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createEnvironmentMatrix,
  inventoryEnvironmentReads,
  normalizeEnvironmentMatrixText,
  renderEnvironmentMatrix
} from "../../scripts/environment-matrix-contract.mjs";

describe("release environment matrix", () => {
  it("classifies every statically named environment read in tracked source", () => {
    const inventory = inventoryEnvironmentReads();
    const matrix = createEnvironmentMatrix(inventory);
    const classified = new Set([
      ...matrix.publicRows,
      ...matrix.providerRows,
      ...matrix.nonReleaseRows
    ].map(({ variable }) => variable));
    expect(inventory.reads.length).toBeGreaterThan(90);
    expect(inventory.reads.every(({ variable }) => classified.has(variable))).toBe(true);
  });

  it("fails closed when a new environment read lacks a classification", () => {
    expect(() => createEnvironmentMatrix({
      reads: [{ variable: "EMPIRE_UNREVIEWED_PUBLIC_SWITCH", locations: ["example.ts:1"] }],
      dynamicLocations: []
    })).toThrow(/Unclassified environment reads/u);
  });

  it("documents all required public variables and the admin session secret contract", () => {
    const inventory = inventoryEnvironmentReads();
    const matrix = createEnvironmentMatrix(inventory);
    const required = [
      "NODE_ENV",
      "EMPIRE_RELEASE_ENVIRONMENT",
      "EMPIRE_DATABASE_URL",
      "GAMEPLAY_DATABASE_URL",
      "GAMEPLAY_SLICE_SESSION_SECRET",
      "GAMEPLAY_SLICE_SNAPSHOT_SECRET",
      "EMPIRE_ADMIN_FINGERPRINT_SECRET",
      "EMPIRE_ADMIN_SESSION_SECRET",
      "EMPIRE_AUTH_THROTTLE_PEPPER",
      "EMPIRE_BUILD_SHA",
      "EMPIRE_HOSTED_WORKER_ID",
      "PORT"
    ];
    const publicByName = new Map(matrix.publicRows.map((row) => [row.variable, row]));
    expect(required.every((variable) => publicByName.has(variable))).toBe(true);
    expect(publicByName.get("EMPIRE_ADMIN_SESSION_SECRET")).toMatchObject({
      stagingRequired: "Yes",
      productionRequired: "Yes",
      secret: "Yes",
      workerScope: "No"
    });
    expect(publicByName.get("EMPIRE_ADMIN_SESSION_SECRET").safeFormat).toMatch(/32 bytes/u);
  });

  it("renders required columns and explicit secret separation", () => {
    const markdown = renderEnvironmentMatrix(createEnvironmentMatrix(inventoryEnvironmentReads()));
    expect(markdown).toContain("| Variable | Component | Staging required | Production required | Secret | Netlify scope | Worker scope | Safe format | Default allowed | Rotation instructions |");
    expect(markdown).toContain("must all differ");
    expect(markdown).toContain("Deploy previews receive none of these secrets");
  });

  it("treats Windows and Unix line endings as the same generated matrix", () => {
    const markdown = renderEnvironmentMatrix(createEnvironmentMatrix(inventoryEnvironmentReads()));
    expect(normalizeEnvironmentMatrixText(markdown.replace(/\n/gu, "\r\n")))
      .toBe(normalizeEnvironmentMatrixText(markdown));
  });

  it("classifies every protected variable and secret alias used by release workflows", () => {
    const matrix = createEnvironmentMatrix(inventoryEnvironmentReads());
    const classified = new Set([...matrix.publicRows, ...matrix.providerRows].map(({ variable }) => variable));
    const workflows = [
      ".github/workflows/deploy-staging.yml",
      ".github/workflows/staging-remote-acceptance.yml",
      ".github/workflows/staging-rollback-rehearsal.yml",
      ".github/workflows/deploy-production.yml"
    ].map((path) => readFileSync(path, "utf8")).join("\n");
    const aliases = [...workflows.matchAll(/\$\{\{\s*(?:vars|secrets)\.([A-Z][A-Z0-9_]*)/gu)]
      .map((match) => match[1]);
    expect([...new Set(aliases)].filter((variable) => !classified.has(variable))).toEqual([]);
  });
});
