import { describe, expect, it } from "vitest";
import { renderReportLayer } from "../../../apps/client/src/reports/report-layer";

describe("client report layer", () => {
  it("renders accepted commands without inventing a success report", () => {
    const html = renderReportLayer([], {
      lastCommandStatus: {
        commandId: "command:no-report",
        accepted: true
      }
    });

    expect(html).toContain("Poslední reporty");
    expect(html).toContain("data-report-command-status=\"accepted-without-report\"");
    expect(html).toContain("nevydal nový hráčský report");
    expect(html).not.toContain("data-report-highlight=\"latest-command\"");
  });

  it("renders rejected commands as errors without a fake success report", () => {
    const html = renderReportLayer([], {
      lastCommandStatus: {
        commandId: "command:rejected",
        accepted: false
      },
      errors: [
        {
          code: "spy_cooldown_active",
          message: "Spy route is still cooling down."
        }
      ]
    });

    expect(html).toContain("Akce odmítnuta");
    expect(html).toContain("Spy route is still cooling down.");
    expect(html).not.toContain("accepted-without-report");
  });
});
