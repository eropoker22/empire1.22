import { describe, expect, it } from "vitest";
import { normalizeParityClassNames } from "../e2e/helpers/uiParityCapture.js";

describe("UI parity class signature", () => {
  it("keeps shared structure while normalizing state and content modifiers", () => {
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
      "district-popup-flag"
    ]);
  });
});
