import { EventEmitter } from "node:events";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS } from "../../apps/client/src/browser/gameplay-slice-timing";
import {
  createHostedGameApiProxyOptions,
  GAME_DEV_FS_DENY,
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
    expect(GAME_DEV_FS_DENY).toContain("**/.tmp/**");
    expect(GAME_DEV_FS_DENY).toContain("**/.git/**");
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

  it("reuses upstream sockets instead of exhausting Windows ephemeral ports", () => {
    const proxy = createHostedGameApiProxyOptions("http://127.0.0.1:8787");
    const agent = proxy.agent as {
      options?: {
        agentKeepAliveTimeoutBuffer?: number;
        timeout?: number;
      };
      keepAlive?: boolean;
      maxSockets?: number;
      maxFreeSockets?: number;
    };

    expect(proxy.target).toBe("http://127.0.0.1:8787");
    expect(agent.keepAlive).toBe(true);
    expect(agent.maxSockets).toBe(32);
    expect(agent.maxFreeSockets).toBe(8);
    expect(agent.options?.agentKeepAliveTimeoutBuffer).toBe(6_000);
    expect(agent.options?.timeout).toBeUndefined();
  });

  it.each([
    "http://127.0.0.1:8787",
    "https://127.0.0.1:8787"
  ])("retires %s upstream sockets well before the next gameplay poll", (origin) => {
    const proxy = createHostedGameApiProxyOptions(origin);
    const agent = proxy.agent as {
      keepAlive?: boolean;
      maxSockets?: number;
      keepSocketAlive(socket: unknown): boolean;
    };
    const keepAliveCalls: Array<[boolean, number]> = [];
    const timeoutCalls: number[] = [];
    let unreferenced = false;
    const socket = {
      timeout: 0,
      _httpMessage: {
        res: {
          headers: {
            "keep-alive": "timeout=15"
          }
        }
      },
      setKeepAlive(enabled: boolean, initialDelay: number) {
        keepAliveCalls.push([enabled, initialDelay]);
      },
      unref() {
        unreferenced = true;
      },
      setTimeout(timeout: number) {
        timeoutCalls.push(timeout);
        this.timeout = timeout;
      }
    };

    expect(agent.keepSocketAlive(socket)).toBe(true);
    expect(socket.timeout).toBe(5_000);
    expect(socket.timeout).toBeLessThan(GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS);
    expect(timeoutCalls).toEqual([5_000]);
    expect(keepAliveCalls).toEqual([[true, 1_000]]);
    expect(unreferenced).toBe(true);
    expect(agent.keepAlive).toBe(true);
    expect(agent.maxSockets).toBe(32);
  });

  it.each([
    "http://127.0.0.1:8787",
    "https://127.0.0.1:8787"
  ])("removes the idle timeout while a reused %s socket is active", (origin) => {
    const proxy = createHostedGameApiProxyOptions(origin);
    const agent = proxy.agent as {
      reuseSocket(socket: unknown, request: unknown): void;
    };
    const timeoutCalls: number[] = [];
    const socket = Object.assign(new EventEmitter(), {
      timeout: 5_000,
      ref() {},
      setTimeout(timeout: number) {
        timeoutCalls.push(timeout);
        this.timeout = timeout;
      }
    });
    const request = { reusedSocket: false };

    agent.reuseSocket(socket, request);

    expect(socket.timeout).toBe(0);
    expect(timeoutCalls).toEqual([0]);
    expect(request.reusedSocket).toBe(true);
  });
});
