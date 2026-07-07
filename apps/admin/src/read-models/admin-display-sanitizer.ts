const SECRET_ASSIGNMENT_PATTERN =
  /\b(sessionToken|snapshotToken|adminToken|authorization|cookie|set-cookie|password|secret|databaseUrl|database_url|dbUrl|db_url|EMPIRE_ADMIN_SECRET|DATABASE_URL|SESSION_TOKEN|GAMEPLAY_SESSION_TOKEN)\b\s*[:=]\s*("[^"]+"|'[^']+'|[^\s,;]+)/gi;

const SECRET_QUERY_PATTERN = /([?&](?:secret|token|password|sessionToken|snapshotToken|key)=)[^&#\s]+/gi;
const SUSPICIOUS_KEY_QUERY_PATTERN = /([?&][a-z0-9_-]*key=)(?:eyJ[a-zA-Z0-9_-]+|\w{24,})[^&#\s]*/gi;
const POSTGRES_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s<>"']+/gi;
const BEARER_PATTERN = /\bbearer\s+[a-z0-9._~+/=-]{16,}/gi;
const COOKIE_HEADER_PATTERN = /\b(set-cookie|cookie|authorization)\b\s*:\s*[^\r\n]+/gi;
const JWT_LIKE_PATTERN = /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g;

export const sanitizeAdminDisplayText = (value: string): string =>
  value
    .replace(POSTGRES_URL_PATTERN, "postgres://[redacted]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=[redacted]")
    .replace(SECRET_QUERY_PATTERN, "$1[redacted]")
    .replace(SUSPICIOUS_KEY_QUERY_PATTERN, "$1[redacted]")
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(COOKIE_HEADER_PATTERN, "$1: [redacted]")
    .replace(JWT_LIKE_PATTERN, "[redacted-jwt]");
