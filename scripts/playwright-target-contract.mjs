const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const PUBLIC_RELEASE_ENVIRONMENTS = new Set(["staging", "production"]);

export const resolvePlaywrightTarget = (environment, defaults = {}) => {
  const fallbackBaseUrl = String(defaults.baseURL ?? "http://127.0.0.1:4174");
  const skipWebServer = environment.PLAYWRIGHT_SKIP_WEB_SERVER === "1";
  const configuredBaseUrl = String(environment.PLAYWRIGHT_E2E_BASE_URL ?? "").trim();
  if (!skipWebServer || !configuredBaseUrl) {
    return Object.freeze({
      baseURL: fallbackBaseUrl,
      healthURL: `${fallbackBaseUrl}/api/servers`,
      useManagedWebServer: true
    });
  }
  const parsed = parseExactOrigin(configuredBaseUrl);
  if (LOOPBACK_HOSTS.has(parsed.hostname)) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("PLAYWRIGHT_EXTERNAL_ORIGIN_INVALID");
    }
  } else {
    const releaseEnvironment = String(environment.EMPIRE_RELEASE_ENVIRONMENT ?? "").trim();
    const publicOrigin = parseExactOrigin(environment.EMPIRE_PUBLIC_ORIGIN);
    if (!PUBLIC_RELEASE_ENVIRONMENTS.has(releaseEnvironment)
      || parsed.protocol !== "https:"
      || parsed.origin !== publicOrigin.origin) {
      throw new Error("PLAYWRIGHT_PUBLIC_ORIGIN_MISMATCH");
    }
  }
  const configuredHealthUrl = String(environment.PLAYWRIGHT_E2E_HEALTH_URL ?? "").trim();
  const healthURL = configuredHealthUrl
    ? parseSameOriginUrl(configuredHealthUrl, parsed.origin)
    : `${parsed.origin}/api/servers`;
  return Object.freeze({
    baseURL: parsed.origin,
    healthURL,
    useManagedWebServer: false
  });
};

const parseExactOrigin = (value) => {
  let parsed;
  try {
    parsed = new URL(String(value ?? "").trim());
  } catch {
    throw new Error("PLAYWRIGHT_EXTERNAL_ORIGIN_INVALID");
  }
  if (parsed.origin !== String(value ?? "").trim() || parsed.username || parsed.password) {
    throw new Error("PLAYWRIGHT_EXTERNAL_ORIGIN_INVALID");
  }
  return parsed;
};

const parseSameOriginUrl = (value, expectedOrigin) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("PLAYWRIGHT_HEALTH_URL_INVALID");
  }
  if (parsed.origin !== expectedOrigin || parsed.username || parsed.password) {
    throw new Error("PLAYWRIGHT_HEALTH_URL_INVALID");
  }
  return parsed.href;
};
