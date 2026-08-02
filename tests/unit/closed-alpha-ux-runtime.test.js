import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("page-assets/js/app/closed-alpha-ux-runtime.js", "utf8");

describe("closed alpha UX runtime", () => {
  it("does not add visible Street News category filters", () => {
    expect(source).not.toContain("data-news-filter");
    expect(source).not.toContain("SOUKROMÉ");
    expect(source).not.toContain("VEŘEJNÉ");
    expect(source).not.toContain("EKONOMIKA");
    expect(source).toContain("document.querySelectorAll(\"[data-street-news-filters]\").forEach");
  });

  it("does not render gameplay recommendations above the map", () => {
    expect(source).not.toContain("LIVENESS_LABELS");
    expect(source).not.toContain("Vyšpehuj sousední");
    expect(source).not.toContain("Prozkoumej nebo obsaď sousední");
    expect(source).toContain("dataset.operationalRecovery");
    expect(source).toContain("NOUZOVÁ OBNOVA");
  });

  it("mounts connection and recovery lifecycle surfaces only for server authority", () => {
    expect(source).toContain("const isServerLifecycleMode = () =>");
    expect(source).toContain("if (!isServerLifecycleMode()) return false;");
    expect(source).toContain('connection.className = "closed-alpha-connection lifecycle-status-chip";');
    expect(source).toContain('recovery.className = "operational-liveness-panel lifecycle-status-card";');
    expect(source).toContain("root.before(recovery);");
    expect(source).not.toContain("root.prepend(recovery);");
    expect(source).toContain("modal__content lifecycle-modal__card");
  });

  it("dismisses stale connection notices after authoritative recovery", () => {
    expect(source).toContain(
      'mode !== GAMEPLAY_EXECUTION_MODES.serverAuthoritative || connectionState === "connected"'
    );
    expect(source).toContain('modal?.dataset.sharedConfirmationKind === "connection"');
    expect(source).toContain('closeSharedModal(modal, "connection-restored")');
    expect(source).toContain("if (connectionState !== noticeState) return");
    expect(source).toContain(
      'if (detail.status === "ready" || detail.status === "connected") return "connected";'
    );
    expect(source).toContain(
      'if (["loading", "idle", "connecting", "reconnecting"].includes(detail.status)) return "reconnecting";'
    );
  });
});
