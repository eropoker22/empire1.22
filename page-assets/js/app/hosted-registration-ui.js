const DEFAULT_LOCALE = "cs-CZ";

export const HOSTED_REGISTRATION_STATES = Object.freeze({
  notScheduled: "not_scheduled",
  scheduled: "scheduled",
  open: "open",
  closed: "closed",
  closedEarly: "closed_early"
});

export function createHostedRegistrationTicker({
  onTick,
  intervalMs = 1_000,
  windowRef = globalThis.window,
  performanceRef = globalThis.performance
} = {}) {
  let intervalId = null;
  let serverBaselineMs = Number.NaN;
  let performanceBaselineMs = 0;

  const nowMs = () => Number.isFinite(serverBaselineMs)
    ? serverBaselineMs + Math.max(0, performanceRef.now() - performanceBaselineMs)
    : Date.now();

  const tick = () => onTick?.(nowMs());
  const syncServerTime = (generatedAt) => {
    const parsed = Date.parse(String(generatedAt || ""));
    if (!Number.isFinite(parsed)) return;
    serverBaselineMs = parsed;
    performanceBaselineMs = performanceRef.now();
  };
  const start = () => {
    if (intervalId !== null) return;
    tick();
    intervalId = windowRef.setInterval(tick, Math.max(250, Number(intervalMs) || 1_000));
  };
  const stop = () => {
    if (intervalId === null) return;
    windowRef.clearInterval(intervalId);
    intervalId = null;
  };

  return { nowMs, start, stop, syncServerTime, tick };
}

export function resolveHostedRegistrationPresentation(server, nowMs = Date.now()) {
  const registrationState = normalizeRegistrationState(server?.registrationState);
  const opensAtMs = parseTimestamp(server?.registrationOpensAt);
  const closesAtMs = parseTimestamp(server?.registrationClosesAt);
  const status = String(server?.status || "").trim().toLowerCase();
  const openExpired = registrationState === HOSTED_REGISTRATION_STATES.open
    && Number.isFinite(closesAtMs)
    && nowMs >= closesAtMs;
  const scheduledReached = registrationState === HOSTED_REGISTRATION_STATES.scheduled
    && Number.isFinite(opensAtMs)
    && nowMs >= opensAtMs;
  const effectiveState = openExpired ? HOSTED_REGISTRATION_STATES.closed : registrationState;
  const locallyJoinable = Boolean(server?.joinable)
    && effectiveState === HOSTED_REGISTRATION_STATES.open
    && !openExpired;

  if (scheduledReached) {
    return {
      state: effectiveState,
      statusLabel: "REGISTRACI OVĚŘUJI",
      scheduleLabel: "Plánovaný čas otevření právě nastal.",
      countdownLabel: "Obnovuji stav serveru…",
      remainingMs: 0,
      locallyJoinable: false,
      needsRefresh: true
    };
  }
  if (effectiveState === HOSTED_REGISTRATION_STATES.scheduled) {
    const remainingMs = remainingUntil(opensAtMs, nowMs, server?.registrationRemainingMs);
    return {
      state: effectiveState,
      statusLabel: "REGISTRACE NAPLÁNOVÁNA",
      scheduleLabel: `Otevírá se ${formatHostedRegistrationDate(server?.registrationOpensAt)}`,
      countdownLabel: remainingMs > 0 ? `Začíná za ${formatHostedRegistrationRemaining(remainingMs)}` : "Čekám na server…",
      remainingMs,
      locallyJoinable: false,
      needsRefresh: false
    };
  }
  if (effectiveState === HOSTED_REGISTRATION_STATES.open) {
    if (!Number.isFinite(closesAtMs)) {
      return {
        state: effectiveState,
        statusLabel: status === "running" ? "SERVER BĚŽÍ · REGISTRACE OTEVŘENA" : "REGISTRACE OTEVŘENA",
        scheduleLabel: "Registrace je otevřená.",
        countdownLabel: "",
        remainingMs: Math.max(0, Number(server?.registrationRemainingMs) || 0),
        locallyJoinable: Boolean(server?.joinable),
        needsRefresh: false
      };
    }
    const remainingMs = remainingUntil(closesAtMs, nowMs, server?.registrationRemainingMs);
    return {
      state: effectiveState,
      statusLabel: status === "running" ? "SERVER BĚŽÍ · REGISTRACE OTEVŘENA" : "REGISTRACE OTEVŘENA",
      scheduleLabel: `Končí ${formatHostedRegistrationDate(server?.registrationClosesAt)}`,
      countdownLabel: `Zbývá ${formatHostedRegistrationRemaining(remainingMs)}`,
      remainingMs,
      locallyJoinable,
      needsRefresh: false
    };
  }
  if (effectiveState === HOSTED_REGISTRATION_STATES.closedEarly) {
    return closedPresentation(effectiveState, "REGISTRACE NOUZOVĚ UKONČENA");
  }
  if (effectiveState === HOSTED_REGISTRATION_STATES.closed) {
    return { ...closedPresentation(effectiveState, "REGISTRACE UKONČENA"), needsRefresh: openExpired };
  }
  return closedPresentation(HOSTED_REGISTRATION_STATES.notScheduled, "REGISTRACE NENAPLÁNOVÁNA");
}

export function hostedRegistrationDisabledCopy(code) {
  const normalized = String(code || "").trim().toUpperCase();
  return ({
    WORKER_OFFLINE: "Server se právě nepodařilo bezpečně připojit k hernímu workeru.",
    SERVER_PREPARING: "Server se ještě připravuje.",
    SERVER_FULL: "Server se mezitím zaplnil.",
    SERVER_NOT_PLAYABLE: "Server teď nepřijímá nové hráče.",
    SERVER_REGISTRATION_NOT_SCHEDULED: "Registrace na tento server zatím nebyla naplánována.",
    SERVER_REGISTRATION_NOT_OPEN: "Registrace na tento server ještě nezačala.",
    SERVER_REGISTRATION_CLOSED: "Registrační okno tohoto serveru už skončilo.",
    SERVER_REGISTRATION_CLOSED_EARLY: "Registrace na tento server byla nouzově ukončena.",
    JOINS_CLOSED: "Registrační okno tohoto serveru už skončilo."
  })[normalized] || "Server teď nepřijímá nové hráče.";
}

export function hostedRegistrationCtaLabel(server, nowMs = Date.now()) {
  const presentation = resolveHostedRegistrationPresentation(server, nowMs);
  if (presentation.locallyJoinable) return "VYBRAT DISTRICT";
  const reason = String(server?.disabledReason || "").trim().toUpperCase();
  if (reason === "SERVER_FULL") return "SERVER PLNÝ";
  if (reason === "WORKER_OFFLINE") return "WORKER OFFLINE";
  if (presentation.state === HOSTED_REGISTRATION_STATES.scheduled) return "REGISTRACE NAPLÁNOVÁNA";
  if (presentation.state === HOSTED_REGISTRATION_STATES.closedEarly) return "REGISTRACE NOUZOVĚ UKONČENA";
  if (presentation.state === HOSTED_REGISTRATION_STATES.closed) return "REGISTRACE UKONČENA";
  return presentation.statusLabel;
}

export function formatHostedRegistrationRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatHostedRegistrationDate(value, options = {}) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "–";
  return new Intl.DateTimeFormat(options.locale || DEFAULT_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: options.timeZone
  }).format(new Date(timestamp));
}

export function resolveBrowserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

const normalizeRegistrationState = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.values(HOSTED_REGISTRATION_STATES).includes(normalized)
    ? normalized
    : HOSTED_REGISTRATION_STATES.notScheduled;
};

const parseTimestamp = (value) => {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const remainingUntil = (timestamp, nowMs, fallback) => Number.isFinite(timestamp)
  ? Math.max(0, timestamp - nowMs)
  : Math.max(0, Number(fallback) || 0);

const closedPresentation = (state, statusLabel) => ({
  state,
  statusLabel,
  scheduleLabel: "Noví hráči už nemohou potvrdit district.",
  countdownLabel: "",
  remainingMs: 0,
  locallyJoinable: false,
  needsRefresh: false
});
