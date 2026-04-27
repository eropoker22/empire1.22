export const ROLE_PERMISSIONS = Object.freeze({
  superadmin: Object.freeze(["read", "write", "dangerous", "security", "settings"]),
  admin: Object.freeze(["read", "write", "dangerous"]),
  moderator: Object.freeze(["read", "write"]),
  analyst: Object.freeze(["read"])
});

const DANGEROUS_ACTIONS = Object.freeze(new Set([
  "ban-player",
  "unban-player",
  "reset-player",
  "move-player",
  "end-server",
  "reset-demo",
  "dissolve-alliance",
  "lock-district",
  "trigger-raid",
  "clear-wanted"
]));

const DOUBLE_CONFIRM_ACTIONS = Object.freeze(new Set([
  "ban-player",
  "reset-player",
  "end-server",
  "reset-demo",
  "dissolve-alliance"
]));

export function ensureAdminAccess(data) {
  const role = String(data?.admin?.role || "analyst").toLowerCase();
  return {
    allowed: Boolean(ROLE_PERMISSIONS[role]),
    role,
    permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.analyst,
    reason: "Local mock guard. Replace with backend session + permission assertion."
  };
}

export function canPerformAction(role, action) {
  const permissions = ROLE_PERMISSIONS[String(role || "analyst").toLowerCase()] || ROLE_PERMISSIONS.analyst;
  if (!DANGEROUS_ACTIONS.has(action)) {
    return permissions.includes("write") || permissions.includes("dangerous");
  }
  return permissions.includes("dangerous");
}

export function isDangerousAction(action) {
  return DANGEROUS_ACTIONS.has(action);
}

export function requiresDoubleConfirm(action) {
  return DOUBLE_CONFIRM_ACTIONS.has(action);
}

export function createAdminAuditEntry({ action, actor, target, status = "accepted", message = "" }) {
  return {
    id: `admin-audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    server: "admin-local",
    mode: "admin",
    severity: isDangerousAction(action) ? "warning" : "notice",
    category: "admin",
    actor: actor || "admin:unknown",
    message: message || `${action} ${status} for ${target || "selected entity"}`,
    metadata: `action=${action}; status=${status}; target=${target || "n/a"}`
  };
}

export function getPermissionHint(action) {
  return isDangerousAction(action)
    ? "Backend musí znovu ověřit roli, cílový server a audit correlation id."
    : "Backend command endpoint může přijmout standardní admin write permission.";
}
