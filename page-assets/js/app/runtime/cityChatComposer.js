export const CITY_CHAT_FALLBACK_MAX_MESSAGE_LENGTH = 240;

export function resolveCityChatMaxMessageLength(cityChat) {
  const projectedLimit = Number(cityChat?.maxMessageLength);
  return Number.isSafeInteger(projectedLimit) && projectedLimit > 0
    ? projectedLimit
    : CITY_CHAT_FALLBACK_MAX_MESSAGE_LENGTH;
}

export function applyCityChatInputLimit(input, cityChat) {
  const maxMessageLength = resolveCityChatMaxMessageLength(cityChat);
  if (!input || typeof input !== "object") {
    return {
      value: "",
      length: 0,
      maxMessageLength,
      atLimit: false
    };
  }

  input.maxLength = maxMessageLength;
  const originalValue = String(input.value ?? "");
  const value = originalValue.slice(0, maxMessageLength);
  if (value !== originalValue) input.value = value;

  return {
    value,
    length: value.length,
    maxMessageLength,
    atLimit: value.length >= maxMessageLength
  };
}
