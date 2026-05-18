const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const toBase64Url = (value: string): string =>
  bytesToBase64(encoder.encode(value))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/gu, "");

export const fromBase64Url = (value: string): string => {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return decoder.decode(bytes);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }

  return btoa(binary);
};
