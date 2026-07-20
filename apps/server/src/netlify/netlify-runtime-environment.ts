const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export const normalizeNetlifyFunctionEnvironment = (
  environment: Record<string, string | undefined>
): Record<string, string | undefined> => {
  if (environment.NODE_ENV === "production" || !isPublicNetlifyRuntime(environment)) {
    return environment;
  }

  return {
    ...environment,
    NODE_ENV: "production"
  };
};

const isPublicNetlifyRuntime = (environment: Record<string, string | undefined>): boolean => {
  const value = String(environment.URL ?? "").trim();
  if (!value) return Boolean(String(environment.SITE_ID ?? "").trim());

  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:")
      && !LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
};
