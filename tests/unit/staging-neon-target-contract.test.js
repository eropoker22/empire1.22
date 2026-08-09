import { describe, expect, it } from "vitest";
import { releaseDatabaseTargetHash } from "../../scripts/release-database-target-hash.mjs";
import {
  verifyStagingNeonSnapshotBinding,
  verifyStagingNeonTargetBinding
} from "../../scripts/staging-neon-target-contract.mjs";

const directUrl = "postgresql://staging:fixture-password@ep-staging-target.eu-central-1.aws.neon.tech/empire%20prealpha?sslmode=verify-full";
const pooledUrl = "postgresql://staging:fixture-password@ep-staging-target-pooler.eu-central-1.aws.neon.tech/empire%20prealpha?sslmode=require";
const environment = {
  EMPIRE_RELEASE_ENVIRONMENT: "staging",
  EMPIRE_DATABASE_TARGET_ENVIRONMENT: "staging",
  EMPIRE_STAGING_DATABASE_TARGET_HASH: releaseDatabaseTargetHash(directUrl),
  EMPIRE_DATABASE_URL: directUrl,
  GAMEPLAY_DATABASE_URL: directUrl,
  EMPIRE_RELEASE_DATABASE_URL_POOLED: pooledUrl,
  GAMEPLAY_RELEASE_DATABASE_URL_POOLED: pooledUrl,
  NEON_PROJECT_ID: "project-staging",
  NEON_BRANCH_ID: "branch-staging",
  NEON_PRODUCTION_PROJECT_ID: "project-production",
  NEON_PRODUCTION_ROOT_BRANCH_ID: "branch-production",
  EMPIRE_PRODUCTION_DATABASE_TARGET_HASH: "f".repeat(64),
  RELEASE_SHA: "a".repeat(40)
};
const branchResponse = {
  branch: { id: "branch-staging", project_id: "project-staging" }
};
const endpointsResponse = {
  endpoints: [{
    id: "endpoint-staging",
    project_id: "project-staging",
    branch_id: "branch-staging",
    type: "read_write",
    host: "ep-staging-target.eu-central-1.aws.neon.tech"
  }]
};

describe("staging Neon target contract", () => {
  it("binds provider project, branch and endpoint to the protected target hash", () => {
    expect(verifyStagingNeonTargetBinding({
      environment,
      branchResponse,
      endpointsResponse
    })).toMatchObject({
      status: "verified",
      environment: "staging",
      releaseSha: "a".repeat(40),
      databaseTargetHash: environment.EMPIRE_STAGING_DATABASE_TARGET_HASH,
      projectIdHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      branchIdHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      endpointIdHash: expect.stringMatching(/^[0-9a-f]{64}$/u)
    });
  });

  it.each([
    ["production environment", { environment: { ...environment, EMPIRE_RELEASE_ENVIRONMENT: "production" } }, "ENVIRONMENT_INVALID"],
    ["wrong target hash", { environment: { ...environment, EMPIRE_STAGING_DATABASE_TARGET_HASH: "b".repeat(64) } }, "DATABASE_TARGET_MISMATCH"],
    ["wrong project response", { branchResponse: { branch: { ...branchResponse.branch, project_id: "project-production" } } }, "BRANCH_BINDING_MISMATCH"],
    ["wrong branch response", { branchResponse: { branch: { ...branchResponse.branch, id: "branch-production" } } }, "BRANCH_BINDING_MISMATCH"],
    ["endpoint from another branch", { endpointsResponse: { endpoints: [{ ...endpointsResponse.endpoints[0], branch_id: "branch-production" }] } }, "ENDPOINT_BINDING_MISMATCH"],
    ["endpoint host mismatch", { endpointsResponse: { endpoints: [{ ...endpointsResponse.endpoints[0], host: "ep-production.eu-central-1.aws.neon.tech" }] } }, "ENDPOINT_TARGET_MISMATCH"],
    ["multiple read-write endpoints", { endpointsResponse: { endpoints: [
      endpointsResponse.endpoints[0],
      { ...endpointsResponse.endpoints[0], id: "endpoint-staging-duplicate" }
    ] } }, "ENDPOINT_TARGET_MISMATCH"]
  ])("rejects %s", (_label, override, code) => {
    expect(() => verifyStagingNeonTargetBinding({
      environment,
      branchResponse,
      endpointsResponse,
      ...override
    })).toThrow(code);
  });

  it.each([
    ["same project", { NEON_PRODUCTION_PROJECT_ID: "project-staging" }],
    ["same branch", { NEON_PRODUCTION_ROOT_BRANCH_ID: "branch-staging" }],
    ["same target hash", { EMPIRE_PRODUCTION_DATABASE_TARGET_HASH: environment.EMPIRE_STAGING_DATABASE_TARGET_HASH }]
  ])("rejects production-equivalent %s", (_label, override) => {
    expect(() => verifyStagingNeonTargetBinding({
      environment: { ...environment, ...override },
      branchResponse,
      endpointsResponse
    })).toThrow(/STAGING_NEON_PRODUCTION_TARGET_REJECTED/u);
  });

  it("emits no raw provider identifiers or database URLs in evidence", () => {
    const evidenceText = JSON.stringify(verifyStagingNeonTargetBinding({
      environment,
      branchResponse,
      endpointsResponse
    }));
    expect(evidenceText).not.toContain(environment.NEON_PROJECT_ID);
    expect(evidenceText).not.toContain(environment.NEON_BRANCH_ID);
    expect(evidenceText).not.toContain(endpointsResponse.endpoints[0].id);
    expect(evidenceText).not.toContain("neon.tech");
    expect(evidenceText).not.toContain("fixture-password");
  });

  it("binds a snapshot source branch and every provider operation to the preflight evidence", () => {
    const targetBinding = verifyStagingNeonTargetBinding({
      environment,
      branchResponse,
      endpointsResponse
    });
    const snapshotEvidence = verifyStagingNeonSnapshotBinding({
      environment: { ...environment, EMPIRE_STAGING_NEON_SNAPSHOT_NAME: "staging-pre-a" },
      targetBinding,
      snapshotResponse: {
        snapshot: { id: "snapshot-staging", source_branch_id: environment.NEON_BRANCH_ID },
        operations: [{
          id: "operation-staging",
          project_id: environment.NEON_PROJECT_ID,
          branch_id: environment.NEON_BRANCH_ID
        }]
      }
    });
    expect(snapshotEvidence).toMatchObject({
      schemaVersion: 1,
      status: "verified",
      databaseTargetHash: targetBinding.databaseTargetHash,
      projectIdHash: targetBinding.projectIdHash,
      branchIdHash: targetBinding.branchIdHash,
      endpointIdHash: targetBinding.endpointIdHash,
      operationSetHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
      operationCount: 1
    });
    expect(JSON.stringify(snapshotEvidence)).not.toContain(environment.NEON_PROJECT_ID);
    expect(JSON.stringify(snapshotEvidence)).not.toContain(environment.NEON_BRANCH_ID);
    expect(JSON.stringify(snapshotEvidence)).not.toContain("snapshot-staging");
    expect(JSON.stringify(snapshotEvidence)).not.toContain("operation-staging");
  });

  it.each([
    ["wrong snapshot source branch", {
      snapshot: { id: "snapshot-staging", source_branch_id: "branch-production" },
      operations: [{ id: "operation-staging", project_id: "project-staging", branch_id: "branch-staging" }]
    }, "SNAPSHOT_BRANCH_MISMATCH"],
    ["operation from another project", {
      snapshot: { id: "snapshot-staging", source_branch_id: "branch-staging" },
      operations: [{ id: "operation-staging", project_id: "project-production", branch_id: "branch-staging" }]
    }, "SNAPSHOT_OPERATION_MISMATCH"],
    ["operation from another branch", {
      snapshot: { id: "snapshot-staging", source_branch_id: "branch-staging" },
      operations: [{ id: "operation-staging", project_id: "project-staging", branch_id: "branch-production" }]
    }, "SNAPSHOT_OPERATION_MISMATCH"]
  ])("rejects %s", (_label, snapshotResponse, code) => {
    expect(() => verifyStagingNeonSnapshotBinding({
      environment: { ...environment, EMPIRE_STAGING_NEON_SNAPSHOT_NAME: "staging-pre-a" },
      targetBinding: verifyStagingNeonTargetBinding({ environment, branchResponse, endpointsResponse }),
      snapshotResponse
    })).toThrow(code);
  });

  it("accepts the schema-valid empty operation list while retaining the source-branch binding", () => {
    expect(verifyStagingNeonSnapshotBinding({
      environment: { ...environment, EMPIRE_STAGING_NEON_SNAPSHOT_NAME: "staging-pre-a" },
      targetBinding: verifyStagingNeonTargetBinding({ environment, branchResponse, endpointsResponse }),
      snapshotResponse: {
        snapshot: { id: "snapshot-staging", source_branch_id: "branch-staging" },
        operations: []
      }
    })).toMatchObject({ operationCount: 0, operationSetHash: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  });

  it("rejects target-binding evidence carrying an unapproved raw provider field", () => {
    const targetBinding = verifyStagingNeonTargetBinding({ environment, branchResponse, endpointsResponse });
    expect(() => verifyStagingNeonSnapshotBinding({
      environment: { ...environment, EMPIRE_STAGING_NEON_SNAPSHOT_NAME: "staging-pre-a" },
      targetBinding: { ...targetBinding, rawProjectId: environment.NEON_PROJECT_ID },
      snapshotResponse: {
        snapshot: { id: "snapshot-staging", source_branch_id: "branch-staging" },
        operations: []
      }
    })).toThrow("SNAPSHOT_TARGET_BINDING_INVALID");
  });
});
