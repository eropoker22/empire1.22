import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";

const LOADED_GAME_CSS = [
  "styles-foundation.css",
  "styles-game-classic.css",
  "styles-popups.css",
  "styles-auth-faction.css",
  "styles-game-redesign.css",
  "styles-building-modals.css",
  "styles-alliance.css",
  "styles-city-events.css",
  "styles-bounty.css",
  "styles-boost.css",
  "styles-onboarding.css",
  "styles-district.css",
  "styles-action-results.css",
  "styles-mobile-fixes.css",
  "styles-static-hover.css",
  "styles-market.css",
  "styles.css",
  "styles-game-admin-slice.css",
  "styles-closed-alpha-ux.css",
  "styles-game-lobby-modal.css",
  "styles-server-milestone-cards.css",
  "styles-login-about.css",
  "styles-game-about.css"
];

const normalize = (value) => String(value || "").trim().replace(/\s+/gu, " ");

function collectRuleSignatures(filename) {
  const source = readFileSync(resolve("page-assets/css", filename), "utf8");
  const root = postcss.parse(source, { from: filename });
  const signatures = [];

  root.walkRules((rule) => {
    const ancestry = [];
    for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
      if (parent.type === "atrule") ancestry.unshift(`@${parent.name} ${normalize(parent.params)}`);
    }
    const declarations = rule.nodes
      .filter((node) => node.type === "decl")
      .map((declaration) => `${declaration.prop}:${normalize(declaration.value)}${declaration.important ? "!important" : ""}`);
    signatures.push(`${ancestry.join("|")}\u0000${normalize(rule.selector)}\u0000${declarations.join(";")}`);
  });

  return signatures;
}

describe("loaded game CSS deduplication", () => {
  it("does not repeat an exact rule inside one loaded stylesheet", () => {
    const duplicates = [];
    for (const filename of LOADED_GAME_CSS) {
      const seen = new Set();
      for (const signature of collectRuleSignatures(filename)) {
        if (seen.has(signature)) duplicates.push(filename);
        seen.add(signature);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it("keeps terminal styles out of the imported mobile override file", () => {
    const importedMobileRules = new Set(collectRuleSignatures("styles-mobile-fixes.css"));
    const duplicatedTerminalRules = collectRuleSignatures("styles.css")
      .filter((signature) => importedMobileRules.has(signature));
    expect(duplicatedTerminalRules).toEqual([]);
  });
});
