import { describe, expect, it } from "vitest";
import {
  findTechnicalBuildingText,
  gameChromeDynamicMaskSelector,
  normalizeParityClassNames,
  parityComputedStyleProperties,
  parityDynamicClassNames,
  parityViewports
} from "../e2e/helpers/uiParityCapture.js";

describe("UI parity class signature", () => {
  it("removes only explicitly allowlisted runtime state classes", () => {
    expect(normalizeParityClassNames([
      "district-popup-action",
      "district-popup-action--stacked",
      "district-popup-action__label",
      "district-popup-flag--good",
      "district-popup-flag--warning",
      "is-empty",
      "server-authoritative"
    ])).toEqual([
      "district-popup-action",
      "district-popup-action--stacked",
      "district-popup-action__label",
      "district-popup-flag--good",
      "district-popup-flag--warning"
    ]);
    expect(parityDynamicClassNames).toEqual([
      "is-active",
      "is-disabled",
      "is-empty",
      "is-loading",
      "is-selected",
      "local-demo",
      "server-authoritative"
    ]);
  });

  it("locks the ten requested viewports and detailed computed-style contract", () => {
    expect(parityViewports.map(({ width, height }) => `${width}x${height}`)).toEqual([
      "1440x900",
      "390x844",
      "320x568",
      "360x800",
      "430x932",
      "768x1024",
      "820x1180",
      "1024x768",
      "1366x768",
      "1920x1080"
    ]);
    expect(parityComputedStyleProperties).toEqual(expect.arrayContaining([
      "backgroundColor",
      "borderTopWidth",
      "color",
      "columnGap",
      "display",
      "flexDirection",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "gridTemplateColumns",
      "lineHeight",
      "marginTop",
      "maxWidth",
      "minWidth",
      "overflowY",
      "paddingTop",
      "rowGap",
      "visibility"
    ]));
    expect(gameChromeDynamicMaskSelector).toContain("[data-district-canvas]");
    expect(gameChromeDynamicMaskSelector).toContain("[data-topbar-clean-money]");
  });

  it("rejects technical hosted labels without rejecting shared gameplay copy", () => {
    const technicalText = findTechnicalBuildingText([
      "SERVER",
      "Raw projection",
      "Revision 42",
      "Ověří server",
      "Cena závisí na serverové odpovědi.",
      "Výsledek určí server.",
      "district:21",
      "Serverově sníží heat districtu.",
      "Mechaniky",
      "Efekty"
    ]);
    expect(technicalText).toEqual(expect.arrayContaining([
      "Cena závisí na serverové odpovědi.",
      "Ověří server",
      "Raw projection",
      "Revision 42",
      "SERVER",
      "Serverově sníží heat districtu.",
      "Výsledek určí server.",
      "district:21"
    ]));
    expect(technicalText).not.toContain("Mechaniky");
    expect(technicalText).not.toContain("Efekty");
  });
});
