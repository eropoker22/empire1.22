import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createEnvironmentInventoryArtifact,
  createEnvironmentMatrix,
  inventoryEnvironmentReads,
  renderEnvironmentMatrix
} from "./environment-matrix-contract.mjs";

const root = process.cwd();
const check = process.argv.includes("--check");
const markdownPath = path.join(root, "docs/deployment/environment-matrix.md");
const artifactPath = path.join(root, "artifacts/environment-read-inventory.json");
const inventory = inventoryEnvironmentReads({ root });
const matrix = createEnvironmentMatrix(inventory);
const markdown = renderEnvironmentMatrix(matrix);

if (check) {
  if (readFileSync(markdownPath, "utf8") !== markdown) {
    throw new Error("Environment matrix is stale. Run `npm run generate:environment-matrix`.");
  }
  console.log(`Environment matrix covers ${inventory.reads.length} static reads.`);
  process.exit(0);
}

mkdirSync(path.dirname(markdownPath), { recursive: true });
mkdirSync(path.dirname(artifactPath), { recursive: true });
writeFileSync(markdownPath, markdown, "utf8");
writeFileSync(artifactPath, `${JSON.stringify(createEnvironmentInventoryArtifact(matrix), null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(root, markdownPath)} and ${path.relative(root, artifactPath)}.`);
