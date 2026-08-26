import { describe, expect, it } from "vitest";
import {
  CITY_CHAT_FALLBACK_MAX_MESSAGE_LENGTH,
  applyCityChatInputLimit,
  resolveCityChatMaxMessageLength
} from "../../page-assets/js/app/runtime/cityChatComposer.js";

describe("city chat composer", () => {
  it("uses the server-projected message limit", () => {
    expect(resolveCityChatMaxMessageLength({ maxMessageLength: 180 })).toBe(180);
    expect(resolveCityChatMaxMessageLength(null)).toBe(CITY_CHAT_FALLBACK_MAX_MESSAGE_LENGTH);
  });

  it("stops the draft at the projected maximum", () => {
    const input = { value: "abcdefgh" };

    const state = applyCityChatInputLimit(input, { maxMessageLength: 5 });

    expect(input.maxLength).toBe(5);
    expect(input.value).toBe("abcde");
    expect(state).toEqual({
      value: "abcde",
      length: 5,
      maxMessageLength: 5,
      atLimit: true
    });
  });
});
