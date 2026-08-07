import { createHash } from "node:crypto";

export const releaseDatabaseTargetIdentity = (value) => {
  const parsed = value instanceof URL ? value : new URL(String(value ?? "").trim());
  const labels = parsed.hostname.toLowerCase().split(".");
  labels[0] = String(labels[0] ?? "").replace(/-pooler$/u, "");
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (!databaseName || databaseName.includes("/")) {
    throw new Error("RELEASE_DATABASE_TARGET_PATH_INVALID");
  }
  return `${labels.join(".")}:${parsed.port || "5432"}/${databaseName}`;
};

export const releaseDatabaseTargetHash = (value) => createHash("sha256")
  .update(releaseDatabaseTargetIdentity(value))
  .digest("hex");
