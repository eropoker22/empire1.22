import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["apps", "packages", "tools"];
const maxLines = 250;
const sourceFileBudgets = [
  // Existing large modules are explicit debt budgets. New or growing files still fail.
  ["packages/game-config/src/contracts/balance-config.ts", 860],
  ["packages/game-config/src/modes/free/free-mode.override.ts", 468],
  ["packages/game-config/src/public/building-definitions.ts", 288],
  ["packages/game-core/src/contracts/game-mode-config.ts", 885],
  ["packages/game-core/src/handlers/arcadeBuildingActions.ts", 301],
  ["packages/game-core/src/handlers/attackDistrict.ts", 419],
  ["packages/game-core/src/handlers/carDealerBuildingActions.ts", 271],
  ["packages/game-core/src/handlers/casinoBuildingActions.ts", 517],
  ["packages/game-core/src/handlers/clinicBuildingActions.ts", 253],
  ["packages/game-core/src/handlers/convenienceStoreBuildingActions.ts", 333],
  ["packages/game-core/src/handlers/exchangeOfficeBuildingActions.ts", 467],
  ["packages/game-core/src/handlers/powerStationBuildingActions.ts", 289],
  ["packages/game-core/src/handlers/recyclingCenterBuildingActions.ts", 273],
  ["packages/game-core/src/handlers/restaurantBuildingActions.ts", 285],
  ["packages/game-core/src/handlers/smugglingTunnelBuildingActions.ts", 420],
  ["packages/game-core/src/handlers/stripClubBuildingActions.ts", 459],
  ["packages/game-core/src/handlers/useBuildingAction.ts", 511],
  ["packages/game-core/src/projections/district-building-action-projection.ts", 743],
  ["packages/game-core/src/projections/district-panel-projection.ts", 297],
  ["packages/game-core/src/rules/economy/calculateIncome.ts", 432],
  ["packages/game-core/src/rules/economy/collectIncome.ts", 562],
  ["packages/game-core/src/rules/heists/heistSystem.ts", 1679],
  ["packages/game-core/src/rules/market/serverMarketSystem.ts", 2069],
  ["packages/game-core/src/validation/validateRunBuildingAction.ts", 253]
];
const sourceFileBudgetByPath = new Map(sourceFileBudgets);
const legacyFileBudgets = [
  {
    path: "page-assets/js/app/runtime.js",
    maxLines: 19146,
    forbiddenPatterns: [
      "apps/server",
      "@empire/game-core",
      "@empire/game-config"
    ]
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

    const content = fs.readFileSync(fullPath, "utf8");
    const lineCount = content.split(/\r?\n/).length;
    const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
    const sourceFileBudget = sourceFileBudgetByPath.get(relativePath);

    if (sourceFileBudget !== undefined) {
      if (lineCount > sourceFileBudget) {
        violations.push(`${relativePath} has ${lineCount} lines (explicit debt budget ${sourceFileBudget})`);
      }
      continue;
    }

    if (lineCount > maxLines) {
      violations.push(`${relativePath} has ${lineCount} lines (limit ${maxLines})`);
    }
  }
};

for (const sourceRoot of sourceRoots) {
  const fullPath = path.join(root, sourceRoot);
  if (fs.existsSync(fullPath)) {
    walk(fullPath);
  }
}

for (const budget of legacyFileBudgets) {
  const fullPath = path.join(root, budget.path);

  if (!fs.existsSync(fullPath)) {
    violations.push(`${budget.path} is missing from the explicit legacy file budget`);
    continue;
  }

  const content = fs.readFileSync(fullPath, "utf8");
  const lineCount = content.split(/\r?\n/).length;

  if (lineCount > budget.maxLines) {
    violations.push(`${budget.path} has ${lineCount} lines (legacy budget ${budget.maxLines})`);
  }

  for (const forbiddenPattern of budget.forbiddenPatterns) {
    if (content.includes(forbiddenPattern)) {
      violations.push(`${budget.path} contains forbidden legacy boundary pattern "${forbiddenPattern}"`);
    }
  }
}

if (violations.length > 0) {
  console.error("File size violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("File size checks passed.");
