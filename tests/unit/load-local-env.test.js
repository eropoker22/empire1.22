import { describe, expect, it, vi } from "vitest";
import { loadLocalEnvFile } from "../helpers/load-local-env.js";

describe("optional local environment loader", () => {
  it("loads an existing local environment file", () => {
    const loader = vi.fn();

    expect(loadLocalEnvFile(".env.local", loader)).toBe(true);
    expect(loader).toHaveBeenCalledWith(".env.local");
  });

  it("allows a clean checkout without a local environment file", () => {
    const loader = vi.fn(() => {
      const error = new Error("missing");
      error.code = "ENOENT";
      throw error;
    });

    expect(loadLocalEnvFile(".env.local", loader)).toBe(false);
  });

  it("does not hide unexpected environment loader failures", () => {
    const loader = vi.fn(() => {
      throw new Error("denied");
    });

    expect(() => loadLocalEnvFile(".env.local", loader)).toThrow("denied");
  });
});
