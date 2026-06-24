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
}
