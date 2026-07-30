import "../../../../scripts/load-local-environment";
import * as http from "node:http";

const port = Number(process.env.EMPIRE_HOSTED_API_PORT ?? 8787);
const host = "127.0.0.1";
const { createGameplaySliceFunctionHandler } = await import("../netlify/gameplay-slice-function");
const handler = createGameplaySliceFunctionHandler({
  environment: {
    ...process.env,
    EMPIRE_HOSTED_RUNTIME_AUTHORITY_ENABLED: "true"
  }
});

const server = http.createServer(async (request, response) => {
  try {
    const body = await readBody(request);
    const result = await handler({
      httpMethod: request.method ?? "GET",
      path: request.url ?? "/",
      body,
      headers: request.headers
    });
    response.writeHead(result.statusCode, result.headers);
    response.end(result.body);
  } catch (error) {
    console.error(`[hosted-api] request failed ${createSafeErrorDiagnostic(error)}.`);
    response.writeHead(500, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({
      accepted: false,
      data: null,
      errors: [{ code: "DB_UNAVAILABLE", message: "Database unavailable." }]
    }));
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Empire Streets hosted API listening on http://${host}:${port}.\n`);
});

const shutdown = () => server.close(() => process.exit(0));
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

async function readBody(request: http.IncomingMessage): Promise<string | null> {
  request.setEncoding("utf8");
  return await new Promise<string | null>((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error("Request body exceeds local hosted API limit."));
    });
    request.on("end", () => resolve(body || null));
    request.on("error", reject);
  });
}

const createSafeErrorDiagnostic = (error: unknown): string => {
  const name = error instanceof Error ? error.name : "UnknownError";
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64)
    : "";
  const applicationFrame = error instanceof Error
    ? error.stack?.split(/\r?\n/).find((line) =>
        line.includes("STREETS") && !line.includes("node_modules")
      )?.trim().replace(/^at\s+/, "")
    : undefined;
  return [
    `name=${name}`,
    ...(code ? [`code=${code}`] : []),
    ...(applicationFrame ? [`at=${applicationFrame}`] : [])
  ].join(" ");
};
