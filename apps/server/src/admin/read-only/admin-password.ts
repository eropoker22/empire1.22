import * as crypto from "node:crypto";
import type { AdminUserRecord } from "./admin-repositories";

export const ADMIN_PASSWORD_ALGORITHM = "scrypt" as const;
export const ADMIN_PASSWORD_PARAMETERS = Object.freeze({
  cost: 16_384,
  blockSize: 8,
  parallelization: 1,
  keyLength: 64,
  maxMemory: 64 * 1024 * 1024
});

export const normalizeAdminUsername = (username: string): string =>
  username.normalize("NFKC").trim().toLocaleLowerCase("en-US");

export const hashAdminPassword = async (password: string): Promise<Pick<AdminUserRecord,
  "passwordHash" | "passwordSalt" | "passwordAlgorithm" | "passwordParameters">> => {
  assertPasswordInput(password);
  const salt = crypto.randomBytes(32);
  const derived = await derive(password, salt, ADMIN_PASSWORD_PARAMETERS);
  return {
    passwordHash: encode(derived),
    passwordSalt: salt.toString("base64url"),
    passwordAlgorithm: ADMIN_PASSWORD_ALGORITHM,
    passwordParameters: { ...ADMIN_PASSWORD_PARAMETERS }
  };
};

export const verifyAdminPassword = async (password: string, user: AdminUserRecord): Promise<boolean> => {
  if (user.passwordAlgorithm !== ADMIN_PASSWORD_ALGORITHM || !password || password.length > 1024) return false;
  try {
    const salt = decode(user.passwordSalt);
    const expected = decode(user.passwordHash);
    const actual = await derive(password, salt, user.passwordParameters);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch (_error) {
    return false;
  }
};

export const adminPasswordNeedsRehash = (user: AdminUserRecord): boolean =>
  user.passwordAlgorithm !== ADMIN_PASSWORD_ALGORITHM ||
  Object.entries(ADMIN_PASSWORD_PARAMETERS).some(([key, value]) =>
    user.passwordParameters[key as keyof typeof ADMIN_PASSWORD_PARAMETERS] !== value);

const derive = (
  password: string,
  salt: Uint8Array,
  parameters: AdminUserRecord["passwordParameters"]
): Promise<Uint8Array> => new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, parameters.keyLength, {
    N: parameters.cost,
    r: parameters.blockSize,
    p: parameters.parallelization,
    maxmem: parameters.maxMemory
  }, (error, result) => error ? reject(error) : resolve(result));
});

const assertPasswordInput = (password: string): void => {
  if (typeof password !== "string" || password.length < 12 || password.length > 1024) {
    throw new Error("Admin password must contain between 12 and 1024 characters.");
  }
};

const encode = (value: Uint8Array): string => {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
};
const decode = (value: string): Uint8Array => {
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};
