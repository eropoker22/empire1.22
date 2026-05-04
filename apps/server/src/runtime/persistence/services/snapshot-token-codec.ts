import type { InstanceSnapshotDto } from "../dto";

const TOKEN_VERSION = "v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SnapshotTokenCodec {
  seal(snapshot: InstanceSnapshotDto): Promise<string>;
  open(token: string): Promise<InstanceSnapshotDto | null>;
}

export interface SnapshotTokenCodecOptions {
  secret: string;
  cryptoProvider?: SnapshotTokenCryptoProvider;
}

export type SnapshotTokenCryptoProvider = () => Crypto | Promise<Crypto>;

/**
 * Responsibility: Opaque sealed snapshot token codec for stateless edge/serverless
 * gameplay slice recovery.
 * Belongs here: authenticated encryption of persistence DTOs.
 * Does not belong here: transport routing or gameplay mutation.
 */
export const createSnapshotTokenCodec = (
  options: SnapshotTokenCodecOptions
): SnapshotTokenCodec => {
  const getCrypto = createCryptoProvider(options.cryptoProvider);
  let key: Promise<CryptoKey> | null = null;
  const getKey = () => {
    key ??= createAesKey(options.secret, getCrypto);
    return key;
  };

  return {
    seal: async (snapshot) => {
      const cryptoApi = await getCrypto();
      const iv = cryptoApi.getRandomValues(new Uint8Array(12));
      const encrypted = new Uint8Array(await cryptoApi.subtle.encrypt(
        {
          name: "AES-GCM",
          iv
        },
        await getKey(),
        encoder.encode(JSON.stringify(snapshot))
      ));

      return [
        TOKEN_VERSION,
        toBase64Url(iv),
        toBase64Url(encrypted)
      ].join(".");
    },
    open: async (token) => {
      const [version, ivPart, encryptedPart] = String(token || "").split(".");

      if (version !== TOKEN_VERSION || !ivPart || !encryptedPart) {
        return null;
      }

      try {
        const cryptoApi = await getCrypto();
        const decrypted = await cryptoApi.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: fromBase64Url(ivPart)
          },
          await getKey(),
          fromBase64Url(encryptedPart)
        );
        const parsed = JSON.parse(decoder.decode(decrypted));

        return isSnapshotDto(parsed) ? parsed : null;
      } catch (_error) {
        return null;
      }
    }
  };
};

const createAesKey = async (
  secret: string,
  getCrypto: () => Promise<Crypto>
): Promise<CryptoKey> => {
  const cryptoApi = await getCrypto();
  const digest = await cryptoApi.subtle.digest("SHA-256", encoder.encode(secret));
  return cryptoApi.subtle.importKey(
    "raw",
    digest,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
};

const createCryptoProvider = (
  provider: SnapshotTokenCryptoProvider | undefined
): (() => Promise<Crypto>) => {
  let cryptoApi: Promise<Crypto> | null = null;

  return () => {
    cryptoApi ??= Promise.resolve(provider ? provider() : readGlobalCrypto());
    return cryptoApi;
  };
};

const readGlobalCrypto = (): Crypto => {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle) {
    throw new Error("Web Crypto API is unavailable.");
  }

  return cryptoApi;
};

const toBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes)
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");

const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

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

const isSnapshotDto = (value: unknown): value is InstanceSnapshotDto => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<InstanceSnapshotDto>;
  return Boolean(candidate.snapshotId && candidate.instanceId && candidate.state && candidate.runtime);
};
