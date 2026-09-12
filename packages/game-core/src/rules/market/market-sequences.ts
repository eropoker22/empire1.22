import type { ServerMarketState } from "./market-types";

// Counters survive cancellation, expiry and bounded history. Array length is not an ID.
export const restoreMarketSequence = (stored: unknown, entries: unknown): number => {
  const counter = Number.isSafeInteger(stored) && Number(stored) >= 0 ? Number(stored) : 0;
  if (!Array.isArray(entries)) return counter;
  return entries.reduce((next, entry) => {
    const suffix = typeof entry?.id === "string" ? Number(entry.id.split(":").at(-1)) : -1;
    return Number.isSafeInteger(suffix) && suffix >= 0 ? Math.max(next, suffix + 1) : next;
  }, counter);
};

export const takeMarketSequence = (market: ServerMarketState, kind: "listing" | "transaction"): number => {
  const key = kind === "listing" ? "nextListingSequence" : "nextTransactionSequence";
  const sequence = restoreMarketSequence(market[key], kind === "listing" ? market.playerListings : market.transactions);
  market[key] = sequence + 1;
  return sequence;
};
