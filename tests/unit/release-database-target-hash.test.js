import { describe, expect, it } from "vitest";
import {
  releaseDatabaseTargetHash,
  releaseDatabaseTargetIdentity
} from "../../scripts/release-database-target-hash.mjs";

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
});
