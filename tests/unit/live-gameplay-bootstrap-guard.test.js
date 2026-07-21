import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("live gameplay bootstrap authority", () => {
  it("loads the gameplay client only after a live membership is prepared", () => {
    const app = read("page-assets/js/app.js");
    const bootstrap = read("page-assets/js/app/runtime/liveGameplayBootstrap.js");
    const page = read("pages/game.html");

    expect(app).toContain("prepareLiveGameplayBootstrap(context.membership)");
    expect(bootstrap).toContain('membership?.status === "active"');
    expect(bootstrap).toContain("window.EmpireGameplaySliceClient?.mount");
    expect(page).not.toContain('<script src="../page-assets/js/client-assets/gameplay-slice-client.js"></script>');
  });

  it("does not use browser storage as gameplay identity", () => {
    const bootstrapSource = read("apps/client/src/browser/gameplay-slice-bootstrap.ts");
    const entryClient = read("page-assets/js/app/player-entry-client.js");

    expect(bootstrapSource).not.toContain("readLegacySession");
    expect(bootstrapSource).not.toContain("registration?.identity");
    expect(entryClient).not.toContain('localStorage.setItem("empireStreets.session.v1"');
  });
});
