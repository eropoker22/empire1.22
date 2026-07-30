import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GAME_DEV_WATCH_IGNORED,
  resolveHostedGameApiOrigin
} from "../../vite.game.config";

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

  it("ignores isolated local hosted artifacts", () => {
    expect(matchesIgnoredRoot(resolve(".tmp/local-hosted-full/run/ui-parity/cityEvents.html"))).toBe(true);
  });
});

describe("game Vite hosted API proxy", () => {
  it("keeps the in-memory API as the default", () => {
    expect(resolveHostedGameApiOrigin({})).toBeNull();
  });

  it("accepts an explicit exact hosted API origin", () => {
    expect(resolveHostedGameApiOrigin({
      EMPIRE_VITE_HOSTED_API_ORIGIN: "http://127.0.0.1:8787"
    })).toBe("http://127.0.0.1:8787");
  });

  it("rejects paths and non-HTTP protocols", () => {
    expect(() => resolveHostedGameApiOrigin({
      EMPIRE_VITE_HOSTED_API_ORIGIN: "http://127.0.0.1:8787/api"
    })).toThrow(/exact HTTP\(S\) origin/u);
    expect(() => resolveHostedGameApiOrigin({
      EMPIRE_VITE_HOSTED_API_ORIGIN: "file:///tmp/hosted-api"
    })).toThrow(/exact HTTP\(S\) origin/u);
  });
});
