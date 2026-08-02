import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("live lobby spawn modal cold-start contract", () => {
  it("reveals an explicit loading state before awaiting spawn districts", () => {
    const source = readFileSync(resolve(root, "page-assets/js/lobby-live.js"), "utf8");
    const start = source.indexOf("async function openSpawnModal");
    const end = source.indexOf("function closeSpawnModal", start);
    const openSpawnModal = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(openSpawnModal).toContain('modal?.setAttribute("data-load-state", "loading")');
    expect(openSpawnModal).toContain('modal?.setAttribute("data-load-state", "ready")');
    expect(openSpawnModal).toContain('modal?.setAttribute("data-load-state", "error")');
    expect(openSpawnModal.indexOf('modal?.classList.remove("hidden")')).toBeLessThan(
      openSpawnModal.indexOf("await loadSpawnDistricts(serverInstanceId)")
    );
  });
});
