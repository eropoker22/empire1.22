import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const verifier = readFileSync(new URL("../../scripts/verify-admin-user-live.ts", import.meta.url), "utf8");

describe("admin bootstrap release guard", () => {
  it("requires one active owner and a successful bootstrap audit", () => {
    expect(verifier).toContain("WHERE role='owner' AND status='active'");
    expect(verifier).toContain("admin-user-bootstrap");
    expect(verifier).toContain("admin-password-rotated");
    expect(verifier).toContain("Live admin owner count is invalid.");
    expect(verifier).toContain("Live admin bootstrap audit is missing.");
  });

  it("does not emit a hardcoded admin identity", () => {
    expect(verifier).toContain("Production admin owner verified.");
    expect(verifier).not.toContain("Erik22");
  });
});
