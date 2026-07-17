import * as crypto from "node:crypto";

export interface AccountPasswordRecord {
  passwordHash: string;
  passwordSalt: string;
  passwordAlgorithm: "scrypt";
  passwordParameters: typeof PARAMETERS;
}

const PARAMETERS = Object.freeze({
  cost: 16_384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
  maxMemory: 64 * 1024 * 1024
});

export const hashAccountPassword = async (password: string): Promise<AccountPasswordRecord> => {
  assertPassword(password);
  const salt = crypto.randomBytes(32);
  const derived = await derive(password, salt, PARAMETERS);
  return {
    passwordHash: encode(derived),
    passwordSalt: salt.toString("base64url"),
    passwordAlgorithm: "scrypt",
    passwordParameters: { ...PARAMETERS }
  };
};

export const verifyAccountPassword = async (password: string, record: AccountPasswordRecord): Promise<boolean> => {
  if (!password || password.length > 1024 || record.passwordAlgorithm !== "scrypt") return false;
  try {
    const expected = decode(record.passwordHash);
    const actual = await derive(password, decode(record.passwordSalt), record.passwordParameters);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_error) {
    return false;
  }
};

const derive = (password: string, salt: Uint8Array, parameters: typeof PARAMETERS): Promise<Uint8Array> =>
  new Promise((resolve, reject) => crypto.scrypt(password, salt, parameters.keyLength, {
    N: parameters.cost,
    r: parameters.blockSize,
    p: parameters.parallelization,
    maxmem: parameters.maxMemory
  }, (error, result) => error ? reject(error) : resolve(result)));

const assertPassword = (password: string): void => {
  if (typeof password !== "string" || password.length < 12 || password.length > 1024) {
    throw new Error("Account password must contain between 12 and 1024 characters.");
  }
};

const decode = (value: string): Uint8Array => {
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

const encode = (value: Uint8Array): string => {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
};
