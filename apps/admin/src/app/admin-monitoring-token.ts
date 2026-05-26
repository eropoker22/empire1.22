const ADMIN_MONITORING_TOKEN_STORAGE_KEY = "empire.adminMonitoringToken";

export const resolveAdminMonitoringToken = (configuredToken?: string): string | null => {
  const explicitToken = configuredToken?.trim();
  if (explicitToken) {
    return explicitToken;
  }

  const runtimeToken = readRuntimeAdminMonitoringToken();
  if (runtimeToken) {
    return runtimeToken;
  }

  const queryToken = readQueryAdminMonitoringToken();
  if (queryToken) {
    writeSessionAdminMonitoringToken(queryToken);
    return queryToken;
  }

  return readSessionAdminMonitoringToken();
};

const readRuntimeAdminMonitoringToken = (): string | null => {
  const token = (globalThis as {
    __EMPIRE_ADMIN_MONITORING_TOKEN__?: string;
  }).__EMPIRE_ADMIN_MONITORING_TOKEN__?.trim();

  return token || null;
};

const readQueryAdminMonitoringToken = (): string | null => {
  const search = typeof window === "undefined" ? "" : window.location.search;
  if (!search) {
    return null;
  }

  const params = new URLSearchParams(search);
  return params.get("adminToken")?.trim()
    || params.get("empireAdminToken")?.trim()
    || null;
};

const readSessionAdminMonitoringToken = (): string | null => {
  try {
    return sessionStorage.getItem(ADMIN_MONITORING_TOKEN_STORAGE_KEY)?.trim() || null;
  } catch (_error) {
    return null;
  }
};

const writeSessionAdminMonitoringToken = (token: string): void => {
  try {
    sessionStorage.setItem(ADMIN_MONITORING_TOKEN_STORAGE_KEY, token);
  } catch (_error) {
    // Best-effort dev convenience only; the header is still sent for this request.
  }
};
