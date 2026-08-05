import { createHash } from "node:crypto";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const TLS_MODES = new Set(["require", "verify-ca", "verify-full"]);

export const validateReleaseDatabaseEndpoints = (environment) => {
  const endpoints = [
    parseNeonEndpoint(environment.EMPIRE_RELEASE_DATABASE_URL_DIRECT, "direct"),
    parseNeonEndpoint(environment.GAMEPLAY_RELEASE_DATABASE_URL_DIRECT, "direct"),
    parseNeonEndpoint(environment.EMPIRE_RELEASE_DATABASE_URL_POOLED, "pooled"),
    parseNeonEndpoint(environment.GAMEPLAY_RELEASE_DATABASE_URL_POOLED, "pooled")
  ];
  if (endpoints.some((endpoint) => endpoint === null)) {
    throw new Error("RELEASE_DATABASE_ENDPOINT_INVALID");
  }
  const resolved = endpoints.filter(Boolean);
  if (new Set(resolved.map((endpoint) => endpoint.targetIdentity)).size !== 1) {
    throw new Error("RELEASE_DATABASE_ENDPOINT_TARGET_MISMATCH");
  }
  const directSslModes = new Set(resolved.filter((endpoint) => endpoint.mode === "direct").map((endpoint) => endpoint.sslMode));
  const pooledSslModes = new Set(resolved.filter((endpoint) => endpoint.mode === "pooled").map((endpoint) => endpoint.sslMode));
  return {
    provider: "neon",
    providerHostnameHash: safeHash(resolved[0].normalizedHostname),
    databaseNameHash: safeHash(resolved[0].databaseName),
    directConnectionMode: "direct",
    pooledConnectionMode: "pooled",
    directSslModes: [...directSslModes].sort(),
    pooledSslModes: [...pooledSslModes].sort()
  };
};

const parseNeonEndpoint = (value, mode) => {
  try {
    const parsed = new URL(String(value ?? "").trim());
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) return null;
    if (!parsed.username || !parsed.password || LOOPBACK_HOSTNAMES.has(parsed.hostname)) return null;
    if (!parsed.hostname.endsWith(".neon.tech")) return null;
    const sslMode = parsed.searchParams.get("sslmode") ?? "";
    if (!TLS_MODES.has(sslMode)) return null;
    const labels = parsed.hostname.toLowerCase().split(".");
    const endpointLabel = labels[0] ?? "";
    const pooled = endpointLabel.endsWith("-pooler");
    if ((mode === "pooled") !== pooled) return null;
    const normalizedEndpointLabel = pooled ? endpointLabel.slice(0, -"-pooler".length) : endpointLabel;
    if (!/^ep-[a-z0-9-]+$/u.test(normalizedEndpointLabel)) return null;
    labels[0] = normalizedEndpointLabel;
    const normalizedHostname = labels.join(".");
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
    if (!databaseName || databaseName.includes("/")) return null;
    return {
      mode,
      normalizedHostname,
      databaseName,
      sslMode,
      targetIdentity: `${normalizedHostname}:${parsed.port || "5432"}/${databaseName}`
    };
  } catch {
    return null;
  }
};

const safeHash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 16);
