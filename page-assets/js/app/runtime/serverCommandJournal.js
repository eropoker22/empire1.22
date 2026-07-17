const STORAGE_PREFIX = "empire:server-command-journal";
const TERMINAL_STATUSES = new Set(["applied", "rejected", "abandoned"]);
let fallbackSequence = 0;

const normalizeScope = (scope = {}) => ({
  serverInstanceId: String(scope.serverInstanceId || "").trim(),
  playerId: String(scope.playerId || "").trim()
});

const getStorageKey = (scope) => {
  const normalized = normalizeScope(scope);
  return `${STORAGE_PREFIX}:${normalized.serverInstanceId}:${normalized.playerId}`;
};

const canStoreScope = (scope) => Boolean(scope.serverInstanceId && scope.playerId);

const clone = (value) => JSON.parse(JSON.stringify(value));

export const createServerGameplayCommandId = (prefix = "command:gameplay") => {
  const cryptoApi = globalThis.crypto;
  const randomPart = typeof cryptoApi?.randomUUID === "function"
    ? cryptoApi.randomUUID()
    : `${Date.now().toString(36)}-${++fallbackSequence}`;
  return `${String(prefix || "command:gameplay")}:${randomPart}`;
};

export const createServerCommandJournal = (options = {}) => {
  const storage = options.storage ?? globalThis.sessionStorage ?? null;
  const entriesByScopeKey = new Map();

  const read = (scope) => {
    const normalized = normalizeScope(scope);
    if (!canStoreScope(normalized)) return [];
    const key = getStorageKey(normalized);
    if (entriesByScopeKey.has(key)) return entriesByScopeKey.get(key);
    let entries = [];
    try {
      const parsed = JSON.parse(storage?.getItem?.(key) || "[]");
      if (Array.isArray(parsed)) {
        entries = parsed
          .filter((entry) => entry && typeof entry === "object" && String(entry.commandId || ""))
          .map((entry) => ({ ...entry }));
      }
    } catch {
      entries = [];
    }
    entriesByScopeKey.set(key, entries);
    return entries;
  };

  const persist = (scope) => {
    const normalized = normalizeScope(scope);
    if (!canStoreScope(normalized)) return;
    const key = getStorageKey(normalized);
    try {
      storage?.setItem?.(key, JSON.stringify(read(normalized)));
    } catch {
      // The in-memory copy remains valid for this page lifetime.
    }
  };

  const find = (scope, commandId) => read(scope).find((entry) => entry.commandId === String(commandId || "")) || null;

  return {
    prepare(input = {}) {
      const scope = normalizeScope(input);
      if (!canStoreScope(scope)) throw new Error("Server gameplay command journal requires player and instance scope.");
      const commandId = String(input.commandId || createServerGameplayCommandId(`command:${String(input.commandType || "gameplay")}`));
      const existing = find(scope, commandId);
      if (existing) return clone(existing);
      const entry = {
        commandId,
        commandType: String(input.commandType || ""),
        playerId: scope.playerId,
        serverInstanceId: scope.serverInstanceId,
        payload: clone(input.payload || {}),
        focusDistrictId: input.focusDistrictId || null,
        expectedStateVersion: input.expectedStateVersion ?? null,
        clientCreatedAt: String(input.clientCreatedAt || new Date().toISOString()),
        status: "prepared",
        attemptCount: 0,
        lastAttemptAt: null,
        lastErrorCode: null,
        request: clone(input.request || null)
      };
      read(scope).push(entry);
      persist(scope);
      return clone(entry);
    },
    get(scope, commandId) {
      const entry = find(scope, commandId);
      return entry ? clone(entry) : null;
    },
    list(scope, statuses = null) {
      const allowed = Array.isArray(statuses) ? new Set(statuses) : null;
      return read(scope)
        .filter((entry) => !allowed || allowed.has(entry.status))
        .map(clone);
    },
    update(scope, commandId, patch = {}) {
      const entry = find(scope, commandId);
      if (!entry) return null;
      Object.assign(entry, clone(patch));
      persist(scope);
      return clone(entry);
    },
    beginSubmit(scope, commandId, now = new Date().toISOString()) {
      const entry = find(scope, commandId);
      if (!entry) return null;
      entry.status = "submitting";
      entry.attemptCount = Math.max(0, Number(entry.attemptCount || 0)) + 1;
      entry.lastAttemptAt = String(now);
      entry.lastErrorCode = null;
      persist(scope);
      return clone(entry);
    },
    markAmbiguous(scope, commandId, errorCode = "COMMAND_RESULT_UNKNOWN") {
      return this.update(scope, commandId, {
        status: "ambiguous",
        lastErrorCode: String(errorCode || "COMMAND_RESULT_UNKNOWN")
      });
    },
    markResolving(scope, commandId) {
      return this.update(scope, commandId, { status: "resolving" });
    },
    markTerminal(scope, commandId, status, errorCode = null) {
      if (!TERMINAL_STATUSES.has(status)) throw new Error(`Unsupported terminal command journal status: ${status}`);
      return this.update(scope, commandId, { status, lastErrorCode: errorCode });
    },
    remove(scope, commandId) {
      const normalized = normalizeScope(scope);
      const entries = read(normalized);
      const index = entries.findIndex((entry) => entry.commandId === String(commandId || ""));
      if (index < 0) return false;
      entries.splice(index, 1);
      persist(normalized);
      return true;
    },
    discardTerminal(scope) {
      const normalized = normalizeScope(scope);
      const entries = read(normalized);
      const remaining = entries.filter((entry) => !TERMINAL_STATUSES.has(entry.status));
      if (remaining.length === entries.length) return;
      entriesByScopeKey.set(getStorageKey(normalized), remaining);
      persist(normalized);
    },
    abandon(scope, commandId) {
      return this.markTerminal(scope, commandId, "abandoned", "SESSION_SCOPE_CHANGED");
    }
  };
};
