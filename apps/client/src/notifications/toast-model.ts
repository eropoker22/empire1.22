/**
 * Responsibility: Client-only ephemeral toast model separate from server report history.
 * Belongs here: lightweight local UI notification items.
 * Does not belong here: authoritative domain events or persistent reports.
 */
export interface ToastMessage {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
}

