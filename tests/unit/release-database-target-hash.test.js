import { describe, expect, it } from "vitest";
import {
  releaseDatabaseTargetHash,
  releaseDatabaseTargetIdentity
} from "../../scripts/release-database-target-hash.mjs";
import targetVector from "../fixtures/release-database-target-vectors.json";

describe("release database target hash", () => {
  it("normalizes pooled and direct Neon endpoints to the same safe identity", () => {
    const direct = "postgresql://direct@ep-production.eu-central-1.aws.neon.tech/empire?sslmode=verify-full";
    const pooled = "postgresql://pooled@ep-production-pooler.eu-central-1.aws.neon.tech/empire?sslmode=require";
    expect(releaseDatabaseTargetIdentity(direct)).toBe(
      "ep-production.eu-central-1.aws.neon.tech:5432/empire"
    );
    expect(releaseDatabaseTargetHash(pooled)).toBe(releaseDatabaseTargetHash(direct));
  });

  it("changes when the branch hostname or database changes", () => {
    const baseline = releaseDatabaseTargetHash("postgresql://role@ep-production.neon.tech/empire");
    expect(releaseDatabaseTargetHash("postgresql://role@ep-other.neon.tech/empire")).not.toBe(baseline);
    expect(releaseDatabaseTargetHash("postgresql://role@ep-production.neon.tech/other")).not.toBe(baseline);
  });

  it("uses the shared decoded-path vector for direct and pooled URLs", () => {
    expect(releaseDatabaseTargetIdentity(targetVector.directUrl)).toBe(targetVector.identity);
    expect(releaseDatabaseTargetIdentity(targetVector.pooledUrl)).toBe(targetVector.identity);
    expect(releaseDatabaseTargetHash(targetVector.pooledUrl)).toBe(
      releaseDatabaseTargetHash(targetVector.directUrl)
    );
  });
});
