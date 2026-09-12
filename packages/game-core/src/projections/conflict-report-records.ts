export const asNumberRecord = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      Number(entryValue ?? 0)
    ])
  );
};

export const asNumberRecordByKey = (value: unknown): Record<string, Record<string, number>> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      asNumberRecord(entryValue)
    ])
  );
};
