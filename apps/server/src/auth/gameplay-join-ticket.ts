import * as crypto from "node:crypto";
import type {
  CreateGameplayJoinTicketInput,
  JoinTicketRecord
} from "./gameplay-session-service";

export const prepareGameplayJoinTicket = (
  input: CreateGameplayJoinTicketInput,
  ticketTtlMs = 5 * 60 * 1000
): JoinTicketRecord => ({
  ticketId: input.ticketId ?? `join:${randomToken()}`,
  accountId: input.accountId,
  serverInstanceId: input.serverInstanceId,
  mode: input.mode,
  factionId: input.factionId ?? null,
  issuedAt: input.nowIso,
  expiresAt: new Date(Date.parse(input.nowIso) + ticketTtlMs).toISOString(),
  consumedAt: null,
  nonce: randomToken()
});

const randomToken = (): string =>
  toBase64Url((crypto as unknown as {
    randomFillSync(target: Uint8Array): Uint8Array;
  }).randomFillSync(new Uint8Array(32)));

const toBase64Url = (bytes: Uint8Array): string => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const triplet = (first << 16) | (second << 8) | third;
    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    if (index + 1 < bytes.length) output += alphabet[(triplet >> 6) & 63];
    if (index + 2 < bytes.length) output += alphabet[triplet & 63];
  }
  return output;
};
