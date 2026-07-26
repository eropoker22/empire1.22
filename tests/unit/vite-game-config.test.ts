import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_DEV_WATCH_IGNORED } from "../../vite.game.config";

const normalize = (path: string): string => path.replaceAll("\\", "/");
const matchesIgnoredRoot = (path: string): boolean => {
  const normalized = normalize(path);
  return GAME_DEV_WATCH_IGNORED.some((glob) => normalized.startsWith(glob.slice(0, -3)));
};

describe("game Vite watcher", () => {
  it("ignores generated client output without ignoring apps/client source", () => {
    expect(matchesIgnoredRoot(resolve("client/page-assets/js/app.js"))).toBe(true);
    expect(matchesIgnoredRoot(resolve("apps/client/src/browser/gameplay-slice-page.ts"))).toBe(false);
  });
});
