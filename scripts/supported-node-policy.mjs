export const SUPPORTED_NODE_MAJOR = 24;
export const SUPPORTED_NODE_RANGE = ">=24 <25";

export const parseNodeVersion = (value) => {
  const normalized = String(value ?? "").trim().replace(/^v/u, "");
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?$/u.exec(normalized);
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(major) ? { version: normalized, major } : null;
};

export const evaluateSupportedNodeVersion = (value) => {
  const parsed = parseNodeVersion(value);
  return {
    detectedVersion: parsed?.version ?? null,
    detectedMajor: parsed?.major ?? null,
    expectedMajor: SUPPORTED_NODE_MAJOR,
    supported: parsed?.major === SUPPORTED_NODE_MAJOR
  };
};

export const formatUnsupportedNodeMessage = (value) => {
  const result = evaluateSupportedNodeVersion(value);
  const detected = result.detectedVersion ?? `<unreadable: ${String(value ?? "") || "empty"}>`;
  return [
    `Empire Streets requires Node.js ${SUPPORTED_NODE_MAJOR} LTS.`,
    `Detected Node.js ${detected}.`,
    `Expected major version ${SUPPORTED_NODE_MAJOR} (${SUPPORTED_NODE_RANGE}).`,
    "Windows: switch to Node 24 with nvm-windows, fnm or Volta, then run node --version.",
    "Unix/macOS: run nvm use or fnm use so .nvmrc/.node-version selects Node 24.",
    "Switch runtimes before running builds, tests, migrations or deployment checks."
  ].join("\n");
};

export const assertSupportedNodeVersion = (value) => {
  const result = evaluateSupportedNodeVersion(value);
  if (!result.supported) throw new Error(formatUnsupportedNodeMessage(value));
  return result;
};
