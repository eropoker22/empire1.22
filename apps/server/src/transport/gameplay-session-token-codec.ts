import type { PlayerFactionId, PlayerId, ServerInstanceId } from "@empire/shared-types";

const TOKEN_VERSION = "v1";
const encoder = new TextEncoder();

export interface GameplaySessionTokenPayload {
  serverInstanceId: ServerInstanceId;
  playerId: PlayerId;
  factionId?: PlayerFactionId | string | null;
  issuedAt: string;
}

export interface GameplaySessionTokenCodec {
  seal(payload: GameplaySessionTokenPayload): string;
  open(token: string): GameplaySessionTokenPayload | null;
}

export interface GameplaySessionTokenCodecOptions {
  secret: string;
}

/**
 * Responsibility: Tamper-resistant gameplay session token for server-fed slice requests.
 * Belongs here: binding player/session identity to a signed transport token.
 * Does not belong here: OAuth providers, account lookup, or gameplay rules.
 */
export const createGameplaySessionTokenCodec = (
  options: GameplaySessionTokenCodecOptions
): GameplaySessionTokenCodec => ({
  seal: (payload) => {
    const payloadPart = toBase64Url(JSON.stringify(payload));
    const signature = signTokenPart(payloadPart, options.secret);
    return [TOKEN_VERSION, payloadPart, signature].join(".");
  },
  open: (token) => {
    const [version, payloadPart, signature] = String(token || "").split(".");
    if (version !== TOKEN_VERSION || !payloadPart || !signature) {
      return null;
    }

    const expectedSignature = signTokenPart(payloadPart, options.secret);
    if (!timingSafeEqualString(signature, expectedSignature)) {
      return null;
    }

    try {
      const parsed = JSON.parse(fromBase64Url(payloadPart));
      return isGameplaySessionTokenPayload(parsed) ? parsed : null;
    } catch (_error) {
      return null;
    }
  }
});

const signTokenPart = (payloadPart: string, secret: string): string =>
  toBase64UrlBytes(hmacSha256(
    encoder.encode(secret),
    encoder.encode(`${TOKEN_VERSION}.${payloadPart}`)
  ));

const timingSafeEqualString = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
};

const toBase64Url = (value: string): string =>
  toBase64UrlBytes(encoder.encode(value));

const fromBase64Url = (value: string): string =>
  new TextDecoder().decode(fromBase64UrlBytes(value));

const toBase64UrlBytes = (bytes: Uint8Array): string =>
  bytesToBase64(bytes)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");

const fromBase64UrlBytes = (value: string): Uint8Array => {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }

  return btoa(binary);
};

const hmacSha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => {
  const blockSize = 64;
  const normalizedKey = new Uint8Array(blockSize);
  normalizedKey.set(key.length > blockSize ? sha256(key) : key);

  const outerKeyPad = new Uint8Array(blockSize);
  const innerKeyPad = new Uint8Array(blockSize);
  for (let index = 0; index < blockSize; index += 1) {
    outerKeyPad[index] = normalizedKey[index]! ^ 0x5c;
    innerKeyPad[index] = normalizedKey[index]! ^ 0x36;
  }

  return sha256(concatBytes(outerKeyPad, sha256(concatBytes(innerKeyPad, message))));
};

const sha256 = (message: Uint8Array): Uint8Array => {
  const hash = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19
  ]);
  const padded = padSha256Message(message);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const wordOffset = offset + index * 4;
      words[index] = (
        (padded[wordOffset]! << 24) |
        (padded[wordOffset + 1]! << 16) |
        (padded[wordOffset + 2]! << 8) |
        padded[wordOffset + 3]!
      ) >>> 0;
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15]!, 7) ^ rotateRight(words[index - 15]!, 18) ^ (words[index - 15]! >>> 3);
      const s1 = rotateRight(words[index - 2]!, 17) ^ rotateRight(words[index - 2]!, 19) ^ (words[index - 2]! >>> 10);
      words[index] = (words[index - 16]! + s0 + words[index - 7]! + s1) >>> 0;
    }

    let a = hash[0]!;
    let b = hash[1]!;
    let c = hash[2]!;
    let d = hash[3]!;
    let e = hash[4]!;
    let f = hash[5]!;
    let g = hash[6]!;
    let h = hash[7]!;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[index]! + words[index]!) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0]! + a) >>> 0;
    hash[1] = (hash[1]! + b) >>> 0;
    hash[2] = (hash[2]! + c) >>> 0;
    hash[3] = (hash[3]! + d) >>> 0;
    hash[4] = (hash[4]! + e) >>> 0;
    hash[5] = (hash[5]! + f) >>> 0;
    hash[6] = (hash[6]! + g) >>> 0;
    hash[7] = (hash[7]! + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  for (let index = 0; index < hash.length; index += 1) {
    const value = hash[index]!;
    digest[index * 4] = value >>> 24;
    digest[index * 4 + 1] = value >>> 16;
    digest[index * 4 + 2] = value >>> 8;
    digest[index * 4 + 3] = value;
  }

  return digest;
};

const padSha256Message = (message: Uint8Array): Uint8Array => {
  const bitLength = message.length * 8;
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength, false);
  return padded;
};

const concatBytes = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
};

const rotateRight = (value: number, shift: number): number =>
  (value >>> shift) | (value << (32 - shift));

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const isGameplaySessionTokenPayload = (
  value: unknown
): value is GameplaySessionTokenPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GameplaySessionTokenPayload>;
  return (
    typeof candidate.serverInstanceId === "string" &&
    candidate.serverInstanceId.trim().length > 0 &&
    typeof candidate.playerId === "string" &&
    candidate.playerId.trim().length > 0 &&
    typeof candidate.issuedAt === "string" &&
    candidate.issuedAt.trim().length > 0 &&
    (
      candidate.factionId === undefined ||
      candidate.factionId === null ||
      typeof candidate.factionId === "string"
    )
  );
};
