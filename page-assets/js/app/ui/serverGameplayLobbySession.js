export const GAMEPLAY_SESSION_LOGOUT_ENDPOINT = "/api/gameplay-slice/logout";

export function formatGameplayLobbyCooldown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function resolveGameplayLobbyLeaveAvailability(
  membership,
  membershipObservedAt,
  now
) {
  const elapsed = membershipObservedAt > 0
    ? Math.max(0, now - membershipObservedAt)
    : 0;
  const serverRemaining = Number(membership?.earlyLeaveRemainingMs || 0);
  const preStart = Boolean(membership?.canLeaveEarly && !membership?.earlyLeaveDeadline);
  return {
    allowed: Boolean(membership?.canLeaveEarly)
      && (preStart || serverRemaining - elapsed > 0),
    preStart,
    remainingMs: Math.max(0, serverRemaining - elapsed)
  };
}

export function resolveGameplayPageHref(readModel, root, page) {
  const mode = String(
    readModel?.mode?.mode
    || readModel?.player?.mode
    || root?.dataset?.serverMode
    || ""
  ).trim().toLowerCase();
  return mode === "free" || mode === "war"
    ? `./${page}.html?mode=${encodeURIComponent(mode)}`
    : `./${page}.html`;
}

export async function revokeGameplaySession({
  fetchImpl,
  endpoint = GAMEPLAY_SESSION_LOGOUT_ENDPOINT
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Odhlášení teď není dostupné.");
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: "{}"
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.accepted !== true) {
    throw new Error(payload?.errors?.[0]?.message || "Session se nepodařilo bezpečně ukončit.");
  }
  return payload;
}
