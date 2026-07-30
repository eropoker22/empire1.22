import { randomUUID } from "node:crypto";
import { delay } from "./process-supervisor.mjs";

export async function createLocalHostedAdminClient({
  apiOrigin,
  browserOrigin,
  username,
  password
}) {
  if (!username || !password) {
    throw new Error("Local hosted admin bootstrap credentials are required.");
  }
  const login = await fetch(`${apiOrigin}/api/admin/session`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: browserOrigin },
    body: JSON.stringify({ username, password })
  });
  const loginPayload = await safeJson(login);
  if (!login.ok || loginPayload?.accepted !== true) {
    throw new Error(`Local hosted admin login failed (${login.status}).`);
  }
  const cookie = login.headers.get("set-cookie")?.split(";", 1)[0] || "";
  if (!cookie) throw new Error("Local hosted admin login did not create a session cookie.");

  const request = async (pathname, init = {}) => {
    const response = await fetch(`${apiOrigin}${pathname}`, {
      ...init,
      headers: {
        accept: "application/json",
        cookie,
        origin: browserOrigin,
        ...(init.headers || {})
      }
    });
    const payload = await safeJson(response);
    if (!response.ok || payload?.accepted !== true) {
      const code = payload?.errors?.[0]?.code || "UNKNOWN";
      throw new Error(`${pathname} failed (${response.status}, ${code}).`);
    }
    return payload.data;
  };
  return Object.freeze({ request });
}

export async function provisionDisposableHostedServer(admin, {
  displayNamePrefix = "Local Hosted E2E",
  capacity = 20,
  startingPlayerState,
  onCreated
} = {}) {
  const suffix = randomUUID().slice(0, 8);
  const created = await admin.request("/api/admin/servers", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `local-hosted-create-${suffix}`
    },
    body: JSON.stringify({
      mode: "free",
      serverTemplate: "full",
      displayName: `${displayNamePrefix} ${suffix}`,
      region: "eu-central",
      capacity,
      joinPolicy: "closed",
      mapComposition: {
        downtown: 8,
        commercial: 40,
        residential: 38,
        industrial: 38,
        park: 37
      },
      ...(startingPlayerState ? { startingPlayerState } : {})
    })
  });
  const serverInstanceId = created.server.serverInstanceId;
  onCreated?.({
    displayName: created.server.displayName,
    serverInstanceId
  });
  const ready = await waitForServer(admin, serverInstanceId, (server, controlPlane) => (
    server.provisioningState === "ready"
    && Boolean(server.currentSnapshotId)
    && controlPlane.workerStatus === "online"
  ));
  await requestAction(admin, ready, "open-registration-now", "Fresh local hosted E2E registration");
  const open = await waitForServer(admin, serverInstanceId, (server) => (
    server.registrationState === "open" && server.joinPolicy === "open"
  ));
  return Object.freeze({
    displayName: open.displayName,
    serverInstanceId,
    version: open.version
  });
}

export async function stopDisposableHostedServer(admin, serverInstanceId) {
  const server = await findServer(admin, serverInstanceId);
  if (!server || ["stopped", "failed"].includes(server.status)) return;
  await requestAction(admin, server, "stop", "Local hosted E2E cleanup");
  await waitForServer(admin, serverInstanceId, (candidate) => candidate.status === "stopped");
}

export async function stopStaleDisposableHostedServers(admin) {
  const controlPlane = await admin.request("/api/admin/control-plane");
  const staleServers = controlPlane.servers.filter((server) => (
    server.displayName.startsWith("Local Hosted ")
    && !["stopped", "failed", "archived"].includes(server.status)
  ));
  if (!staleServers.length) return Object.freeze({ requested: 0, stopped: 0 });
  await Promise.all(staleServers.map((server) => requestAction(
    admin,
    server,
    "stop",
    "Local hosted E2E stale runtime preflight cleanup"
  )));
  const pending = new Set(staleServers.map((server) => server.serverInstanceId));
  const startedAt = Date.now();
  while (pending.size && Date.now() - startedAt < 300_000) {
    const current = await admin.request("/api/admin/control-plane");
    for (const server of current.servers) {
      if (pending.has(server.serverInstanceId) && ["stopped", "failed", "archived"].includes(server.status)) {
        pending.delete(server.serverInstanceId);
      }
    }
    if (pending.size) await delay(1_000);
  }
  if (pending.size) {
    throw new Error(`Timed out stopping ${pending.size} stale local hosted E2E servers.`);
  }
  return Object.freeze({
    requested: staleServers.length,
    stopped: staleServers.length
  });
}

export async function startDisposableHostedServer(admin, serverInstanceId) {
  const ready = await waitForServer(admin, serverInstanceId, (server) => server.canStart === true);
  await requestAction(admin, ready, "start", "Local hosted E2E canonical start");
  return waitForServer(admin, serverInstanceId, (server) => server.status === "running");
}

async function requestAction(admin, server, action, reason) {
  return admin.request(`/api/admin/servers/${encodeURIComponent(server.serverInstanceId)}/actions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `local-hosted-${action}-${randomUUID()}`
    },
    body: JSON.stringify({
      action,
      expectedVersion: server.version,
      reason
    })
  });
}

async function waitForServer(admin, serverInstanceId, predicate, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const controlPlane = await admin.request("/api/admin/control-plane");
    const server = controlPlane.servers.find((candidate) => (
      candidate.serverInstanceId === serverInstanceId
    )) || null;
    if (server && predicate(server, controlPlane)) return server;
    await delay(1_000);
  }
  throw new Error(`Hosted server ${serverInstanceId} did not reach the expected state.`);
}

async function findServer(admin, serverInstanceId) {
  const controlPlane = await admin.request("/api/admin/control-plane");
  return controlPlane.servers.find((server) => server.serverInstanceId === serverInstanceId) || null;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
