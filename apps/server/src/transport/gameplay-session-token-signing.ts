import { createHmac, timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();

export const signGameplaySessionTokenPart = (
  version: string,
  payloadPart: string,
  secret: string
): string =>
  createHmac("sha256", secret)
    .update(`${version}.${payloadPart}`)
    .digest("base64url");

export const timingSafeEqualString = (left: string, right: string): boolean => {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);

  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};
