import { describe, expect, it } from "vitest";
import { renderDistrictPanel } from "../../../apps/client/src/features";
import { renderMap } from "../../../apps/client/src/map";
import { renderReportLayer } from "../../../apps/client/src/reports";
import { escapeUrlAttribute } from "../../../apps/client/src/shared-ui";
import { renderTopBarShell } from "../../../apps/client/src/ui";

const attack = "<img src=x onerror=alert(1)>";
const script = "<script>alert(1)</script>";
const attrBreakout = "bad\" autofocus=\"true";
const ampersand = "A & B";

describe("client HTML render escaping", () => {
  it("escapes district and building panel text and attributes", () => {
    const html = renderDistrictPanel({
      districtId: attrBreakout,
      title: attack,
      ownershipLabel: ampersand,
      statusLabel: "claimed",
      zoneLabel: script,
      heatLabel: "1",
      influenceLabel: "2",
      buildingSummary: "1 fixed",
      hasPendingCommand: false,
      trap: {
        actionLabel: attack,
        activeLabel: null,
        disabled: true,
        disabledReason: attrBreakout
      },
      spyTargets: [
        {
          districtId: attrBreakout,
          label: attack,
          ownerLabel: ampersand,
          statusLabel: script,
          disabled: true,
          disabledReason: attrBreakout
        }
      ],
      occupyTargets: [],
      attackTargets: [],
      buildings: [
        {
          buildingId: attrBreakout,
          buildingTypeId: "casino",
          label: attack,
          typeLabel: script,
          statusLabel: "active",
          summaryLabel: ampersand,
          zoneLabel: "downtown",
          roleLabel: ampersand,
          info: script,
          stats: [{ label: ampersand, value: attack }],
          specialActions: [
            {
              actionId: attrBreakout,
              label: attack,
              description: script,
              effectSummary: ampersand,
              durationLabel: "5s",
              heatLabel: "+1",
              cooldownLabel: "Ready",
              cooldownEndsAtMs: null,
              cooldownRemainingMs: 0,
              disabled: true,
              disabledReason: attrBreakout
            }
          ],
          actions: [
            {
              actionId: attrBreakout,
              label: attack,
              description: script,
              statusLabel: "ready",
              inputSummary: ampersand,
              outputSummary: attack,
              heatLabel: "+1",
              influenceLabel: "0",
              expectedEffectSummary: [script],
              riskSummary: [attack],
              inputs: [
                {
                  id: attrBreakout,
                  type: "select",
                  label: attrBreakout,
                  options: [{ value: attrBreakout, label: attack }]
                }
              ],
              disabled: true,
              disabledReason: attrBreakout,
              cooldownLabel: "Ready",
              cooldownEndsAtMs: null,
              cooldownRemainingMs: 0
            }
          ]
        }
      ],
      slots: []
    } as never);

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain('autofocus="true"');
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("bad&quot; autofocus=&quot;true");
  });

  it("escapes map, report, and topbar renderer output", () => {
    const mapHtml = renderMap({
      selectedDistrictId: attrBreakout,
      districts: [
        {
          districtId: attrBreakout,
          label: attack,
          ownerLabel: ampersand,
          zoneLabel: script,
          heatLabel: "3",
          influenceLabel: "4",
          buildingSummary: ampersand,
          ownerPlayerId: null,
          ownerColor: "#ef4444\" onmouseover=\"alert(1)",
          isOwnedByPlayer: false,
          isContested: false,
          isDestroyed: false,
          isSelected: true,
          isAttackTarget: true,
          attackEnabled: false,
          attackDisabledReason: script
        }
      ]
    });
    const reportHtml = renderReportLayer([
      {
        id: attrBreakout,
        reportType: attrBreakout,
        category: ampersand,
        severity: attrBreakout,
        title: attack,
        result: script,
        summary: ampersand,
        details: [attack, script],
        messages: [script],
        createdAt: attrBreakout
      }
    ] as never);
    const topbarHtml = renderTopBarShell({
      player: {
        modeLabel: attrBreakout,
        playerId: attack,
        homeDistrictId: attrBreakout,
        resourceSummary: ampersand,
        notificationCount: 1,
        police: {
          raidConsequenceStatus: attrBreakout,
          selectedDistrictHeatLabel: attack,
          protectionLabel: ampersand,
          heatLabel: script,
          wantedLevelLabel: ampersand,
          pendingRaidLabel: attack
        },
        dayNight: {
          uiThemeHint: attrBreakout,
          label: script,
          effectSummary: [attack, ampersand],
          remainingTicks: 3
        }
      } as never
    });
    const html = [mapHtml, reportHtml, topbarHtml].join("");

    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).not.toContain('autofocus="true"');
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("bad&quot; autofocus=&quot;true");
  });

  it("blocks script URLs in shared client URL attributes", () => {
    expect(escapeUrlAttribute("javascript:alert(1)")).toBe("");
    expect(escapeUrlAttribute("java\nscript:alert(1)")).toBe("");
    expect(escapeUrlAttribute("../img/avatar.png?name=A&B")).toBe("../img/avatar.png?name=A&amp;B");
    expect(escapeUrlAttribute("https://example.test/avatar.png?name=A&B")).toBe(
      "https://example.test/avatar.png?name=A&amp;B"
    );
  });
});
