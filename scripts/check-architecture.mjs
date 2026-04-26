import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["apps", "packages", "tools"];

const rules = [
  {
    scope: "apps/client/src",
    forbidden: ["@empire/game-core", "apps/server", "apps/admin", "@empire/game-config"]
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
    scope: "packages/game-core/src",
    forbidden: ["apps/server", "apps/client", "apps/admin", "react", "document", "window"]
  }
];

const violations = [];

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
        if (content.includes(forbidden)) {
          violations.push(`${relativePath} contains forbidden dependency/pattern "${forbidden}"`);
        }
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

if (violations.length > 0) {
  console.error("Architecture violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Architecture checks passed.");

