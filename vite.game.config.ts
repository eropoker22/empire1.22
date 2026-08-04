import { webcrypto } from "node:crypto";
import { Agent as HttpAgent, type ClientRequest } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import type { Socket } from "node:net";
import { resolve } from "node:path";
import { defineConfig, type Plugin, type ProxyOptions, type ViteDevServer } from "vite";
import { GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS } from "./apps/client/src/browser/gameplay-slice-timing";
import { applyLocalHostedHttpTiming } from "./apps/server/src/bootstrap/local-hosted-http-timing";
import type { createGameplaySliceFunctionHandler } from "./apps/server/src/netlify/gameplay-slice-function";

const fromRoot = (...segments: string[]): string => resolve(__dirname, ...segments);
const toWatchGlob = (...segments: string[]): string =>
  `${fromRoot(...segments).replaceAll("\\", "/")}/**`;

export const GAME_DEV_WATCH_IGNORED = Object.freeze([
  toWatchGlob(".cache"),
  toWatchGlob(".tmp"),
  toWatchGlob("client"),
  toWatchGlob("dist-worker"),
  toWatchGlob("netlify", "functions"),
  toWatchGlob("playwright-report"),
  toWatchGlob("test-results")
]);

export const GAME_DEV_FS_DENY = Object.freeze([
  ".env",
  ".env.*",
  "*.{crt,pem}",
  "**/.git/**",
  "**/.tmp/**"
]);

const gameplayApiPaths = [
  "/api/gameplay-slice/",
  "/api/servers",
  "/api/matchmaking/reserve",
  "/api/account/",
  "/api/lobby/",
  "/api/admin/"
];

const HOSTED_PROXY_KEEP_ALIVE_TIMEOUT_BUFFER_MS = 6_000;
const HOSTED_PROXY_FREE_SOCKET_TIMEOUT_MS = Math.max(
  1_000,
  Math.floor(GAMEPLAY_SLICE_STABLE_POLL_INTERVAL_MS / 2)
);

type HostedProxySocket = Socket & {
  _httpMessage?: {
    res?: {
      headers?: Record<string, string | string[] | undefined>;
    };
  };
};

const resolveHostedProxyFreeSocketTimeout = (socket: Socket): number => {
  const keepAliveValue = (socket as HostedProxySocket)._httpMessage?.res?.headers?.["keep-alive"];
  const keepAliveHeader = Array.isArray(keepAliveValue) ? keepAliveValue[0] : keepAliveValue;
  const timeoutMatch = /^timeout=(\d+)/iu.exec(keepAliveHeader ?? "");
  if (!timeoutMatch) return HOSTED_PROXY_FREE_SOCKET_TIMEOUT_MS;

  const upstreamTimeoutMs = Number.parseInt(timeoutMatch[1], 10) * 1_000;
  return Math.min(
    HOSTED_PROXY_FREE_SOCKET_TIMEOUT_MS,
    Math.max(1, upstreamTimeoutMs - HOSTED_PROXY_KEEP_ALIVE_TIMEOUT_BUFFER_MS)
  );
};

class HostedHttpAgent extends HttpAgent {
  override keepSocketAlive(socket: Socket): boolean {
    if (!super.keepSocketAlive(socket)) return false;
    socket.setTimeout(resolveHostedProxyFreeSocketTimeout(socket));
    return true;
  }

  override reuseSocket(socket: Socket, request: ClientRequest): void {
    super.reuseSocket(socket, request);
    socket.setTimeout(0);
  }
}

class HostedHttpsAgent extends HttpsAgent {
  override keepSocketAlive(socket: Socket): boolean {
    if (!super.keepSocketAlive(socket)) return false;
    socket.setTimeout(resolveHostedProxyFreeSocketTimeout(socket));
    return true;
  }

  override reuseSocket(socket: Socket, request: ClientRequest): void {
    super.reuseSocket(socket, request);
    socket.setTimeout(0);
  }
}

export const resolveHostedGameApiOrigin = (
  environment: Record<string, string | undefined> = process.env
): string | null => {
  const value = String(environment.EMPIRE_VITE_HOSTED_API_ORIGIN ?? "").trim();
  if (!value) return null;
  const origin = new URL(value);
  if (!["http:", "https:"].includes(origin.protocol) || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("EMPIRE_VITE_HOSTED_API_ORIGIN must be an exact HTTP(S) origin.");
  }
  return origin.origin;
};

export const createHostedGameApiProxyOptions = (origin: string): ProxyOptions => {
  const target = new URL(origin);
  const agentOptions = {
    agentKeepAliveTimeoutBuffer: HOSTED_PROXY_KEEP_ALIVE_TIMEOUT_BUFFER_MS,
    keepAlive: true,
    maxSockets: 32,
    maxFreeSockets: 8
  };

  return {
    target: target.origin,
    changeOrigin: false,
    secure: false,
    agent: target.protocol === "https:"
      ? new HostedHttpsAgent(agentOptions)
      : new HostedHttpAgent(agentOptions)
  };
};

export const createLocalHostedHttpTimingPlugin = () => ({
  name: "empire-local-hosted-http-timing",
  configureServer(server: ViteDevServer) {
    if (server.httpServer) {
      applyLocalHostedHttpTiming(server.httpServer);
    }
  }
}) satisfies Plugin;

export const createLocalHostedAdminBuildShaPlugin = (
  environment: Record<string, string | undefined> = process.env
) => {
  const buildSha = String(environment.EMPIRE_BUILD_SHA ?? "").trim();

  return {
    name: "empire-local-hosted-admin-build-sha",
    transformIndexHtml(html, context) {
      if (context.path !== "/admin.html" || !buildSha) return html;
      return html.replaceAll("__EMPIRE_BUILD_SHA__", buildSha);
    }
  } satisfies Plugin;
};

interface DevIncomingRequest {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | number | undefined>;
  on(event: string, listener: (value?: unknown) => void): void;
}

const createGameplayApiMiddleware = (): Plugin => {
  return {
    name: "empire-gameplay-api",
    configureServer(server) {
      type GameplaySliceFunctionHandler = ReturnType<typeof createGameplaySliceFunctionHandler>;
      let handlerPromise: Promise<GameplaySliceFunctionHandler> | null = null;
      const getHandler = async (): Promise<GameplaySliceFunctionHandler> => {
        handlerPromise ??= server
          .ssrLoadModule("/apps/server/src/netlify/gameplay-slice-function.ts")
          .then((module) => {
            const createHandler = module.createGameplaySliceFunctionHandler as typeof createGameplaySliceFunctionHandler;
            return createHandler({
              cryptoProvider: () => webcrypto,
              environment: {
                ...process.env,
                NODE_ENV: process.env.NODE_ENV || "development"
              }
            });
          });

        return handlerPromise;
      };

      server.middlewares.use(async (request, response, next) => {
        const incoming = request as unknown as DevIncomingRequest;
        const path = new URL(incoming.url || "/", "http://localhost").pathname;
        if (!gameplayApiPaths.some((apiPath) => path === apiPath || path.startsWith(apiPath))) {
          next();
          return;
        }

        try {
          const handler = await getHandler();
          const result = await handler({
            httpMethod: incoming.method || "GET",
            path,
            body: await readRequestBody(incoming, incoming.method),
            headers: normalizeRequestHeaders(incoming.headers)
          });

          response.statusCode = result.statusCode;
          for (const [key, value] of Object.entries(result.headers)) {
            response.setHeader(key, value);
          }
          response.end(result.body);
        } catch (error) {
          response.statusCode = 500;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify({
            accepted: false,
            readModel: null,
            errors: [{
              code: "dev.gameplay_api_error",
              message: "Local gameplay API handler failed.",
              details: {
                reason: error instanceof Error ? error.name : "unknown"
              }
            }]
          }));
        }
      });
    }
  };
};

const readRequestBody = (
  request: DevIncomingRequest,
  method = "GET"
): Promise<string | null> => {
  if (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD") {
    return Promise.resolve(null);
  }

  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? "")));
    });
    request.on("end", () => {
      resolveBody(chunks.length > 0 ? Buffer.concat(chunks).toString("utf8") : null);
    });
    request.on("error", (error) => {
      rejectBody(error);
    });
  });
};

const normalizeRequestHeaders = (
  headers: Record<string, string | string[] | number | undefined>
): Record<string, string | string[] | undefined> =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      typeof value === "number" ? String(value) : value
    ])
  );

const hostedGameApiOrigin = resolveHostedGameApiOrigin();

export default defineConfig({
  plugins: [
    createLocalHostedHttpTimingPlugin(),
    createLocalHostedAdminBuildShaPlugin(),
    ...(hostedGameApiOrigin ? [] : [createGameplayApiMiddleware()])
  ],
  resolve: {
    alias: [
      {
        find: /^@empire\/shared-types$/,
        replacement: fromRoot("packages/shared-types/src/index.ts")
      },
      {
        find: /^@empire\/shared-types\/(.*)$/,
        replacement: fromRoot("packages/shared-types/src/$1")
      },
      {
        find: /^@empire\/game-core$/,
        replacement: fromRoot("packages/game-core/src/index.ts")
      },
      {
        find: /^@empire\/game-core\/(.*)$/,
        replacement: fromRoot("packages/game-core/src/$1")
      },
      {
        find: /^@empire\/game-config$/,
        replacement: fromRoot("packages/game-config/src/index.ts")
      },
      {
        find: /^@empire\/game-config\/(.*)$/,
        replacement: fromRoot("packages/game-config/src/$1")
      },
      {
        find: /^@empire\/tools-debug$/,
        replacement: fromRoot("tools/debug/src/index.ts")
      },
      {
        find: /^@empire\/tools-debug\/(.*)$/,
        replacement: fromRoot("tools/debug/src/$1")
      },
      {
        find: /^@empire\/tools-seed$/,
        replacement: fromRoot("tools/seed/src/index.ts")
      },
      {
        find: /^@empire\/tools-seed\/(.*)$/,
        replacement: fromRoot("tools/seed/src/$1")
      }
    ]
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    headers: {
      "Cache-Control": "no-store, max-age=0"
    },
    fs: {
      deny: [...GAME_DEV_FS_DENY]
    },
    ...(hostedGameApiOrigin ? {
      proxy: {
        "/api": createHostedGameApiProxyOptions(hostedGameApiOrigin)
      }
    } : {}),
    watch: {
      ignored: [...GAME_DEV_WATCH_IGNORED]
    }
  }
});
