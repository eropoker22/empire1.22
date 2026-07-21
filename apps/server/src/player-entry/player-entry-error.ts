export const entryError = (code: string, message: string): Error =>
  Object.assign(new Error(message), { entryCode: code });

export const entryErrorCode = (error: unknown): string =>
  typeof error === "object" && error !== null && "entryCode" in error
    ? String((error as { entryCode: unknown }).entryCode)
    : "PLAYER_ENTRY_UNAVAILABLE";
