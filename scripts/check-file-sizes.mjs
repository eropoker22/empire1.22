import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["apps", "packages", "tools"];
const maxLines = 250;
const sourceFileBudgets = [
  // Existing large modules are explicit debt budgets. New or growing files still fail.
  ["apps/admin/src/pages/instance-list-page.ts", 736],
  ["apps/admin/src/read-models/admin-operations-console-view-model.ts", 654],
  ["apps/client/src/features/building-panel/index.ts", 255],
  ["apps/client/src/modals/overlay-state.ts", 384],
  ["apps/client/src/selectors/district-panel-view-model.ts", 322],
  ["apps/server/src/runtime/monitoring/admin-runtime-projection.ts", 635],
  ["apps/server/src/runtime/projections/gameplay-slice-projection-service.ts", 283],
  ["apps/server/src/transport/gameplay-command-payload-validation.ts", 279],
  ["packages/game-config/src/legacy-page/faction-config.js", 400],
  ["packages/game-config/src/contracts/balance-config.ts", 920],
  ["packages/game-config/src/modes/free/free-mode.override.ts", 507],
  ["packages/game-config/src/public/building-definitions.ts", 288],
  ["packages/game-config/src/public/faction-definitions.ts", 437],
  ["packages/game-core/src/contracts/civic-building-balance-config.ts", 327],
  ["packages/game-core/src/contracts/game-mode-config.ts", 945],
  ["packages/game-core/src/handlers/arcadeBuildingActions.ts", 301],
  ["packages/game-core/src/handlers/allianceMembership.ts", 399],
  ["packages/game-core/src/handlers/attackDistrict.ts", 439],
  ["packages/game-core/src/handlers/carDealerBuildingActions.ts", 272],
  ["packages/game-core/src/handlers/casinoBuildingActions.ts", 517],
  ["packages/game-core/src/handlers/centralBankPassive.ts", 259],
  ["packages/game-core/src/handlers/cityHallBuildingActions.ts", 305],
  ["packages/game-core/src/handlers/clinicBuildingActions.ts", 275],
  ["packages/game-core/src/handlers/convenienceStoreBuildingActions.ts", 424],
  ["packages/game-core/src/handlers/exchangeOfficeBuildingActions.ts", 467],
  ["packages/game-core/src/handlers/lobbyClubBuildingActions.ts", 457],
  ["packages/game-core/src/handlers/occupyDistrict.ts", 353],
  ["packages/game-core/src/handlers/powerStationBuildingActions.ts", 289],
  ["packages/game-core/src/handlers/recyclingCenterBuildingActions.ts", 273],
  ["packages/game-core/src/handlers/restaurantBuildingActions.ts", 363],
  ["packages/game-core/src/handlers/stockExchangePassive.ts", 259],
  ["packages/game-core/src/handlers/smugglingTunnelBuildingActions.ts", 420],
  ["packages/game-core/src/handlers/schoolBuildingActions.ts", 487],
  ["packages/game-core/src/handlers/stripClubBuildingActions.ts", 562],
  ["packages/game-core/src/handlers/vipLoungeBuildingActions.ts", 356],
  ["packages/game-core/src/handlers/useBuildingAction.ts", 635],
  ["packages/game-core/src/legacy-page/combat-preview-rules.js", 523],
  ["packages/game-core/src/projections/district-building-action-projection.ts", 830],
  ["packages/game-core/src/projections/district-building-finance-stats.ts", 266],
  ["packages/game-core/src/projections/district-panel-projection.ts", 300],
  ["packages/game-core/src/rules/economy/calculateIncome.ts", 445],
  ["packages/game-core/src/rules/economy/collectIncome.ts", 593],
  ["packages/game-core/src/rules/economy/fixedBuildingIncomeConfig.ts", 273],
  ["packages/game-core/src/rules/events/rumorPipeline.ts", 720],
  ["packages/game-core/src/rules/factions/factionRules.ts", 255],
  ["packages/game-core/src/rules/day-night/dayNightActionRules.ts", 255],
  ["packages/game-core/src/rules/day-night/dayNightModifiers.ts", 362],
  ["packages/game-core/src/rules/heists/heistSystem.ts", 1994],
  ["packages/game-core/src/rules/alliances/allianceLifecycle.ts", 1059],
  ["packages/game-core/src/rules/city-events/cityEventLifecycle.ts", 358],
  ["packages/game-core/src/rules/market/serverMarketSystem.ts", 2069],
  ["packages/shared-types/src/views/district-panel-view.ts", 296],
  ["packages/game-core/src/validation/validateRunBuildingAction.ts", 268],
  ["packages/game-core/src/validation/validateRunBuildingActionSpecifics.ts", 263],
  ["packages/game-config/src/base/base-balance-config.ts", 277],
  ["packages/game-config/src/validation/validate-mode-config.ts", 251],
  ["apps/client/src/browser/gameplay-slice-page.ts", 457],
  ["apps/server/src/auth/gameplay-session-service.ts", 369],
  ["apps/server/src/netlify/gameplay-slice-function.ts", 279],
  ["apps/server/src/runtime/instance-manager/atomic-command-dispatcher.ts", 309],
  ["apps/server/src/runtime/persistence/postgres/postgres-gameplay-identity-session-repository.ts", 310],
  ["tools/debug/src/closed-alpha-20p-simulation/simulation.ts", 5315],
  ["tools/debug/src/free-mode-pacing/actions.ts", 377],
  ["tools/debug/src/free-mode-pacing/factionPassiveAudit.ts", 256],
  ["tools/debug/src/free-mode-pacing/report.ts", 252]
];
const sourceFileBudgetByPath = new Map(sourceFileBudgets);
const generatedSourceHeadersByPath = new Map([
  [
    "packages/game-config/src/legacy-page/gameplay-config.generated.js",
    "// GENERATED FILE. Run `npm run generate:browser-config`; do not edit balance values here."
  ]
]);
const legacyFileBudgets = [
  {
    path: "page-assets/js/app/runtime.js",
    maxLines: 19284,
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
    const generatedHeader = generatedSourceHeadersByPath.get(relativePath);
    if (generatedHeader !== undefined) {
      if (!content.startsWith(generatedHeader)) {
        violations.push(`${relativePath} is listed as generated but its generated-file header is missing`);
      }
      continue;
    }
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
