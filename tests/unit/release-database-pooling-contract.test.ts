import { describe, expect, it } from "vitest";
import {
  assertReleaseDatabasePoolingState,
  parsePostgresDurationMs
} from "../../scripts/release-database-pooling-contract";

describe("release database pooling contract", () => {
  it.each([
    ["15000ms", 15_000],
    ["15s", 15_000],
    ["0.5min", 30_000]
  ])("parses PostgreSQL duration %s", (value, expected) => {
    expect(parsePostgresDurationMs(value)).toBe(expected);
  });

  it("accepts a public schema with a bounded role-level statement timeout", () => {
    expect(assertReleaseDatabasePoolingState({
      currentSchema: "public",
      statementTimeout: "15s"
    })).toBe(15_000);
  });

  it.each([
    [{ currentSchema: "private", statementTimeout: "15s" }, "RELEASE_POOLED_DATABASE_SCHEMA_NOT_PUBLIC"],
    [{ currentSchema: "public", statementTimeout: "0" }, "RELEASE_POOLED_ROLE_STATEMENT_TIMEOUT_UNSAFE"],
    [{ currentSchema: "public", statementTimeout: "31s" }, "RELEASE_POOLED_ROLE_STATEMENT_TIMEOUT_UNSAFE"]
  ])("rejects an unsafe pooled role", (state, code) => {
    expect(() => assertReleaseDatabasePoolingState(state)).toThrow(code);
  });
});
