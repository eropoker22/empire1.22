import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readRoot = (name) => readFileSync(resolve(root, name), "utf8");

describe("server-select page smoke", () => {
  it("keeps server select assets and app mounts wired", () => {
    const html = readRoot("server-select.html");
    expect(html).toContain('data-player-topbar');
    expect(html).toContain('data-sidebar');
    expect(html).toContain('data-server-list');
    expect(html).toContain('data-district-map');
    expect(html).toContain('data-server-details');
    expect(html).toContain('src="./server-select.js"');
    expect(html).toContain('href="./server-select.css"');
  });

  it("keeps gameplay-facing mock data in JavaScript, not HTML", () => {
    const html = readRoot("server-select.html");
    const js = readRoot("server-select.js");

    expect(html).not.toContain("Vortex City WAR-01");
    expect(html).not.toContain("Neon Docks FREE-01");
    expect(js).toContain("const mockServers");
    expect(js).toContain("const mockDistricts");
    expect(js).toContain("empirestreets.selectedServer");
    expect(js).toContain("ENABLE_FAKE_REDIRECT = false");
  });
});
