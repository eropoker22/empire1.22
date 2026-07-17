import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

describe("lobby browser back logout guard", () => {
  it("uses a re-armed history sentinel instead of mobile beforeunload", () => {
    const source = read("page-assets/js/lobby.js");

    expect(source).toContain("const armBackLogoutGuard = () =>");
    expect(source).toContain("window.history.replaceState({ empireLobby: LOBBY_HISTORY_ACTIVE_STATE }");
    expect(source).toContain("window.history.pushState({ empireLobby: LOBBY_HISTORY_GUARD_STATE }");
    expect(source).toContain('window.addEventListener("popstate"');
    expect(source).toContain('window.addEventListener("pageshow"');
    expect(source).toContain("promptLobbyLogoutConfirmation().then");
    expect(source).toContain("clearAccountIdentity();");
    expect(source).not.toContain("clearAuthSession();");
    expect(source).not.toContain('window.addEventListener("beforeunload"');
  });
});

