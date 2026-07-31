import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS } from "../../apps/client/src/browser/gameplay-slice-timing";
import {
  LOCAL_HOSTED_HTTP_HEADERS_TIMEOUT_MS,
  LOCAL_HOSTED_HTTP_KEEP_ALIVE_TIMEOUT_MS
} from "../../apps/server/src/bootstrap/local-hosted-http-timing";
import { createLocalHostedHttpTimingPlugin } from "../../vite.game.config";

const root = resolve(import.meta.dirname, "../..");

describe("local hosted HTTP timing", () => {
  it("keeps browser connections alive across stable gameplay polls", () => {
    expect(LOCAL_HOSTED_HTTP_KEEP_ALIVE_TIMEOUT_MS).toBeGreaterThan(
      GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS
    );
    expect(LOCAL_HOSTED_HTTP_HEADERS_TIMEOUT_MS).toBeGreaterThan(
      LOCAL_HOSTED_HTTP_KEEP_ALIVE_TIMEOUT_MS
    );
  });

  it("applies the shared timing to the Vite HTTP server", () => {
    const httpServer = {
      keepAliveTimeout: 5_000,
      headersTimeout: 60_000
    };

    createLocalHostedHttpTimingPlugin().configureServer({ httpServer });

    expect(httpServer.keepAliveTimeout).toBe(LOCAL_HOSTED_HTTP_KEEP_ALIVE_TIMEOUT_MS);
    expect(httpServer.headersTimeout).toBe(LOCAL_HOSTED_HTTP_HEADERS_TIMEOUT_MS);
  });

  it("applies the shared timing before the hosted API starts listening", () => {
    const source = readFileSync(
      resolve(root, "apps/server/src/bootstrap/hosted-dev-http-cli.ts"),
      "utf8"
    );
    const serverCreationAt = source.indexOf("const server = http.createServer");
    const timingApplicationAt = source.indexOf("applyLocalHostedHttpTiming(server);");
    const listenAt = source.indexOf("server.listen");

    expect(serverCreationAt).toBeGreaterThanOrEqual(0);
    expect(timingApplicationAt).toBeGreaterThan(serverCreationAt);
    expect(listenAt).toBeGreaterThan(timingApplicationAt);
  });
});
