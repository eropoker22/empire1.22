import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverSourceRoot = path.join(root, "apps", "server", "src");
const violations = [];

const productionSourceFiles = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (/\.(ts|tsx|js|mjs)$/u.test(entry.name)) {
      productionSourceFiles.push(fullPath);
    }
  }
};

const toRepoPath = (fullPath) => path.relative(root, fullPath).replace(/\\/g, "/");

const stripComments = (content) =>
  content
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:])\/\/.*$/gmu, "$1");

const readSource = (fullPath) => stripComments(fs.readFileSync(fullPath, "utf8"));

if (fs.existsSync(serverSourceRoot)) {
  walk(serverSourceRoot);
}

const allowedApplyCommandFiles = new Set([
  "apps/server/src/runtime/instance-manager/instance-command-dispatch.ts"
]);
const allowedDispatchInstanceCommandFiles = new Set([
  "apps/server/src/runtime/instance-manager/instance-command-dispatch.ts",
  "apps/server/src/runtime/instance-manager/instance-lifecycle-service.ts"
]);
const allowedLifecycleDispatchFiles = new Set([
  "apps/server/src/runtime/server-instance-manager.ts"
]);

for (const fullPath of productionSourceFiles) {
  const repoPath = toRepoPath(fullPath);
  const source = readSource(fullPath);

  if (source.includes("applyCommand") && !allowedApplyCommandFiles.has(repoPath)) {
    violations.push(`${repoPath} references applyCommand outside the awaited reservation dispatch boundary`);
  }

  if (source.includes("dispatchInstanceCommand") && !allowedDispatchInstanceCommandFiles.has(repoPath)) {
    violations.push(`${repoPath} references dispatchInstanceCommand outside InstanceLifecycleService`);
  }

  if (repoPath.startsWith("apps/server/src/transport/") || repoPath.startsWith("apps/server/src/netlify/")) {
    const forbiddenBoundaryImports = [
      "instance-lifecycle-service",
      "instance-command-dispatch",
      "@empire/game-core",
      "applyCommand",
      "dispatchInstanceCommand"
    ];
    for (const forbidden of forbiddenBoundaryImports) {
      if (source.includes(forbidden)) {
        violations.push(`${repoPath} contains forbidden production submit bypass reference "${forbidden}"`);
      }
    }
  }

  if (/\blifecycle\s*\.\s*dispatch\s*\(/u.test(source) && !allowedLifecycleDispatchFiles.has(repoPath)) {
    violations.push(`${repoPath} calls InstanceLifecycleService.dispatch outside ServerInstanceManager`);
  }

  for (const pattern of [
    /\bvoid\s+[^;\n]*\.\s*reserve\s*\(/u,
    /\bvoid\s+[^;\n]*\.\s*markApplied\s*\(/u,
    /\bvoid\s+[^;\n]*\.\s*markRejected\s*\(/u
  ]) {
    if (pattern.test(source)) {
      violations.push(`${repoPath} fire-and-forgets command reservation work`);
    }
  }
}

const requiredAsyncMarkers = [
  {
    path: "apps/server/src/runtime/instance-manager/instance-lifecycle-service.ts",
    markers: ["async dispatch(", "Promise<InstanceCommandDispatchResult>"]
  },
  {
    path: "apps/server/src/runtime/server-instance-manager.ts",
    markers: ["async dispatchCommand(", "Promise<InstanceCommandDispatchResult | undefined>"]
  },
  {
    path: "apps/server/src/transport/gameplay-slice-transport.ts",
    markers: ["submit(request: SubmitGameplayCommandRequest, authContext?: AuthContext | null): Promise<GameplaySliceResponse>", "const dispatchResult = await commandIngress.submit"]
  },
  {
    path: "apps/server/src/transport/gameplay-slice-json-handler.ts",
    markers: ["handle: async", "body: await transport.submit"]
  },
  {
    path: "apps/server/src/netlify/gameplay-slice-function.ts",
    markers: ["return await toFunctionResponse(await server.gameplaySliceJsonHandler.handle"]
  }
];

for (const requirement of requiredAsyncMarkers) {
  const fullPath = path.join(root, requirement.path);
  if (!fs.existsSync(fullPath)) {
    violations.push(`${requirement.path} is missing from command dispatch safety checks`);
    continue;
  }

  const source = readSource(fullPath);
  for (const marker of requirement.markers) {
    if (!source.includes(marker)) {
      violations.push(`${requirement.path} is missing async dispatch safety marker "${marker}"`);
    }
  }
}

if (violations.length > 0) {
  console.error("Command dispatch safety violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Command dispatch safety checks passed.");
