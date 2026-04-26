import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishDir = resolve(rootDir, "client");
const staticDirs = ["pages", "page-assets", "img"];

await rm(publishDir, { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });

for (const dir of staticDirs) {
  await cp(resolve(rootDir, dir), resolve(publishDir, dir), { recursive: true });
}

await writeFile(
  resolve(publishDir, "_redirects"),
  [
    "/ /pages/login.html 200",
    "/login.html /pages/login.html 200",
    "/lobby.html /pages/lobby.html 200",
    "/game.html /pages/game.html 200",
    "/faction.html /pages/faction.html 200",
    ""
  ].join("\n"),
  "utf8"
);

console.log(`Prepared Netlify publish directory: ${relative(rootDir, publishDir)}`);
