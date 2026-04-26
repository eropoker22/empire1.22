import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["apps", "packages", "tools"];
const maxLines = 250;
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

if (violations.length > 0) {
  console.error("File size violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("File size checks passed.");

