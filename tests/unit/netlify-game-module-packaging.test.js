import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { expect, it } from "vitest";
import { collectModuleImports } from "../../scripts/production-game-import-graph.mjs";

it("publishes every static dependency of the live game entry", () => {
  const repository = process.cwd();
  const fixture = mkdtempSync(join(tmpdir(), "empire-netlify-modules-"));
  const buildScript = readFileSync(resolve(repository, "scripts/build-netlify-client.mjs"), "utf8");
  const readList = (name) => Array.from(
    buildScript.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`))?.[1]
      .matchAll(/"([^"]+)"/gu) ?? [],
    (match) => match[1]
  );
  const write = (path, source) => {
    mkdirSync(dirname(join(fixture, path)), { recursive: true });
    writeFileSync(join(fixture, path), source);
  };
  const modules = new Set();
  const visit = (path) => {
    if (modules.has(path)) return;
    modules.add(path);
    const source = readFileSync(resolve(repository, path), "utf8");
    write(path, source);
    for (const dependency of collectModuleImports(path, source)) {
      if (!["static-import", "export-from"].includes(dependency.kind)) continue;
      expect(dependency.specifier.startsWith("."), `${path}: browser import must be relative`).toBe(true);
      visit(posix.normalize(posix.join(posix.dirname(path), dependency.specifier.split(/[?#]/u)[0])));
    }
  };
  try {
    write("scripts/build-netlify-client.mjs", buildScript);
    for (const dir of readList("staticDirs")) mkdirSync(join(fixture, dir), { recursive: true });
    for (const file of new Set([...readList("staticPageFiles"), ...readList("requiredPublishFiles")])) {
      write(file, "fixture");
    }
    visit("page-assets/js/app.js");
    execFileSync(process.execPath, [join(fixture, "scripts/build-netlify-client.mjs")], { stdio: "pipe" });
    const missing = [...modules].filter((path) => !existsSync(join(fixture, "client", path)));
    expect(missing, "Live game modules omitted from the actual publish output").toEqual([]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
