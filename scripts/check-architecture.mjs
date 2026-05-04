import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["apps", "packages", "tools"];
const requiredSourceBoundaryRules = [
  {
    path: ".gitignore",
    required: ["client/"],
    message: "client/ must stay treated as generated publish output, not editable source"
  },
  {
    path: "scripts/build-netlify-client.mjs",
    required: [
      'const publishDir = resolve(rootDir, "client");',
      '"pages"',
      '"page-assets"',
      '"img"'
    ],
    message: "Netlify publish output must be generated from canonical root static assets"
  }
];
const productionPageRules = [
  {
    path: "pages/game.html",
    forbidden: [
      "page-assets/js/admin-assets/admin-slice-demo.js",
      "page-assets/js/admin-dashboard/admin.js",
      "tools/debug",
      "debugSlice=1"
    ],
    message: "game page must not eagerly load the debug/admin gameplay slice bundle"
  }
];
const devLauncherRules = [
  {
    path: "page-assets/js/app/game-admin-slice-launcher.js",
    required: [
      'const ADMIN_SLICE_SCRIPT_SRC = "../page-assets/js/admin-assets/admin-slice-demo.js";',
      'const DEBUG_STORAGE_KEY = "empire:debug:adminSlice";',
      'params.get("debugSlice") === "1"',
      "window.localStorage.getItem(DEBUG_STORAGE_KEY) === \"1\"",
      "if (!isAdminSliceDebugEnabled())"
    ],
    message: "debug/admin slice launcher must stay explicit opt-in only"
  }
];
const requiredAuthorityFiles = [
  "packages/game-core/src/engine/applyCommand.ts",
  "packages/game-core/src/handlers/attackDistrict.ts",
  "packages/game-core/src/handlers/collectProduction.ts",
  "packages/game-core/src/handlers/craftItem.ts",
  "packages/game-core/src/handlers/playerPoliceState.ts",
  "packages/game-core/src/rules/police/triggerRaid.ts",
  "packages/game-core/src/rules/production/queueProduction.ts",
  "packages/game-core/src/rules/victory/checkVictory.ts",
  "apps/server/src/runtime/orchestration/instance-command-router.ts",
  "apps/server/src/runtime/orchestration/tick-orchestrator.ts"
];

const rules = [
  {
    scope: "apps/client/src",
    forbidden: [
      "@empire/game-core",
      "apps/server",
      "apps/admin",
      "@empire/game-config",
      "page-assets/js/app/runtime",
      "page-assets/js/app"
    ]
  },
  {
    scope: "apps/admin/src",
    forbidden: ["@empire/game-core", "apps/client"]
  },
  {
    scope: "apps/server/src/transport",
    forbidden: ["@empire/game-core"]
  },
  {
    scope: "apps/server/src",
    forbidden: ["localStorage", "window", "document", "page-assets/js/app/runtime", "page-assets/js/app"]
  },
  {
    scope: "packages/game-core/src",
    forbidden: [
      "apps/server",
      "apps/client",
      "apps/admin",
      "react",
      "document",
      "window",
      "localStorage",
      "page-assets/js/app/runtime",
      "page-assets/js/app"
    ]
  }
];
const deprecatedImportRules = [
  {
    pattern: /from\s+["']@empire\/shared(?:["']|\/)/,
    message: "use @empire/shared-types instead of deprecated @empire/shared"
  },
  {
    pattern: /from\s+["']@empire\/debug-tools(?:["']|\/)/,
    message: "use tools/debug or tools/seed instead of deprecated @empire/debug-tools"
  }
];
const browserApiForbidden = new Set(["window", "document", "localStorage"]);
const browserApiPatterns = [
  {
    label: "window.*",
    pattern: /\bwindow\s*(?:\.|\[)/
  },
  {
    label: "document.*",
    pattern: /\bdocument\s*(?:\.|\[)/
  },
  {
    label: "localStorage",
    pattern: /\blocalStorage\b/
  },
  {
    label: "globalThis.window",
    pattern: /\bglobalThis\s*(?:\.\s*window|\[\s*["']window["']\s*\])/
  },
  {
    label: "globalThis.document",
    pattern: /\bglobalThis\s*(?:\.\s*document|\[\s*["']document["']\s*\])/
  },
  {
    label: "globalThis.localStorage",
    pattern: /\bglobalThis\s*(?:\.\s*localStorage|\[\s*["']localStorage["']\s*\])/
  }
];

const violations = [];

const stripComments = (content) =>
  content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const hasForbiddenBrowserApi = (content, forbidden) => {
  if (!browserApiForbidden.has(forbidden)) {
    return false;
  }

  const codeWithoutComments = stripComments(content);
  return browserApiPatterns.some((entry) =>
    entry.label === forbidden
      || entry.label.startsWith(`${forbidden}.`)
      || (forbidden === "window" && entry.label === "globalThis.window")
      || (forbidden === "document" && entry.label === "globalThis.document")
      || (forbidden === "localStorage" && entry.label === "globalThis.localStorage")
      ? entry.pattern.test(codeWithoutComments)
      : false
  );
};

const hasForbiddenPattern = (content, forbidden) =>
  browserApiForbidden.has(forbidden)
    ? hasForbiddenBrowserApi(content, forbidden)
    : content.includes(forbidden);

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      continue;
    }

    const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
    const content = fs.readFileSync(fullPath, "utf8");

    for (const rule of rules) {
      if (!relativePath.startsWith(rule.scope)) {
        continue;
      }

      for (const forbidden of rule.forbidden) {
        if (hasForbiddenPattern(content, forbidden)) {
          violations.push(`${relativePath} contains forbidden dependency/pattern "${forbidden}"`);
        }
      }
    }

    for (const rule of deprecatedImportRules) {
      if (rule.pattern.test(content)) {
        violations.push(`${relativePath} imports a deprecated package (${rule.message})`);
      }
    }
  }
};

for (const sourceRoot of sourceRoots) {
  const fullPath = path.join(root, sourceRoot);
  if (fs.existsSync(fullPath)) {
    walk(fullPath);
  }
}

const readRequiredFile = (relativePath) => {
  const fullPath = path.join(root, relativePath);

  if (!fs.existsSync(fullPath)) {
    violations.push(`${relativePath} is required by architecture checks but is missing`);
    return "";
  }

  return fs.readFileSync(fullPath, "utf8");
};

for (const rule of requiredSourceBoundaryRules) {
  const content = readRequiredFile(rule.path);

  for (const required of rule.required) {
    if (!content.includes(required)) {
      violations.push(`${rule.path} is missing required architecture marker "${required}" (${rule.message})`);
    }
  }
}

for (const rule of productionPageRules) {
  const content = readRequiredFile(rule.path);

  for (const forbidden of rule.forbidden) {
    if (content.includes(forbidden)) {
      violations.push(`${rule.path} contains forbidden production page pattern "${forbidden}" (${rule.message})`);
    }
  }
}

for (const rule of devLauncherRules) {
  const content = readRequiredFile(rule.path);

  for (const required of rule.required) {
    if (!content.includes(required)) {
      violations.push(`${rule.path} is missing required guarded-debug marker "${required}" (${rule.message})`);
    }
  }
}

for (const file of requiredAuthorityFiles) {
  const fullPath = path.join(root, file);

  if (!fs.existsSync(fullPath)) {
    violations.push(`${file} is required so gameplay authority is not only in page-assets/js/app/runtime.js`);
  }
}

if (violations.length > 0) {
  console.error("Architecture violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Architecture checks passed.");
