import type {
  AdminApiResponse,
  AdminInstanceDetailView,
  AdminOverviewView,
  AdminSessionView
} from "@empire/shared-types";

export class AdminApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

export interface AdminApiClient {
  getSession(signal?: AbortSignal): Promise<AdminSessionView>;
  login(secret: string, signal?: AbortSignal): Promise<AdminSessionView>;
  logout(signal?: AbortSignal): Promise<void>;
  getOverview(signal?: AbortSignal): Promise<AdminOverviewView>;
  getInstance(instanceId: string, signal?: AbortSignal): Promise<AdminInstanceDetailView>;
}

export const createAdminApiClient = (basePath = "/api/admin"): AdminApiClient => ({
  getSession: (signal) => request<AdminSessionView>(`${basePath}/session`, { signal }),
  login: (secret, signal) => request<AdminSessionView>(`${basePath}/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret }),
    signal
  }),
  logout: async (signal) => {
    await request<null>(`${basePath}/session`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal
    });
  },
  getOverview: (signal) => request<AdminOverviewView>(`${basePath}/overview`, { signal }),
  getInstance: (instanceId, signal) => request<AdminInstanceDetailView>(
    `${basePath}/instances/${encodeURIComponent(instanceId)}`,
    { signal }
  )
});

const request = async <T>(url: string, init: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { accept: "application/json", ...init.headers },
    cache: "no-store",
    ...init
  });
  const payload = await response.json().catch(() => null) as AdminApiResponse<T> | null;
  if (!response.ok || !payload?.accepted) {
    const apiError = payload && !payload.accepted ? payload.errors[0] : null;
    throw new AdminApiError(response.status, apiError?.code ?? "ADMIN_INVALID_RESPONSE",
      apiError?.message ?? "Admin server returned an invalid response.");
  }
  return payload.data;
};
