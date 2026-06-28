let runtimeAdminMonitoringSecret: string | null = null;

export const resolveAdminMonitoringSecret = (configuredSecret?: string): string | null => {
  const explicitSecret = configuredSecret?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const runtimeSecret = readRuntimeAdminMonitoringSecret();
  if (runtimeSecret) {
    return runtimeSecret;
  }

  return runtimeAdminMonitoringSecret;
};

export const setRuntimeAdminMonitoringSecret = (secret: string | null | undefined): void => {
  const normalizedSecret = String(secret ?? "").trim();
  runtimeAdminMonitoringSecret = normalizedSecret || null;
};

const readRuntimeAdminMonitoringSecret = (): string | null => {
  const secret = (globalThis as {
    __EMPIRE_ADMIN_SECRET__?: string;
  }).__EMPIRE_ADMIN_SECRET__?.trim();

  return secret || null;
};
