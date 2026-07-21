const JSON_HEADERS = Object.freeze({ "content-type": "application/json" });

export const playerEntryRequest = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { ...(options.body === undefined ? {} : JSON_HEADERS), ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.accepted !== true) {
    const failure = payload?.errors?.[0] || {};
    throw Object.assign(new Error(failure.message || "Serverová operace se nezdařila."), {
      code: failure.code || `HTTP_${response.status}`,
      status: response.status
    });
  }
  return payload.data;
};

export const createStableIdempotencyKey = (scope, payload) => {
  const storageKey = `empire:idempotency:${scope}:${stablePayload(payload)}`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const value = `${scope}:${crypto.randomUUID()}`;
  window.sessionStorage.setItem(storageKey, value);
  return value;
};

export const accountSession = () => playerEntryRequest("/api/account/session");
export const loadAccountRegistrationPolicy = () => playerEntryRequest("/api/account/registration-policy");
export const loginAccount = (body) => playerEntryRequest("/api/account/session", { method: "POST", body: JSON.stringify(body) });
export const registerAccount = (body) => playerEntryRequest("/api/account/register", { method: "POST", body: JSON.stringify(body) });
export const logoutAccount = () => playerEntryRequest("/api/account/session", { method: "DELETE", body: "{}" });
export const loadLobbyOverview = () => playerEntryRequest("/api/lobby/overview");
export const loadSpawnDistricts = (serverInstanceId) =>
  playerEntryRequest(`/api/lobby/servers/${encodeURIComponent(serverInstanceId)}/spawn-districts`);
export const loadServerResults = (serverInstanceId) =>
  playerEntryRequest(`/api/lobby/servers/${encodeURIComponent(serverInstanceId)}/results`);
export const confirmSpawnDistrict = (body) => playerEntryRequest("/api/lobby/spawn-confirm", {
  method: "POST",
  headers: { "idempotency-key": createStableIdempotencyKey("spawn", body) },
  body: JSON.stringify(body)
});
export const finalizeServerSetup = (body) => playerEntryRequest("/api/lobby/setup/finalize", {
  method: "POST",
  headers: { "idempotency-key": createStableIdempotencyKey("setup", body) },
  body: JSON.stringify(body)
});
export const loadMembership = (membershipId) =>
  playerEntryRequest(`/api/lobby/memberships/${encodeURIComponent(membershipId)}`);
export const leaveMembership = (membershipId) =>
  playerEntryRequest(`/api/lobby/memberships/${encodeURIComponent(membershipId)}/leave`, {
    method: "POST", headers: { "idempotency-key": createStableIdempotencyKey("leave", { membershipId }) }, body: "{}"
  });
export const createMembershipJoinTicket = (membershipId) =>
  playerEntryRequest(`/api/lobby/memberships/${encodeURIComponent(membershipId)}/join-ticket`, { method: "POST", body: "{}" });

export const joinGameplayMembership = async (membership) => {
  const response = await fetch("/api/gameplay-slice/join", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      joinTicket: membership.joinTicket,
      serverInstanceId: membership.serverInstanceId,
      preferredStartDistrictId: membership.reservedSpawnDistrictId,
      factionId: membership.factionId
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.accepted !== true) {
    const failure = payload?.errors?.[0] || {};
    throw Object.assign(new Error(failure.message || "Vstup do hry se nezdařil."), { code: failure.code || "GAMEPLAY_JOIN_FAILED" });
  }
  return payload;
};

const stablePayload = (value) => JSON.stringify(sort(value));
const sort = (value) => Array.isArray(value) ? value.map(sort)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sort(item)]))
    : value;
