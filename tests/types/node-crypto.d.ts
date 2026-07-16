declare module "node:crypto" {
  export const webcrypto: Crypto;
  export function createHmac(
    algorithm: "sha256",
    key: string
  ): {
    update(data: string): {
      digest(encoding: "base64url"): string;
    };
  };
  export function createHash(
    algorithm: "sha256"
  ): {
    update(data: string): {
      digest(encoding: "hex"): string;
    };
  };
  export function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean;
  export function randomUUID(): string;
  export function randomBytes(size: number): Uint8Array & { toString(encoding: "base64url"): string };
  export function scrypt(
    password: string,
    salt: Uint8Array,
    keyLength: number,
    options: { N: number; r: number; p: number; maxmem: number },
    callback: (error: Error | null, derivedKey: Uint8Array) => void
  ): void;
}
