import { webcrypto } from "node:crypto";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import type { createGameplaySliceFunctionHandler } from "./apps/server/src/netlify/gameplay-slice-function";

const fromRoot = (...segments: string[]): string => resolve(__dirname, ...segments);

const gameplayApiPaths = [
  "/api/gameplay-slice/",
  "/api/servers",
  "/api/matchmaking/reserve",
  "/api/admin/monitoring"
];

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
        const path = new URL(request.url || "/", "http://localhost").pathname;
        if (!gameplayApiPaths.some((apiPath) => path === apiPath || path.startsWith(apiPath))) {
          next();
          return;
        }

        try {
          const handler = await getHandler();
          const result = await handler({
            httpMethod: request.method || "GET",
            path,
            body: await readRequestBody(request),
            headers: normalizeRequestHeaders(request.headers)
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

const readRequestBody = (request: { on(event: string, listener: (chunk?: unknown) => void): void }): Promise<string | null> =>
  new Promise((resolveBody, rejectBody) => {
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

const normalizeRequestHeaders = (
  headers: Record<string, string | string[] | number | undefined>
): Record<string, string | string[] | undefined> =>
  Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      typeof value === "number" ? String(value) : value
    ])
  );

export default defineConfig({
  plugins: [
    createGameplayApiMiddleware()
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
    strictPort: true
  }
});
